import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauriApi } from '../services/tauriApi';
import { playWakeWordChime } from '../utils/chimePlayer';

interface WakeWordListenerOptions {
  enabled: boolean;
  sensitivity?: number;
  isSTTRecording: boolean;
  isTTSSpeaking: boolean;
  onWakeWordDetected: () => void;
  onError?: (msg: string) => void;
}

export const useWakeWordListener = ({
  enabled,
  sensitivity = 0.50,
  isSTTRecording,
  isTTSSpeaking,
  onWakeWordDetected,
  onError,
}: WakeWordListenerOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [wakewordError, setWakewordError] = useState<string | null>(null);

  // 1. Manage wake word background listener start/stop
  useEffect(() => {
    let isMounted = true;

    async function toggleWakeword() {
      if (!enabled) {
        setIsListening(false);
        setWakewordError(null);
        await tauriApi.stopWakeword().catch(() => {});
        return;
      }

      try {
        await tauriApi.startWakeword(sensitivity);
        if (isMounted) {
          setIsListening(true);
          setWakewordError(null);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn('Rustpotter wake word start warning:', msg);
        if (isMounted) {
          setIsListening(false);
          setWakewordError(msg);
          if (onError) onError(msg);
        }
      }
    }

    toggleWakeword();

    return () => {
      isMounted = false;
      tauriApi.stopWakeword().catch(() => {});
    };
  }, [enabled, sensitivity]);

  // 2. Pause listener when STT or TTS is active
  useEffect(() => {
    const shouldPause = isSTTRecording || isTTSSpeaking;
    tauriApi.setWakewordPaused(shouldPause).catch(() => {});
  }, [isSTTRecording, isTTSSpeaking]);

  // 3. Listen to Tauri 'wake-word-detected' event
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    async function setupEventListener() {
      try {
        const unlisten = await listen<{ name?: string; score?: number }>(
          'wake-word-detected',
          (event) => {
            console.log('Rustpotter Wake Word Event:', event.payload);
            playWakeWordChime();
            onWakeWordDetected();
          }
        );
        unlistenFn = unlisten;
      } catch (err) {
        console.warn('Failed to register wake-word-detected listener:', err);
      }
    }

    setupEventListener();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [onWakeWordDetected]);

  const isWakeWordActive = enabled && isListening && !isSTTRecording && !isTTSSpeaking;

  return {
    isWakeWordActive,
    wakewordError,
  };
};
