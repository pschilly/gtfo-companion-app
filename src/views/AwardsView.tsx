import React, { useMemo, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  Medal,
  Shield,
  Sparkle,
  Star,
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

export const AwardsView: React.FC = () => {
  const { memberProfile } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const awards = memberProfile.awards || [];
  const totalAwardXp = awards.reduce((sum, a) => sum + (a.xpValue || 0), 0);
  const totalSorties = awards.reduce(
    (sum, a) => sum + (a.issuances?.length || a.issueCount || 1),
    0
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    awards.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [awards]);

  const filteredAwards = useMemo(() => {
    if (selectedCategory === 'all') return awards;
    return awards.filter((a) => a.category === selectedCategory);
  }, [awards, selectedCategory]);

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub NavigationArrow */}
      <DossierNav />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Awards &amp; Decorations
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
              {awards.length} COMMENDATION{awards.length === 1 ? '' : 'S'}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Official combat campaign stars, community achievements, and military ribbons authorized for{' '}
            <strong className="text-stone-200">{memberProfile.callsign}</strong>.
          </p>
        </div>

        <a
          href={STATIC_CONFIG.kbUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <span>Awards Criteria</span>
          <ArrowSquareOut className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Authorized Military Ribbon Rack Showcase */}
      {awards.length > 0 && (
        <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800/80">
            <div className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-wider text-amber-400">
              <Medal className="w-4 h-4" />
              <span>Official Ribbon Rack</span>
            </div>
            <span className="text-xs font-mono text-stone-400">
              Authorized for wear • Order of Precedence
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 p-5 rounded-xl bg-stone-950/80 border border-stone-800/80">
            {awards.map((aw) => (
              <div
                key={aw.id}
                className="relative inline-flex items-center justify-center h-9 w-28 rounded bg-stone-950 border border-stone-800 shadow-lg overflow-hidden shrink-0 group cursor-help transition-transform hover:scale-110"
                title={`${aw.name} (${aw.category}) — ${aw.issueCount}x Awarded`}
              >
                {aw.ribbonUrl ? (
                  <img
                    src={aw.ribbonUrl}
                    alt={aw.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-amber-600 via-stone-800 to-amber-600 flex items-center justify-center font-mono text-[10px] text-stone-200">
                    {aw.name.slice(0, 8)}
                  </div>
                )}
                {aw.numeralUrl ? (
                  <img
                    src={aw.numeralUrl}
                    alt={`${aw.issueCount}`}
                    className="absolute h-6 w-auto object-contain drop-shadow-md pointer-events-none"
                  />
                ) : aw.issueCount > 1 ? (
                  <span className="absolute px-1.5 py-0.2 rounded bg-black/80 text-amber-300 font-mono font-bold text-[10px] drop-shadow-md border border-stone-700">
                    {aw.issueCount}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Decorations</p>
            <p className="text-2xl font-bold font-display text-amber-400 mt-1">
              {awards.length}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Authorized awards on record
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Medal className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Commendation XP</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              +{totalAwardXp.toLocaleString()} XP
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Milestone &amp; campaign bonuses
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Sparkle className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Sorties &amp; Citations</p>
            <p className="text-2xl font-bold font-display text-stone-100 mt-1">
              {totalSorties} Recorded
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Campaign &amp; mission issuances
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
            <Medal className="w-5 h-5 text-stone-300" />
          </div>
        </div>
      </div>

      {/* Category Funnel Tabs */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
            }`}
          >
            All Categories ({awards.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-stone-950 font-bold shadow'
                  : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
              }`}
            >
              {cat} ({awards.filter((a) => a.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Medal Cards Grid */}
      {filteredAwards.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
          <Medal className="w-10 h-10 text-stone-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-stone-100">
              No Awards Recorded
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Participate in community operations, tactical campaigns, and mission development to earn commendations.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredAwards.map((aw) => (
            <div
              key={aw.id}
              className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-stone-700 transition-all flex flex-col justify-between space-y-4 shadow-xl"
            >
              <div className="flex items-start gap-5">
                {aw.medalUrl ? (
                  <div className="w-20 h-28 rounded-xl bg-stone-950 border border-stone-800 p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                    <img
                      src={aw.medalUrl}
                      alt={aw.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : aw.ribbonUrl ? (
                  <div className="h-9 w-28 rounded bg-stone-950 border border-stone-800 shrink-0 overflow-hidden shadow">
                    <img
                      src={aw.ribbonUrl}
                      alt={aw.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Medal className="w-7 h-7 text-amber-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[10px] font-mono text-amber-300 uppercase font-semibold">
                      {aw.category}
                    </span>
                    {aw.issueCount > 1 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold">
                        {aw.issueCount}x Awarded
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold ml-auto">
                      +{aw.xpValue.toLocaleString()} XP
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-stone-100 text-base leading-snug">
                    {aw.name}
                  </h3>

                  {aw.description && (
                    <div className="text-xs text-stone-300 pt-1">
                      <HtmlRenderer html={aw.description} />
                    </div>
                  )}

                  {aw.requirements && aw.requirements.length > 0 && (
                    <div className="pt-2 border-t border-stone-800/60 space-y-1">
                      <p className="text-[10px] font-mono uppercase text-stone-500">Requirements</p>
                      <ul className="space-y-0.5 text-xs text-stone-400">
                        {aw.requirements.map((r, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-1.5">
                            <span className="text-amber-400">•</span>
                            <span>{r.requirement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-stone-400 gap-2">
                <span>
                  Issued {formatShortDate(aw.issuedAt)}
                  {aw.issuedBy ? ` by ${aw.issuedBy}` : ''}
                </span>
                {aw.issuances && aw.issuances.length > 1 && (
                  <span className="text-amber-400 font-semibold">
                    {aw.issuances.length} sorties recorded
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
