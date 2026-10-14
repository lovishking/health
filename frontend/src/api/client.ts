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

export const api = {
  // Users / Clinicians
  getUsers: async (): Promise<ClinicianUser[]> => {
    const res = await apiClient.get<ClinicianUser[]>('/users');
    return res.data;
  },
  createUser: async (user: { email: string; display_name?: string; phone_number?: string; role?: string }): Promise<ClinicianUser> => {
    const res = await apiClient.post<ClinicianUser>('/users', user);
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
};
