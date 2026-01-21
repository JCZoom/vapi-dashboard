export interface FreshcallerCall {
  id: number;
  direction: 'incoming' | 'outgoing';
  parent_call_id: number | null;
  root_call_id: number | null;
  phone_number_id: number;
  phone_number: string;
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  assigned_team_id: number | null;
  assigned_team_name: string | null;
  assigned_call_queue_id: number | null;
  assigned_call_queue_name: string | null;
  assigned_ivr_id: number | null;
  assigned_ivr_name: string | null;
  call_notes: string | null;
  bill_duration: number | null;
  bill_duration_unit: string;
  created_time: string;
  updated_time: string;
  recording: FreshcallerRecording | null;
  participants: FreshcallerParticipant[];
  external_number: string | null;
}

export interface FreshcallerRecording {
  id: number;
  url: string;
  transcription_url: string | null;
  duration: number;
  duration_unit: string;
}

export interface FreshcallerParticipant {
  id: number;
  call_id: number;
  caller_id: number | null;
  caller_number: string | null;
  caller_name: string | null;
  participant_id: number;
  participant_type: 'Customer' | 'Agent';
  connection_type: number;
  call_status: number;
  duration: number | null;
  duration_unit: string;
  cost: number | null;
  cost_unit: string;
  enqueued_time: string | null;
  created_time: string;
  updated_time: string;
}

export interface FreshcallerCallMetric {
  id: number;
  created_time: string;
  updated_time: string;
  call_id: number;
  ivr_time: number;
  ivr_time_unit: string;
  hold_duration: number;
  hold_duration_unit: string;
  call_work_time: number;
  call_work_time_unit: string;
  total_ringing_time: number;
  total_ringing_time_unit: string;
  talk_time: number;
  talk_time_unit: string;
  answering_speed: number | null;
  answering_speed_unit: string;
  recording_duration: number;
  recording_duration_unit: string;
  bill_duration: number | null;
  bill_duration_unit: string;
  cost: number | null;
  cost_unit: string;
  life_cycle: FreshcallerLifecycleEvent[];
  tags: FreshcallerTag[];
}

export interface FreshcallerLifecycleEvent {
  type: string;
  time_stamp: string;
  queue_id?: number;
  ivr_id?: number;
  agent_id?: number;
  team_id?: number;
}

export interface FreshcallerTag {
  id: number;
  name: string;
  default: boolean;
}

export interface FreshcallerTeam {
  id: number;
  name: string;
  description: string;
  users: { id: number }[];
  omni_channel: boolean;
}

export interface FreshcallerUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  confirmed: boolean;
  available: boolean;
  time_zone: string;
  language: string;
  created_time: string;
  updated_time: string;
}

export interface FreshcallerCallsResponse {
  calls: FreshcallerCall[];
  meta: {
    total_pages: number;
    total_count: number;
    current: number;
  };
}

export interface FreshcallerTeamsResponse {
  teams: FreshcallerTeam[];
  meta: {
    total_pages: number;
    total_count: number;
    current: number;
  };
}

export interface FreshcallerUsersResponse {
  users: FreshcallerUser[];
  meta: {
    total_pages: number;
    total_count: number;
    current: number;
  };
}

// Call status codes
export const CALL_STATUS = {
  0: 'Initiated',
  1: 'Ringing',
  2: 'In Progress',
  3: 'On Hold',
  4: 'Completed',
  5: 'Missed',
  6: 'Voicemail',
  7: 'Abandoned',
  8: 'Failed',
  9: 'Busy',
  10: 'No Answer',
} as const;

// Lifecycle event types
export const LIFECYCLE_EVENTS = {
  'call_initiated': 'Call Initiated',
  'ivr_started': 'IVR Started',
  'ivr_input': 'IVR Input Received',
  'call_queue_started': 'Added to Queue',
  'agent_ringing': 'Agent Ringing',
  'answered': 'Call Answered',
  'voicemail_initiated': 'Voicemail Started',
  'hangup': 'Call Ended',
  'transfer': 'Call Transferred',
  'external_transfer': 'Transferred to External',
} as const;
