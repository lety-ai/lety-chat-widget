export interface DisplayConfig {
  assistantName: string;
  avatarUrl?: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  position: 'left' | 'right';
  autoOpen: boolean;
  soundEnabled: boolean;
}

export interface SessionResponse {
  token: string;
  visitorId: string;
}

export interface Bootstrap {
  config: DisplayConfig;
  token: string;
  apiBase: string;
}

export type ChatRole = 'user' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}
