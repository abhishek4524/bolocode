import { tauriApi } from '../services/tauriApi';

let currentAudio: HTMLAudioElement | null = null;

export function autoDetectVoice(text: string, userDefaultVoice?: string): string {
  if (userDefaultVoice && userDefaultVoice !== 'auto') {
    return userDefaultVoice;
  }

  // Check for Devanagari script or Hindi/Hinglish keywords
  const containsDevanagari = /[\u0900-\u097F]/.test(text);
  const containsHinglishKeywords = /\b(hai|kar|diya|banao|batao|aap|ho|gaya|karo|sab|nahin|haan|pakka|chahiye)\b/i.test(text);

  if (containsDevanagari || containsHinglishKeywords) {
    return 'hi-IN-SwaraNeural';
  }

  return 'en-US-AvaNeural';
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export async function speakReply(text: string, userVoiceSetting?: string): Promise<void> {
  if (!text || text.trim() === '') return;

  // Immediate stop previous playback (barge-in safeguard)
  stopSpeaking();

  const voice = autoDetectVoice(text, userVoiceSetting);

  try {
    const audioBase64 = await tauriApi.ttsSpeak(text, voice);
    if (audioBase64 && audioBase64.length > 100) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      currentAudio = audio;
      await audio.play();
      return;
    }
  } catch (err) {
    console.warn('Rust Edge TTS failed, attempting browser Web Speech fallback:', err);
  }

  // Fallback to Web Speech API
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.startsWith('hi') ? 'hi-IN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

export function classifyVoiceConfirmation(transcript: string): 'yes' | 'no' | 'unknown' {
  const clean = transcript.trim().toLowerCase();

  const yesRegex = /\b(haan|yes|ha|ok|confirm|sure|kar do|kar|delete kar do|chalo|done)\b/i;
  const noRegex = /\b(nahi|no|cancel|mat karo|na|stop|dont|don't|abort|rehne do)\b/i;

  if (yesRegex.test(clean)) return 'yes';
  if (noRegex.test(clean)) return 'no';

  return 'unknown';
}
