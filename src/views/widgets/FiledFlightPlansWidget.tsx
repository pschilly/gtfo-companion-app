import React from 'react';
import { ArrowRight, Compass } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const FiledFlightPlansWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const { filedFlightPlans, setSelectedFlightPlanId, setActiveTab } = useApp();
  const { maxListCount, listContainerClass } = getWidgetListLayout(colSpan);
  const plansSlice = filedFlightPlans.slice(0, maxListCount);

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                Recently Filed Flight Plans
              </h3>
              <p className="text-[11px] font-mono text-stone-400">
                Active ATC route clearances
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('atc')}
            className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
          >
            <span>View ATC</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {plansSlice.length > 0 ? (
          <div className={listContainerClass}>
            {plansSlice.map((plan) => {
              const dep = plan.departure_airfield || 'DEP';
              const arr = plan.destination_airfield || 'ARR';
              const callsign = plan.callsign || plan.name || 'Flight';
              const afLabel = plan.airframe?.abbreviation || plan.airframe?.name;
              const pilotName = plan.creator?.callsign || plan.creator?.name || 'Pilot';
              const missionLabel = plan.mission?.name || plan.sortie?.name || 'Operation';

              return (
                <div
                  key={plan.id}
                  onClick={() => {
                    setSelectedFlightPlanId(plan.id || plan.identifier);
                    setActiveTab('atc');
                  }}
                  className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-sky-500/40 transition-all cursor-pointer group flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0">
                        {plan.identifier || `FP-${plan.id}`}
                      </span>
                      <span className="font-mono font-bold text-xs text-stone-100 group-hover:text-sky-400 transition truncate">
                        {callsign}
                      </span>
                      {afLabel && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-800 text-stone-300 shrink-0">
                          {afLabel}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-stone-400 shrink-0 truncate max-w-[120px]">
                      {missionLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                    <div className="flex items-center gap-1.5 text-stone-200">
                      <span className="font-bold">{dep}</span>
                      <ArrowRight className="w-3 h-3 text-stone-500" />
                      <span className="font-bold">{arr}</span>
                    </div>
                    <span className="text-stone-400 truncate max-w-[140px]">
                      Pilot: <strong className="text-stone-200">{pilotName}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
            No filed flight plans on active frequency.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
        <span>DTC &amp; Kneeboard downloads ready</span>
        <button
          onClick={() => setActiveTab('atc')}
          className="text-sky-400 hover:text-sky-300 font-bold"
        >
          Open Air Traffic &rarr;
        </button>
      </div>
    </>
  );
};
