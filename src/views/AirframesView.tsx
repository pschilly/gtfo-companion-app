import React from 'react';
import {
  ExternalLink,
  GraduationCap,
  Paintbrush,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { DossierNav } from '../components/DossierNav';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';

export const AirframesView: React.FC = () => {
  const { memberProfile, setActiveTab } = useApp();

  const airframes = memberProfile.qualifiedAirframes || [];
  const primaryAirframe = airframes.find((a) => a.isPrimary) || airframes[0] || null;
  const instructorCount = airframes.filter((a) => a.isInstructor).length;

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub Navigation */}
      <DossierNav />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Qualified Airframes
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
              {airframes.length} TYPE RATING{airframes.length === 1 ? '' : 'S'}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Verified DCS airframe certifications, pilot qualifications, and instructor authorizations for{' '}
            <strong className="text-stone-200">{memberProfile.callsign}</strong>.
          </p>
        </div>

        <a
          href={STATIC_CONFIG.kbUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <span>Aviation SOP &amp; Syllabus</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Primary Airframe</p>
            <p className="text-lg font-bold font-display text-amber-300 mt-1 truncate">
              {primaryAirframe?.name || 'Unassigned'}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              {primaryAirframe?.squadron || 'General Community'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Certifications</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              {airframes.length}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Authorized combat-ready types
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Instructor Status</p>
            <p className="text-2xl font-bold font-display text-purple-300 mt-1">
              {instructorCount > 0 ? `${instructorCount} Endorsement${instructorCount === 1 ? '' : 's'}` : 'Standard Pilot'}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Flight training authorization
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Airframes Grid */}
      {airframes.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
          <Plane className="w-10 h-10 text-stone-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-stone-100">
              No Airframe Type Ratings Found
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Complete your initial Check Flight (HOP 1) with an instructor or squadron lead to record your qualified airframe type rating.
            </p>
          </div>
          <div className="pt-2">
            <a
              href={STATIC_CONFIG.kbUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs shadow"
            >
              <span>View GTFO Syllabus in Knowledge Base</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {airframes.map((airframe) => (
            <div
              key={airframe.id}
              className={`p-5 rounded-2xl bg-stone-900/90 border transition-all flex flex-col justify-between space-y-4 hover:shadow-xl ${
                airframe.isPrimary
                  ? 'border-amber-500/50 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-stone-900/95 to-amber-950/10'
                  : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <Plane className="w-4 h-4 text-amber-400" />
                      </div>
                      <h3 className="font-display font-bold text-stone-100 text-base truncate">
                        {airframe.name}
                      </h3>
                    </div>
                    <p className="text-xs font-mono text-stone-400 pl-10">
                      Module: <code className="text-amber-300 font-semibold">{airframe.dcsEntity}</code>
                      {airframe.abbreviation && ` • [${airframe.abbreviation.toUpperCase()}]`}
                    </p>
                  </div>

                  {airframe.isPrimary && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 shadow">
                      <Sparkles className="w-3 h-3 text-stone-950" />
                      PRIMARY
                    </span>
                  )}
                </div>

                {airframe.squadron && (
                  <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800/80 flex items-center gap-2 text-xs font-mono text-stone-300">
                    <Users className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="truncate">Squadron: <strong className="text-stone-100">{airframe.squadron}</strong></span>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-stone-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  {airframe.isPilot && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
                      {airframe.roleLabel || 'Pilot'}
                    </span>
                  )}
                  {airframe.isInstructor && (
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold">
                      Instructor
                    </span>
                  )}
                  {airframe.isCrew && (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-xs font-semibold">
                      Crew
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-amber-400 font-mono text-xs uppercase ml-auto font-bold">
                    {airframe.status}
                  </span>
                </div>

                <button
                  onClick={() => setActiveTab('liveries')}
                  className="w-full py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
                  <span>Browse {airframe.name} Liveries</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
