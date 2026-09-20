import { invoke } from '@tauri-apps/api/core';

export interface VSCodeInstance {
  pid: number;
  port: number;
  token: string;
  workspace?: string;
  lastFocused?: string;
  is_reachable?: boolean;
}

export interface ConnectionStatus {
  is_connected: boolean;
  scanned_path: string;
  active_instances: VSCodeInstance[];
  selected_instance?: VSCodeInstance;
  status_message: string;
  log_lines: string[];
}

export interface AppConfig {
  groq_stt_model: string;
  primary_llm_model: string;
  fallback_llm_model: string;
  tts_voice: string;
  hotkey: string;
  microphone_device: string;
  wake_word_enabled: boolean;
  wake_word_sensitivity: number;
  custom_wakeword_path: string;
  onboarding_done: boolean;
}

export interface CallToolResult {
  success: boolean;
  data?: any;
  error?: string;
  needs_confirmation: boolean;
  confirmation_reason?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: any;
}

export interface LlmChatResult {
  content?: string;
  tool_calls: ToolCallRequest[];
  provider_used: string;
}

export interface WakewordTestResult {
  detected: boolean;
  score: number;
  name?: string;
}

export const tauriApi = {
  listInstances: async (): Promise<VSCodeInstance[]> => {
    return invoke('list_instances');
  },

  checkConnectionStatus: async (): Promise<ConnectionStatus> => {
    return invoke('check_connection_status');
  },

  connectManual: async (port: number, token: string): Promise<CallToolResult> => {
    return invoke('connect_manual', { port, token });
  },

  getAppLogs: async (maxLines: number = 100): Promise<string[]> => {
    return invoke('get_app_logs', { maxLines });
  },

  saveApiKey: async (service: string, key: string): Promise<void> => {
    return invoke('save_api_key', { service, key });
  },

  getApiKey: async (service: string): Promise<string | null> => {
    return invoke('get_api_key_cmd', { service });
  },

  getAppSettings: async (): Promise<AppConfig> => {
    return invoke('get_app_settings');
  },

  saveAppSettings: async (config: AppConfig): Promise<void> => {
    return invoke('save_app_settings', { config });
  },

  callTool: async (
    name: string,
    args: Record<string, any> = {},
    confirmed: boolean = false,
    pid?: number,
    manualPort?: number,
    manualToken?: string
  ): Promise<CallToolResult> => {
    return invoke('call_tool', {
      name,
      args,
      confirmed,
      pid,
      manualPort,
      manualToken
    });
  },

  llmChat: async (
    messages: any[],
    tools?: any[]
  ): Promise<LlmChatResult> => {
    return invoke('llm_chat', { messages, tools });
  },

  sttTranscribe: async (audioBase64: string): Promise<string> => {
    return invoke('stt_transcribe', { audioBase64 });
  },

  ttsSpeak: async (text: string, voice?: string): Promise<string> => {
    return invoke('tts_speak', { text, voice });
  },

  // Rustpotter Wake Word Commands
  startWakeword: async (sensitivity?: number, modelPath?: string): Promise<void> => {
    return invoke('start_wakeword_cmd', { sensitivity, modelPath });
  },

  stopWakeword: async (): Promise<void> => {
    return invoke('stop_wakeword_cmd');
  },

  setWakewordPaused: async (paused: boolean): Promise<void> => {
    return invoke('set_wakeword_paused_cmd', { paused });
  },

  saveWakewordSample: async (sampleIndex: number, audioBase64: string): Promise<string> => {
    return invoke('save_wakeword_sample_cmd', { sampleIndex, audioBase64 });
  },

  getWakewordSampleCount: async (): Promise<number> => {
    return invoke('get_wakeword_sample_count_cmd');
  },

  clearWakewordSamples: async (): Promise<void> => {
    return invoke('clear_wakeword_samples_cmd');
  },

  buildWakewordModel: async (): Promise<string> => {
    return invoke('build_wakeword_model_cmd');
  },

  testWakewordAudio: async (audioBase64: string, sensitivity?: number): Promise<WakewordTestResult> => {
    return invoke('test_wakeword_audio_cmd', { audioBase64, sensitivity });
  },
};
