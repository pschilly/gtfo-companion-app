import React, { useMemo } from 'react';
import {
  AirplaneTilt,
  ArrowSquareOut,
  GraduationCap,
  PaintBrush,
  ShieldCheck,
  Sparkle,
  Users,
} from '@phosphor-icons/react';
import { DossierNav } from '../components/DossierNav';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { AssetItem, QualifiedAirframe } from '../types';

const normalize = (str?: string | null): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const AIRCRAFT_FAMILIES: Record<string, string[]> = {
  fa18: ['fa18', 'fa18c', 'hornet', 'f18'],
  f16: ['f16', 'f16c', 'viper', 'fightingfalcon'],
  f14: ['f14', 'f14a', 'f14b', 'tomcat'],
  f15: ['f15', 'f15e', 'f15c', 'strikeeagle', 'eagle'],
  a10: ['a10', 'a10c', 'a10cii', 'warthog', 'thunderbolt'],
  ah64: ['ah64', 'ah64d', 'apache'],
  ch47: ['ch47', 'ch47f', 'chinook'],
  uh60: ['uh60', 'uh60l', 'blackhawk'],
};

const findMatchingLivery = (
  airframe: QualifiedAirframe,
  assets: AssetItem[]
): AssetItem | undefined => {
  const normName = normalize(airframe.name);
  const normAbbr = normalize(airframe.abbreviation);
  const normEntity = normalize(airframe.dcsEntity);

  const liveries = assets.filter((a) => a.category === 'livery' && a.imagePreviewUrl);

  // 1. Direct match on aircraftOrModule
  let match = liveries.find((l) => {
    const normMod = normalize(l.aircraftOrModule);
    if (!normMod) return false;
    return (
      normMod === normName ||
      normMod === normEntity ||
      normMod === normAbbr ||
      normName.includes(normMod) ||
      normMod.includes(normName)
    );
  });

  // 2. Target folder match (e.g. "Liveries/FA-18C_hornet/...")
  if (!match) {
    match = liveries.find((l) => {
      const normTarget = normalize(l.targetFolder);
      return (
        (normEntity && normTarget.includes(normEntity)) ||
        (normAbbr && normAbbr.length >= 3 && normTarget.includes(normAbbr))
      );
    });
  }

  // 3. Aircraft family synonyms
  if (!match) {
    for (const keywords of Object.values(AIRCRAFT_FAMILIES)) {
      const matchesAirframe = keywords.some(
        (kw) => normName.includes(kw) || normAbbr.includes(kw) || normEntity.includes(kw)
      );
      if (matchesAirframe) {
        match = liveries.find((l) => {
          const normMod = normalize(l.aircraftOrModule);
          const normTitle = normalize(l.name);
          const normTarget = normalize(l.targetFolder);
          return keywords.some(
            (kw) =>
              normMod.includes(kw) || normTitle.includes(kw) || normTarget.includes(kw)
          );
        });
        if (match) break;
      }
    }
  }

  // 4. Fallback across all assets (mods etc.)
  if (!match) {
    match = assets.find((a) => {
      if (!a.imagePreviewUrl) return false;
      const normMod = normalize(a.aircraftOrModule);
      return (
        normMod &&
        (normMod === normName ||
          normMod === normEntity ||
          normName.includes(normMod) ||
          normMod.includes(normName))
      );
    });
  }

  return match;
};

export const AirframesView: React.FC = () => {
  const { memberProfile, setActiveTab, manifest } = useApp();

  const airframes = memberProfile.qualifiedAirframes || [];
  const primaryAirframe = airframes.find((a) => a.isPrimary) || airframes[0] || null;
  const instructorCount = airframes.filter((a) => a.isInstructor).length;

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub NavigationArrow */}
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
          <ArrowSquareOut className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
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
            <AirplaneTilt className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Certifications</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              {airframes.length}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Campaign Authorized Airframes
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Instructor Status</p>
            <p className="text-2xl font-bold font-display text-purple-300 mt-1">
              {instructorCount > 0 ? `${instructorCount} Endorsement${instructorCount === 1 ? '' : 's'}` : 'Standard Pilot'}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Flight Training Endorsement
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
          <AirplaneTilt className="w-10 h-10 text-stone-500 mx-auto" />
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
              <ArrowSquareOut className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {airframes.map((airframe) => {
            const matchingLivery = findMatchingLivery(airframe, manifest.assets);
            const bgImageUrl = airframe.imageUrl || matchingLivery?.imagePreviewUrl || null;

            return (
              <div
                key={airframe.id}
                className={`group relative rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl ${
                  airframe.isPrimary
                    ? 'border-amber-500/60 shadow-amber-500/10'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
                style={{ minHeight: '220px' }}
              >
                {/* Background Livery Image & Gradients */}
                {bgImageUrl ? (
                  <>
                    <img
                      src={bgImageUrl}
                      alt={airframe.name}
                      className="absolute inset-0 w-full h-full object-cover object-center opacity-75 group-hover:opacity-50 group-hover:scale-105 transition-all duration-700 ease-out"
                      loading="lazy"
                    />
                    {/* Dark gradient overlays to ensure text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/80 to-stone-950/60" />
                    {airframe.isPrimary && (
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-stone-950/40 pointer-events-none" />
                    )}
                    <div className="absolute inset-0 backdrop-blur-[0.5px]" />
                  </>
                ) : (
                  <div
                    className={`absolute inset-0 ${
                      airframe.isPrimary
                        ? 'bg-gradient-to-b from-stone-900/95 via-stone-900/90 to-amber-950/20'
                        : 'bg-stone-900/90'
                    }`}
                  />
                )}

                {/* Relative Card Content */}
                <div className="relative z-10 p-5 flex flex-col justify-between flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-stone-100 text-lg leading-tight truncate drop-shadow-sm">
                            {airframe.name}
                          </h3>
                        </div>
                      </div>

                      {airframe.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-stone-950 text-[10px] font-mono font-extrabold uppercase tracking-wider shrink-0 shadow-md">
                          <Sparkle className="w-3 h-3 text-stone-950" />
                          PRIMARY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges & Optional Livery Link */}
                  <div className="space-y-3 pt-3 border-t border-stone-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {airframe.isPilot && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-semibold backdrop-blur-sm">
                          {airframe.roleLabel || 'Pilot'}
                        </span>
                      )}
                      {airframe.isInstructor && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-xs font-semibold backdrop-blur-sm">
                          Instructor
                        </span>
                      )}
                      {airframe.isCrew && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-xs font-semibold backdrop-blur-sm">
                          Crew
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-stone-950/80 border border-stone-700 text-amber-400 font-mono text-xs uppercase ml-auto font-bold backdrop-blur-sm">
                        {airframe.status}
                      </span>
                    </div>

                    {matchingLivery && (
                      <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-1">
                        <span className="truncate max-w-[200px] text-stone-300/90 flex items-center gap-1.5 text-[11px]">
                          <PaintBrush className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{matchingLivery.name}</span>
                        </span>
                        <button
                          onClick={() => setActiveTab('liveries')}
                          className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 text-[11px] shrink-0 font-semibold"
                        >
                          <span>Hangar</span>
                          <ArrowSquareOut className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
