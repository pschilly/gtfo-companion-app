import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { DossierNav } from '../components/DossierNav';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { formatShortDate } from '../utils/formatters';

const HtmlRenderer: React.FC<{ html: string; className?: string }> = ({ html, className = '' }) => {
  if (!html) return null;
  return (
    <div
      className={`prose prose-invert prose-xs max-w-none text-stone-300 leading-relaxed [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5 [&_strong]:text-amber-300 [&_em]:text-stone-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const QualificationsView: React.FC = () => {
  const { memberProfile } = useApp();
  const [expandedCertIds, setExpandedCertIds] = useState<Record<number, boolean>>({});

  const certificates = memberProfile.certificates || [];
  const totalCertXp = certificates.reduce((sum, c) => sum + (c.xpValue || 0), 0);
  const totalHops = certificates.reduce(
    (sum, c) => sum + (c.requirements?.length || 0),
    0
  );

  const toggleCert = (id: number) => {
    setExpandedCertIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allExpanded = certificates.reduce((acc, c) => {
      acc[c.id] = true;
      return acc;
    }, {} as Record<number, boolean>);
    setExpandedCertIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedCertIds({});
  };

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub Navigation */}
      <DossierNav />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Qualifications &amp; Training Syllabus
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
              {certificates.length} CERTIFICATE{certificates.length === 1 ? '' : 'S'}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Documented combat training batteries, HOP benchmarks, and squadron operational authorizations for{' '}
            <strong className="text-stone-200">{memberProfile.callsign}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {certificates.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-900 border border-stone-800 text-xs font-mono">
              <button
                onClick={expandAll}
                className="px-2.5 py-1 rounded-lg hover:bg-stone-800 text-stone-300 transition-colors"
              >
                Expand All
              </button>
              <span className="text-stone-600">|</span>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg hover:bg-stone-800 text-stone-300 transition-colors"
              >
                Collapse All
              </button>
            </div>
          )}

          <a
            href={STATIC_CONFIG.kbUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Training Syllabus</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Certificates</p>
            <p className="text-2xl font-bold font-display text-amber-400 mt-1">
              {certificates.length}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Issued and recorded
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Syllabus XP Value</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              +{totalCertXp.toLocaleString()} XP
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Accumulated qualification XP
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Training Batteries (HOPs)</p>
            <p className="text-2xl font-bold font-display text-stone-100 mt-1">
              {totalHops} Batteries
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Skills &amp; benchmarks verified
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-stone-300" />
          </div>
        </div>
      </div>

      {/* Certificates List */}
      {certificates.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
          <FileCheck2 className="w-10 h-10 text-stone-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-stone-100">
              No Certificates Recorded
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Progress through your squadron HOP training batteries to unlock flight lead, wingman, and specialized combat qualifications.
            </p>
          </div>
          <div className="pt-2">
            <a
              href={STATIC_CONFIG.kbUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs shadow"
            >
              <span>Explore Syllabus Requirements</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => {
            const isExpanded = Boolean(expandedCertIds[cert.id]);
            const hasRequirements = cert.requirements && cert.requirements.length > 0;

            return (
              <div
                key={cert.id}
                className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-stone-700 transition-all space-y-4 shadow-xl"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <FileCheck2 className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-xs font-bold text-amber-300">
                          {cert.code}
                        </span>
                        <h3 className="font-display font-bold text-stone-100 text-lg">
                          {cert.name}
                        </h3>
                        {cert.isIssued && (
                          <span className="px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                            ISSUED
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-stone-400">
                        Airframe: <strong className="text-stone-200">{cert.airframe}</strong>
                        {cert.issuedAt && ` • Issued ${formatShortDate(cert.issuedAt)}`}
                        {cert.issuedBy && ` by ${cert.issuedBy}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold shadow-sm">
                      +{cert.xpValue.toLocaleString()} XP
                    </span>
                    {hasRequirements && (
                      <button
                        onClick={() => toggleCert(cert.id)}
                        className="px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-mono font-medium flex items-center gap-2 transition-colors"
                      >
                        <GraduationCap className="w-4 h-4 text-amber-400" />
                        <span>{isExpanded ? 'Hide Syllabus' : `View Syllabus (${cert.requirements!.length} HOPs)`}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {cert.description && (
                  <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800/80 text-xs text-stone-300">
                    <HtmlRenderer html={cert.description} />
                  </div>
                )}

                {/* Expanded HOP Battery & Benchmarks */}
                {isExpanded && hasRequirements && (
                  <div className="pt-2 space-y-3 animate-fadeIn">
                    <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2 px-1">
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                      <span>Syllabus Requirements &amp; Flight Benchmarks ({cert.requirements!.length} HOP Batteries)</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {cert.requirements!.map((req, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-2.5"
                        >
                          <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{req.skill}</span>
                          </div>
                          {req.benchmarks && (
                            <div className="pl-6 pt-1 border-l-2 border-amber-500/20 ml-2">
                              <HtmlRenderer html={req.benchmarks} className="text-xs text-stone-300" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
