import axios from 'axios';
import { Patient, VitalReading, RiskPrediction, Alert, ClinicianUser } from '../types';

const API_BASE = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SmtpSettingsPayload {
  smtp_host: string;
  smtp_port: number;
  smtp_username?: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name?: string;
  smtp_use_tls: boolean;
  smtp_enabled: boolean;
}

export const api = {
  // Users / Clinicians
  getUsers: async (): Promise<ClinicianUser[]> => {
    const res = await apiClient.get<ClinicianUser[]>('/users');
    return res.data;
  },
  createUser: async (user: { email: string; display_name?: string; phone_number?: string; role?: string; password: string }): Promise<ClinicianUser> => {
    const res = await apiClient.post<ClinicianUser>('/users', user);
    return res.data;
  },
  loginUser: async (credentials: { email: string; password: string }): Promise<string> => {
    const res = await apiClient.post<{ access_token: string; token_type: string }>('/users/login', credentials);
    localStorage.setItem('auth_token', res.data.access_token);
    return res.data.access_token;
  },
  getMe: async (): Promise<ClinicianUser> => {
    const res = await apiClient.get<ClinicianUser>('/users/me');
    return res.data;
  },
  updateMySmtpSettings: async (settings: SmtpSettingsPayload): Promise<ClinicianUser> => {
    const res = await apiClient.put<ClinicianUser>('/users/me/smtp', settings);
    return res.data;
  },

  // Patients
  getPatients: async (): Promise<Patient[]> => {
    const res = await apiClient.get<Patient[]>('/patients');
    return res.data;
  },
  getPatient: async (patientId: string): Promise<Patient> => {
    const res = await apiClient.get<Patient>(`/patients/${patientId}`);
    return res.data;
  },
  createPatient: async (patient: { display_id: string; display_name?: string }): Promise<Patient> => {
    const res = await apiClient.post<Patient>('/patients', patient);
    return res.data;
  },

  // Readings
  getReadings: async (patientId: string, limit = 50): Promise<VitalReading[]> => {
    const res = await apiClient.get<VitalReading[]>(`/patients/${patientId}/readings?limit=${limit}`);
    return res.data;
  },
  postReading: async (patientId: string, reading: Partial<VitalReading>): Promise<VitalReading> => {
    const res = await apiClient.post<VitalReading>(`/patients/${patientId}/readings`, reading);
    return res.data;
  },

  // Risk Predictions
  getLatestRisk: async (patientId: string): Promise<RiskPrediction> => {
    const res = await apiClient.get<RiskPrediction>(`/patients/${patientId}/risk`);
    return res.data;
  },
  getPredictions: async (patientId: string, limit = 20): Promise<RiskPrediction[]> => {
    const res = await apiClient.get<RiskPrediction[]>(`/patients/${patientId}/predictions?limit=${limit}`);
    return res.data;
  },

  // Alerts
  getAllAlerts: async (statusFilter?: string, limit = 50): Promise<Alert[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (statusFilter) params.append('status_filter', statusFilter);
    const res = await apiClient.get<Alert[]>(`/alerts?${params.toString()}`);
    return res.data;
  },
  getAlerts: async (patientId: string): Promise<Alert[]> => {
    const res = await apiClient.get<Alert[]>(`/patients/${patientId}/alerts`);
    return res.data;
  },
  acknowledgeAlert: async (alertId: string, clinician = 'Dr. Clinician'): Promise<Alert> => {
    const res = await apiClient.post<Alert>(`/alerts/${alertId}/acknowledge`, {
      acknowledged_by: clinician,
    });
    return res.data;
  },

  // Replay & Real-time Dataset Streaming
  getReplayStatus: async (): Promise<ReplayStatus> => {
    const res = await apiClient.get<ReplayStatus>('/replay/status');
    return res.data;
  },
  getReplayDatasets: async (): Promise<any> => {
    const res = await apiClient.get('/replay/datasets');
    return res.data;
  },
  startReplay: async (patientId: string, speed = 1.0, source = 'physionet_2012', loop = true): Promise<ReplayStatus> => {
    const res = await apiClient.post<ReplayStatus>('/replay/start', {
      patient_id: patientId,
      speed,
      source,
      loop,
    });
    return res.data;
  },
  pauseReplay: async (): Promise<ReplayStatus> => {
    const res = await apiClient.post<ReplayStatus>('/replay/pause');
    return res.data;
  },
  resumeReplay: async (): Promise<ReplayStatus> => {
    const res = await apiClient.post<ReplayStatus>('/replay/resume');
    return res.data;
  },
  stopReplay: async (): Promise<ReplayStatus> => {
    const res = await apiClient.post<ReplayStatus>('/replay/stop');
    return res.data;
  },

  // SMTP Notifications
  getSmtpStatus: async (): Promise<any> => {
    const res = await apiClient.get('/alerts/smtp-status');
    return res.data;
  },
  sendTestSmtpAlert: async (recipients?: string[]): Promise<any> => {
    const res = await apiClient.post('/alerts/test-smtp', { recipients });
    return res.data;
  },
};

export interface ReplayStatus {
  is_running: boolean;
  is_paused: boolean;
  patient_id: string;
  source: string;
  speed: number;
  sent_count: number;
  current_step: number;
  total_records: number;
  last_reading: any;
}
