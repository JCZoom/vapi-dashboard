export interface ApiTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  method: HttpMethod;
  path: string;
  description: string;
  requiredFields: RequiredField[];
  bodyTemplate?: Record<string, unknown>;
}

export type TemplateCategory = 
  | 'Calls'
  | 'Assistants'
  | 'Phone Numbers'
  | 'Tools'
  | 'Analytics'
  | 'Tool Testing'
  | 'Custom';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequiredField {
  name: string;
  label: string;
  type: 'path' | 'query' | 'body';
  placeholder?: string;
  description?: string;
}

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
}

export interface Assistant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  model?: {
    provider: string;
    model: string;
  };
}

export interface Call {
  id: string;
  assistantId?: string;
  phoneNumberId?: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  messages?: CallMessage[];
  customer?: {
    number?: string;
  };
}

export interface CallMessage {
  role: 'assistant' | 'user' | 'system' | 'tool';
  content?: string;
  time?: number;
}

export interface PhoneNumber {
  id: string;
  number: string;
  name?: string;
  createdAt: string;
}

export interface Tool {
  id: string;
  name: string;
  type: string;
  createdAt: string;
}
