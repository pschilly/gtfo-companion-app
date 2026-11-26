import React from 'react';
import { AirplaneTilt, ArrowRight } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const QualifiedAirframesWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const { memberProfile, setActiveTab } = useApp();
  const { maxListCount, listContainerClass } = getWidgetListLayout(colSpan);
  const airframesSlice = (memberProfile.qualifiedAirframes || []).slice(0, maxListCount);

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <AirplaneTilt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-base">
                Qualified Airframes
              </h3>
              <p className="text-xs text-stone-400">
                Cleared fleet &amp; flight roles
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('airframes')}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
          >
            <span>View Fleet</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {airframesSlice.length > 0 ? (
          <div className={listContainerClass}>
            {airframesSlice.map((af) => (
              <div
                key={af.id || af.name}
                onClick={() => setActiveTab('airframes')}
                className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-sky-500/40 transition-all cursor-pointer group flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {af.imageUrl ? (
                    <img
                      src={af.imageUrl}
                      alt={af.name}
                      className="w-10 h-10 rounded-xl object-cover bg-stone-900 border border-stone-800 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-sky-400 shrink-0">
                      <AirplaneTilt className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-stone-100 group-hover:text-sky-400 transition truncate">
                        {af.name}
                      </span>
                      {af.isPrimary && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400 truncate">
                      {af.roleLabel || af.role || 'Pilot'}
                      {af.squadron ? ` • ${af.squadron}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {af.isInstructor && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      IP
                    </span>
                  )}
                  {af.isCrew && (
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-stone-800 text-stone-300">
                      CREW
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 py-8 text-center text-xs text-stone-500">
            No qualified airframes recorded yet.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
        <span>
          {(memberProfile.qualifiedAirframes || []).length} qualified platform(s)
        </span>
        <button
          onClick={() => setActiveTab('airframes')}
          className="text-sky-400 hover:text-sky-300 font-semibold"
        >
          Inspect Type Ratings &rarr;
        </button>
      </div>
    </>
  );
};
