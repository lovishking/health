import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Patient, RiskPrediction } from '../types';
import { ShieldAlert, Cpu, AlertTriangle, Info, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

export const RiskExplanationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const currentPatientId = searchParams.get('patient') || 'DEMO-001';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getLatestRisk(currentPatientId)
      .then(setPrediction)
      .catch(() => setPrediction(null))
      .finally(() => setLoading(false));
  }, [currentPatientId]);

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
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Risk Assessment & Decision Explanation</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                {currentPatientId}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-tiered decision pipeline: ML Probability Fusion + Clinical Safety Override
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400">Model Pipeline Version:</span>
            <div className="text-xs font-mono text-slate-200 font-semibold">
              {prediction?.model_version || 'rules_provisional_v1.0'}
            </div>
          </div>
        </div>
      </div>

      {!prediction ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center">
          <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-white">No Assessment Data Available</h3>
          <p className="text-xs text-slate-400 mt-1">
            No readings have been evaluated for {currentPatientId} yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Assessment Tier Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Assessed Risk Tier
              </span>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`text-2xl font-bold font-mono px-3 py-1 rounded-lg border ${
                    prediction.final_tier === 'Critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 glow-critical'
                      : prediction.final_tier === 'Warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 glow-warning'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 glow-stable'
                  }`}
                >
                  {prediction.final_tier}
                </span>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Decision Source</span>
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    {prediction.decision_source}
                  </span>
                </div>
              </div>

              {/* Probabilities Breakdown */}
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300">Class Probability Distribution</h4>

                {/* Stable */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Stable</span>
                    <span className="font-mono text-emerald-400">
                      {prediction.stable_probability !== null ? `${(prediction.stable_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(prediction.stable_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Warning */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Warning</span>
                    <span className="font-mono text-amber-400">
                      {prediction.warning_probability !== null ? `${(prediction.warning_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${(prediction.warning_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Critical */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Critical</span>
                    <span className="font-mono text-red-400">
                      {prediction.critical_probability !== null ? `${(prediction.critical_probability! * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${(prediction.critical_probability || 0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 text-[11px] text-slate-500 italic">
                Timestamp: {new Date(prediction.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Triggered Rules & Clinical Explainability */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">Triggered Rules & Feature Contributions</h3>
              </div>

              {explanationData?.triggered_rules && explanationData.triggered_rules.length > 0 ? (
                <div className="space-y-2">
                  {explanationData.triggered_rules.map((rule: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="font-mono text-slate-200">{rule}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  All physiological vital parameters within safe clinical thresholds.
                </div>
              )}

              {/* Research Disclaimer Box */}
              <div className="mt-5 pt-4 border-t border-slate-800 bg-slate-950/40 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
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
