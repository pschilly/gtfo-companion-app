import React, { useEffect, useState } from 'react';
import {
  AirplaneTilt,
  ArrowSquareOut,
  Calendar,
  CaretDown,
  CaretUp,
  Certificate,
  CheckCircle,
  ShieldCheck,
  Sparkle,
  UserCheck,
} from '@phosphor-icons/react';
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
  const { memberProfile, highlightedCertId } = useApp();
  const [expandedCertIds, setExpandedCertIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (highlightedCertId) {
      setExpandedCertIds((prev) => ({ ...prev, [highlightedCertId]: true }));
      setTimeout(() => {
        const el = document.getElementById(`cert-card-${highlightedCertId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [highlightedCertId]);

  const certificates = memberProfile.certificates || [];
  const totalCertXp = certificates.reduce((sum, c) => sum + (c.xpValue || 0), 0);

  // Find unique airframes represented across earned certificates
  const certifiedAirframes = Array.from(
    new Set(certificates.map((c) => c.airframe).filter(Boolean))
  );

  const toggleCert = (id: number) => {
    setExpandedCertIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    certificates.forEach((c) => {
      all[c.id] = true;
    });
    setExpandedCertIds(all);
  };

  const collapseAll = () => {
    setExpandedCertIds({});
  };

  const isAllExpanded = certificates.length > 0 && certificates.every((c) => expandedCertIds[c.id]);

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub NavigationArrow */}
      <DossierNav />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Certifications &amp; Credentials
            </h1>
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
              {certificates.length} ISSUED
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Official flight qualifications, operational authorizations, and certifications received by{' '}
            <strong className="text-stone-200">{memberProfile.callsign}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {certificates.length > 0 && (
            <button
              onClick={isAllExpanded ? collapseAll : expandAll}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
            >
              {isAllExpanded ? (
                <>
                  <CaretUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <CaretDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expand All</span>
                </>
              )}
            </button>
          )}

          <a
            href={STATIC_CONFIG.kbUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>Training Syllabus</span>
            <ArrowSquareOut className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Summary KPI Strip: Focused purely on what they have earned */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Certificates Earned</p>
            <p className="text-2xl font-bold font-display text-amber-400 mt-1">
              {certificates.length}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Active flight authorizations
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Certificate className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Certification XP</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              +{totalCertXp.toLocaleString()} XP
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Awarded towards grade promotion
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkle className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Certified Platforms</p>
            <p className="text-2xl font-bold font-display text-stone-100 mt-1">
              {certifiedAirframes.length} {certifiedAirframes.length === 1 ? 'Airframe' : 'Airframes'}
            </p>
            <p className="text-[11px] font-mono text-stone-400 truncate max-w-[180px] mt-0.5">
              {certifiedAirframes.join(', ') || 'None'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
            <AirplaneTilt className="w-5 h-5 text-stone-300" />
          </div>
        </div>
      </div>

      {/* Received Certificates List */}
      {certificates.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
          <Certificate className="w-10 h-10 text-stone-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-stone-100">
              No Certificates Recorded
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              You do not have any issued certificates recorded yet. Complete flight checkrides and training batteries with your squadron instructors to receive your qualifications.
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
              <ArrowSquareOut className="w-3.5 h-3.5" />
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
                id={`cert-card-${cert.id}`}
                className={`p-6 rounded-2xl bg-stone-900/90 border transition-all space-y-4 shadow-xl ${
                  highlightedCertId === cert.id
                    ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/10'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div
                  onClick={() => hasRequirements && toggleCert(cert.id)}
                  className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 select-none ${
                    hasRequirements ? 'cursor-pointer group' : ''
                  }`}
                >
                  {/* Left: Certificate Crest & Core Identity */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-stone-950 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-7 h-7 text-amber-400" />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-xs font-bold text-amber-300">
                          {cert.code}
                        </span>
                        <h2 className="font-display font-bold text-stone-100 text-lg group-hover:text-amber-200 transition-colors">
                          {cert.name}
                        </h2>
                        {cert.isIssued && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>ISSUED</span>
                          </span>
                        )}
                      </div>

                      {/* Metadata badges: Airframe, Role, Issued Date, Issued By */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-stone-400">
                        {cert.airframe && (
                          <span className="inline-flex items-center gap-1.5 text-stone-300">
                            <AirplaneTilt className="w-3.5 h-3.5 text-amber-400" />
                            <span>{cert.airframe}</span>
                          </span>
                        )}

                        {cert.awardedRole && (
                          <span className="inline-flex items-center gap-1.5 text-stone-300 capitalize">
                            <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                            <span>Role: {cert.awardedRole}</span>
                          </span>
                        )}

                        {cert.issuedAt && (
                          <span className="inline-flex items-center gap-1.5 text-stone-400">
                            <Calendar className="w-3.5 h-3.5 text-stone-500" />
                            <span>Issued {formatShortDate(cert.issuedAt)}</span>
                          </span>
                        )}

                        {cert.issuedBy && (
                          <span className="text-stone-400">
                            by <strong className="text-stone-300">{cert.issuedBy}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: XP Earned Badge & Expand/Collapse Toggle Button */}
                  <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                    <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shadow-sm">
                      +{cert.xpValue?.toLocaleString() || 0} XP
                    </span>

                    {hasRequirements && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCert(cert.id);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all shadow-sm ${
                          isExpanded
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-stone-950/80 hover:bg-stone-800 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                        title={isExpanded ? 'Collapse syllabus benchmarks' : 'Expand syllabus benchmarks'}
                      >
                        <span className="text-[11px] hidden sm:inline">
                          {isExpanded ? 'Hide Syllabus' : 'View Syllabus'}
                        </span>
                        {isExpanded ? (
                          <CaretUp className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <CaretDown className="w-3.5 h-3.5 text-stone-400" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Subdued Syllabus / Benchmarks Details (Collapsible & secondary) */}
                {isExpanded && hasRequirements && (
                  <div className="pt-3 border-t border-stone-800/80 space-y-3">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold">
                      Recorded Benchmarks &amp; Skills:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {cert.requirements!.map((req, rIdx) => (
                        <div
                          key={rIdx}
                          className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/80 space-y-2 text-xs"
                        >
                          <div className="flex items-center gap-2 font-mono font-bold text-amber-300 text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{req.skill}</span>
                          </div>
                          {req.benchmarks && (
                            <div className="pl-5 pt-0.5 border-l-2 border-stone-800 ml-1.5">
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
