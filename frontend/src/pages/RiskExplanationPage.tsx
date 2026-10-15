import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Patient, RiskPrediction } from '../types';
import { AlertTriangle, Info, CheckCircle2, FileText } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export const RiskExplanationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const currentPatientId = searchParams.get('patient') || 'DEMO-001';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  const fetchRisk = useCallback(() => {
    setLoading(true);
    api
      .getLatestRisk(currentPatientId)
      .then((data) => {
        setPrediction(data);
        setLastUpdated(new Date());
      })
      .catch(() => setPrediction(null))
      .finally(() => setLoading(false));
  }, [currentPatientId]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  const currentPatientIdRef = useRef(currentPatientId);
  useEffect(() => { currentPatientIdRef.current = currentPatientId; }, [currentPatientId]);

  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'reading_update' && event.patient_id === currentPatientIdRef.current) {
      fetchRisk();
    }
  }, [fetchRisk]);

  useWebSocket(currentPatientId, handleWsEvent);

  let explanationData: any = null;
  if (prediction?.explanation) {
    try {
      explanationData = JSON.parse(prediction.explanation);
    } catch {
      explanationData = { raw: prediction.explanation };
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Risk Assessment & Decision Explanation</h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                {currentPatientId}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Multi-tiered decision pipeline: ML Probability Fusion + Clinical Safety Override
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400">Model Pipeline Version:</span>
            <div className="text-xs font-mono text-slate-700 font-semibold">
              {prediction?.model_version || 'rules_provisional_v1.0'}
            </div>
          </div>
        </div>
      </div>

      {!prediction ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
          <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">No Assessment Data Available</h3>
          <p className="text-xs text-slate-400 mt-1">
            No readings have been evaluated for {currentPatientId} yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Assessment Tier Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Assessed Risk Tier
              </span>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`text-2xl font-bold font-mono px-3 py-1 rounded-xl border ${
                    prediction.final_tier === 'Critical'
                      ? 'bg-rose-100 text-rose-700 border-rose-200 glow-critical'
                      : prediction.final_tier === 'Warning'
                      ? 'bg-amber-100 text-amber-700 border-amber-200 glow-warning'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 glow-stable'
                  }`}
                >
                  {prediction.final_tier}
                </span>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Decision Source</span>
                  <span className="text-xs font-mono font-semibold text-slate-700">
                    {prediction.decision_source}
                  </span>
                </div>
              </div>

              {/* Probabilities Breakdown */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-700">Class Probability Distribution</h4>

                {/* Stable */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Stable</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {prediction.stable_probability !== null ? `${(prediction.stable_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(prediction.stable_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Warning */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Warning</span>
                    <span className="font-mono font-bold text-amber-600">
                      {prediction.warning_probability !== null ? `${(prediction.warning_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(prediction.warning_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Critical */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Critical</span>
                    <span className="font-mono font-bold text-rose-600">
                      {prediction.critical_probability !== null ? `${(prediction.critical_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${(prediction.critical_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 text-[11px] text-slate-400 italic">
                Timestamp: {new Date(prediction.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Triggered Rules & Clinical Explainability */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">Triggered Rules & Feature Contributions</h3>
              </div>

              {explanationData?.triggered_rules && explanationData.triggered_rules.length > 0 ? (
                <div className="space-y-2">
                  {explanationData.triggered_rules.map((rule: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="font-mono text-slate-800">{rule}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  All physiological vital parameters within safe clinical thresholds.
                </div>
              )}

              {/* Research Disclaimer Box */}
              <div className="mt-5 pt-4 border-t border-slate-100 bg-slate-50/70 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                  <Info className="w-3.5 h-3.5 text-sky-600" />
                  Methodological Notes
                </div>
                <p className="leading-relaxed">
                  {explanationData?.clinical_disclaimer ||
                    'Safety override rules enforce non-negotiable alert boundaries regardless of machine-learning output.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  SHAP feature contributions are computed against baseline population training distributions and do not
                  imply direct biological causality.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
