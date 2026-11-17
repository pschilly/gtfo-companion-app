import React, { useMemo } from 'react';
import { AirplaneTilt, ArrowRight, SquaresFour } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { GTFO_GRADE_META } from '../../data/portalData';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const DossierSummaryWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const { memberProfile, setActiveTab } = useApp();
  const { isWide } = getWidgetListLayout(colSpan);

  const currentGradeMeta = GTFO_GRADE_META[memberProfile.grade] || GTFO_GRADE_META.G1;

  const xpProgressPercent = useMemo(() => {
    if (!memberProfile.nextGrade) return 100;
    if (typeof memberProfile.gradePercentage === 'number' && memberProfile.gradePercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.gradePercentage));
    }
    if (typeof memberProfile.tierPercentage === 'number' && memberProfile.tierPercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.tierPercentage));
    }
    const nextCeiling = memberProfile.nextGrade.xpRequired || 1;
    return Math.min(100, Math.max(4, ((memberProfile.xp || 0) / nextCeiling) * 100));
  }, [memberProfile]);

  const sq = memberProfile.squadronAssignment;
  const certsCount = memberProfile.certificates?.length || 0;
  const awardsCount = memberProfile.awardsCount ?? memberProfile.awards?.length ?? 0;
  const attendanceRate = memberProfile.serviceRecordStats?.rateFormatted || 'N/A';

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <SquaresFour className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                Pilot Dossier &amp; Progression
              </h3>
              <p className="text-[11px] font-mono text-stone-400">
                Rank, XP progress &amp; squadron billet
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Full Dossier</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div
          className={
            isWide ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch' : 'space-y-4'
          }
        >
          {/* Rank & XP Progression */}
          <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={memberProfile.gradeIconUrl || currentGradeMeta.iconUrl}
                  alt={memberProfile.gradeTitle}
                  className="w-11 h-11 object-contain shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-stone-100 truncate">
                    {memberProfile.gradeTitle}
                  </div>
                  <div className="text-[11px] font-mono text-amber-400/90">
                    {memberProfile.xp.toLocaleString()} XP
                    {memberProfile.nextGrade
                      ? ` / ${memberProfile.nextGrade.xpRequired.toLocaleString()} XP`
                      : ' (Max Grade)'}
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                {memberProfile.grade}
              </span>
            </div>

            <div className="space-y-1">
              <div className="h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${xpProgressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                <span>
                  {memberProfile.nextGrade
                    ? `Next: ${memberProfile.nextGrade.grade}`
                    : 'Senior Grade Reached'}
                </span>
                <span>{xpProgressPercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Squadron & Service Metrics */}
          <div className="flex flex-col justify-between gap-2.5">
            <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 flex items-center gap-3">
              {sq?.emblemUrl ? (
                <img
                  src={sq.emblemUrl}
                  alt={sq.name}
                  className="w-10 h-10 object-contain shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 shrink-0">
                  <AirplaneTilt className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-100 truncate">
                  {sq ? `${sq.code} — ${sq.name}` : 'Unassigned Billet'}
                </div>
                <div className="text-[11px] font-mono text-stone-400 truncate">
                  {sq ? `${sq.nickname} • ${sq.role}` : memberProfile.position}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                <div className="text-[9px] font-mono uppercase text-stone-500">Served</div>
                <div className="text-xs font-mono font-bold text-stone-200 mt-0.5">
                  {memberProfile.timeServedLabel || '—'}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                <div className="text-[9px] font-mono uppercase text-stone-500">Certs</div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {certsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                <div className="text-[9px] font-mono uppercase text-stone-500">Awards</div>
                <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                  {awardsCount}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                <div className="text-[9px] font-mono uppercase text-stone-500">Attend</div>
                <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                  {attendanceRate}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
        <span>{memberProfile.rosterTier} Roster Member</span>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="text-amber-400 hover:text-amber-300 font-bold"
        >
          Open Dossier &rarr;
        </button>
      </div>
    </>
  );
};
