import React, { useState, useEffect, useRef } from 'react';
import { tauriApi, WakewordTestResult } from '../services/tauriApi';

interface WakeWordTrainerModalProps {
  onClose: () => void;
  sensitivity: number;
}

const TOTAL_SLOTS = 8;
const REQUIRED_MIN_SAMPLES = 3;

export const WakeWordTrainerModal: React.FC<WakeWordTrainerModalProps> = ({
  onClose,
  sensitivity,
}) => {
  const [recordedSlots, setRecordedSlots] = useState<boolean[]>(
    new Array(TOTAL_SLOTS).fill(false)
  );
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordingTimer, setRecordingTimer] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildSuccess, setBuildSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test section state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<WakewordTestResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    async function checkExistingSamples() {
      try {
        const count = await tauriApi.getWakewordSampleCount();
        const updated = new Array(TOTAL_SLOTS).fill(false);
        for (let i = 0; i < Math.min(count, TOTAL_SLOTS); i++) {
          updated[i] = true;
        }
        setRecordedSlots(updated);
      } catch (err) {
        console.warn('Failed to check sample count:', err);
      }
    }
    checkExistingSamples();
  }, []);

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Level meter init error:', e);
    }
  };

  const stopLevelMeter = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  const recordSampleSlot = async (slotIndex: number) => {
    setErrorMessage(null);
    setBuildSuccess(null);
    setRecordingIndex(slotIndex);
    setRecordingTimer(2);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startLevelMeter(stream);

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopLevelMeter();
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        );

        try {
          await tauriApi.saveWakewordSample(slotIndex, base64);
          const nextSlots = [...recordedSlots];
          nextSlots[slotIndex] = true;
          setRecordedSlots(nextSlots);
        } catch (err: any) {
          setErrorMessage(`Failed to save sample ${slotIndex + 1}: ${err.message || err}`);
        } finally {
          setRecordingIndex(null);
        }
      };

      mediaRecorder.start();

      let seconds = 2;
      const countdown = setInterval(() => {
        seconds -= 1;
        setRecordingTimer(seconds);
        if (seconds <= 0) {
          clearInterval(countdown);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 1000);
    } catch (err: any) {
      stopLevelMeter();
      setRecordingIndex(null);
      setErrorMessage(`Microphone access error: ${err.message || err}`);
    }
  };

  const handleClearAll = async () => {
    try {
      await tauriApi.clearWakewordSamples();
      setRecordedSlots(new Array(TOTAL_SLOTS).fill(false));
      setBuildSuccess(null);
      setTestResult(null);
    } catch (err: any) {
      setErrorMessage(`Clear failed: ${err.message || err}`);
    }
  };

  const handleBuildModel = async () => {
    setErrorMessage(null);
    setBuildSuccess(null);
    setIsBuilding(true);

    try {
      const modelPath = await tauriApi.buildWakewordModel();
      setBuildSuccess(`Wake word model built & saved successfully to: ${modelPath}`);
    } catch (err: any) {
      setErrorMessage(`Model build failed: ${err.message || err}`);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleTestRecording = async () => {
    setErrorMessage(null);
    setTestResult(null);
    setIsTesting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startLevelMeter(stream);

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopLevelMeter();
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(arrayBuffer))
        );

        try {
          const res = await tauriApi.testWakewordAudio(base64, sensitivity);
          setTestResult(res);
        } catch (err: any) {
          setErrorMessage(`Test failed: ${err.message || err}`);
        } finally {
          setIsTesting(false);
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 2200);
    } catch (err: any) {
      stopLevelMeter();
      setIsTesting(false);
      setErrorMessage(`Mic error: ${err.message || err}`);
    }
  };

  const recordedCount = recordedSlots.filter(Boolean).length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '640px',
          width: '94%',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1px solid #334155',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🎯 Train Your Custom Wake Word (Rustpotter)
          </h2>
          <button
            onClick={onClose}
            style={{ backgroundColor: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.5' }}>
          Record 5 to 8 clear audio samples of yourself saying your wake word (e.g. <strong>"Hey Bolo"</strong>).
          Rustpotter uses these samples to generate an on-device <code>.rpw</code> wake word model file.
        </p>

        {errorMessage && (
          <div style={{ padding: '10px 14px', backgroundColor: '#991b1b', color: '#fef2f2', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            ❌ {errorMessage}
          </div>
        )}

        {buildSuccess && (
          <div style={{ padding: '10px 14px', backgroundColor: '#166534', color: '#f0fdf4', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            🎉 {buildSuccess}
          </div>
        )}

        {/* Live Audio Level Meter */}
        {recordingIndex !== null && (
          <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #0284c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#38bdf8' }}>
              <span>🎙️ Recording Sample #{recordingIndex + 1}... Speak now!</span>
              <span>⏱️ {recordingTimer}s remaining</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${audioLevel}%`,
                  backgroundColor: audioLevel > 70 ? '#ef4444' : '#22c55e',
                  transition: 'width 0.05s ease-out',
                }}
              />
            </div>
          </div>
        )}

        {/* Sample Slots Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {recordedSlots.map((isRecorded, idx) => (
            <button
              key={idx}
              onClick={() => recordSampleSlot(idx)}
              disabled={recordingIndex !== null}
              style={{
                padding: '12px 8px',
                borderRadius: '8px',
                border: isRecorded ? '1px solid #22c55e' : '1px solid #475569',
                backgroundColor: isRecorded ? '#064e3b' : '#0f172a',
                color: isRecorded ? '#4ade80' : '#cbd5e1',
                cursor: recordingIndex !== null ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{isRecorded ? '✅ Recorded' : `Sample #${idx + 1}`}</span>
              <span style={{ fontSize: '10px', color: isRecorded ? '#a7f3d0' : '#64748b' }}>
                {isRecorded ? 'Click to re-record' : 'Click to record (2s)'}
              </span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#0f172a', borderRadius: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            Recorded: <strong>{recordedCount} / {TOTAL_SLOTS}</strong> (Min {REQUIRED_MIN_SAMPLES} needed)
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleClearAll}
              disabled={recordedCount === 0 || recordingIndex !== null}
              style={{
                padding: '8px 12px',
                backgroundColor: '#334155',
                color: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: recordedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Clear All
            </button>

            <button
              onClick={handleBuildModel}
              disabled={recordedCount < REQUIRED_MIN_SAMPLES || isBuilding}
              style={{
                padding: '8px 16px',
                backgroundColor: recordedCount >= REQUIRED_MIN_SAMPLES ? '#0284c7' : '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: recordedCount >= REQUIRED_MIN_SAMPLES ? 'pointer' : 'not-allowed',
              }}
            >
              {isBuilding ? 'Building .rpw...' : '🔨 Build Wake Word Model (.rpw)'}
            </button>
          </div>
        </div>

        {/* Test Model Section */}
        <div style={{ borderTop: '1px solid #334155', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#f59e0b' }}>
            🧪 Test Live Wake Word Match
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={handleTestRecording}
              disabled={isTesting || recordingIndex !== null}
              style={{
                padding: '8px 16px',
                backgroundColor: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isTesting ? '🎙️ Listening (2s)...' : 'Test Say Wake Word'}
            </button>

            {testResult && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '10px', backgroundColor: '#334155', borderRadius: '5px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(testResult.score * 100))}%`,
                      backgroundColor: testResult.detected ? '#22c55e' : '#f59e0b',
                    }}
                  />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: testResult.detected ? '#4ade80' : '#f59e0b' }}>
                  {testResult.detected ? `MATCH! (${(testResult.score * 100).toFixed(0)}%) 🎉` : `Score: ${(testResult.score * 100).toFixed(0)}% (Below ${Math.round(sensitivity * 100)}%)`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              backgroundColor: '#475569',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
