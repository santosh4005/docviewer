export interface DocumentSummary {
  filename: string;
  display_name: string;
}

export interface DocumentDetail {
  filename: string;
  display_name: string;
  html: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'typing' | 'error';
  content: string;
}

export interface ChatResponse {
  answer: string;
}
