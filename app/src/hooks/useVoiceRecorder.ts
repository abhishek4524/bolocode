import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderOptions {
  onAudioRecorded: (base64Audio: string) => void;
  onError: (errMessage: string) => void;
  deviceDeviceId?: string;
}

export const useVoiceRecorder = ({ onAudioRecorded, onError, deviceDeviceId }: VoiceRecorderOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      hasSpokenRef.current = false;
      audioChunksRef.current = [];

      const constraints: MediaStreamConstraints = {
        audio: deviceDeviceId && deviceDeviceId !== 'default'
          ? { deviceId: { exact: deviceDeviceId } }
          : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Web Audio API VAD setup
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // MediaRecorder setup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (blob.size < 500) {
          onError('Recording was empty or too short. Please try speaking again.');
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          onAudioRecorded(base64Data);
        };
      };

      // VAD Monitoring Loop
      const checkVAD = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVolumeLevel(Math.min(100, Math.round(average * 2)));

        // Speech detection threshold (average > 15)
        if (average > 15) {
          hasSpokenRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpokenRef.current) {
          // If user was speaking and now dropped into silence -> start 1s timer to auto-stop
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log('VAD: 1s silence detected. Auto-stopping recording...');
              stopRecording();
            }, 1000);
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVAD);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      checkVAD();

      // Max 30 seconds duration timer
      maxDurationTimerRef.current = setTimeout(() => {
        console.log('Max 30s recording duration reached. Auto-stopping...');
        stopRecording();
      }, 30000);

    } catch (err: any) {
      console.error('Microphone error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        onError('Microphone permission denied. Please allow microphone access in system settings.');
      } else {
        onError(`Microphone error: ${err.message || err}`);
      }
      setIsRecording(false);
    }
  }, [deviceDeviceId, onAudioRecorded, onError, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Global hotkey binding listener for Ctrl+Shift+Space and Ctrl+Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.code === 'Space') || (e.ctrlKey && e.code === 'Space')) {
        e.preventDefault();
        toggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording]);

  return {
    isRecording,
    volumeLevel,
    startRecording,
    stopRecording,
    toggleRecording
  };
};
