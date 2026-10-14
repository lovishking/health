export interface ClinicianUser {
  id: string;
  email: string;
  display_name?: string;
  phone_number?: string;
  role: string;
  is_active: boolean;
  smtp_enabled: boolean;
  smtp_host?: string;
  smtp_port?: string;
  smtp_username?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_use_tls: boolean;
  created_at: string;
}

export interface Patient {
  id: string;
  display_id: string;
  display_name?: string;
  status: string;
  created_at: string;
  latest_reading_time?: string;
  latest_tier?: 'Stable' | 'Warning' | 'Critical' | 'Unknown';
  active_alerts_count: number;
}

export interface VitalReading {
  id: string;
  patient_id: string;
  source: string;
  source_event_id?: string;
  event_timestamp: string;
  ingested_at: string;
  heart_rate?: number;
  spo2?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  temperature?: number;
  quality_flags?: string;
}

export interface RiskPrediction {
  id: string;
  patient_id: string;
  reading_id?: string;
  model_version: string;
  stable_probability?: number;
  warning_probability?: number;
  critical_probability?: number;
  model_tier?: string;
  final_tier: 'Stable' | 'Warning' | 'Critical';
  decision_source: 'rules_provisional' | 'safety_override' | 'hybrid_fusion' | 'xgboost' | 'lstm' | 'insufficient_data';
  explanation?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  patient_id: string;
  prediction_id?: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

export interface WebSocketEvent {
  type: string;
  patient_id?: string;
  data?: any;
}
