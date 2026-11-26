import React from 'react';
import { ArrowRight, User } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const MyFlightPlansWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const { memberFlightPlans, setSelectedFlightPlanId, setActiveTab } = useApp();
  const { maxListCount, listContainerClass } = getWidgetListLayout(colSpan);
  const myPlansSlice = memberFlightPlans.slice(0, maxListCount);

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-base">
                My Flight Plans
              </h3>
              <p className="text-xs text-stone-400">
                Authored &amp; mission-assigned routes
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('atc')}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>All My Plans</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {myPlansSlice.length > 0 ? (
          <div className={listContainerClass}>
            {myPlansSlice.map((plan) => {
              const dep = plan.departure_airfield || 'DEP';
              const arr = plan.destination_airfield || 'ARR';
              const callsign =
                plan.callsign && plan.name && plan.callsign !== plan.name
                  ? `${plan.callsign} (${plan.name})`
                  : plan.callsign || plan.name || 'Flight';
              const afLabel = plan.airframe?.abbreviation || plan.airframe?.name;
              const wpts = plan.route_summary?.waypoint_count || 0;

              return (
                <div
                  key={plan.id || plan.identifier}
                  onClick={() => {
                    setSelectedFlightPlanId(plan.id || plan.identifier);
                    setActiveTab('atc');
                  }}
                  className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        {plan.identifier || `FP-${plan.id}`}
                      </span>
                      <span className="font-mono font-bold text-xs text-stone-100 group-hover:text-amber-400 transition truncate">
                        {callsign}
                      </span>
                      {afLabel && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-stone-800 text-stone-300 shrink-0">
                          {afLabel}
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 border ${
                        plan.is_filed
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-stone-900 text-stone-400 border-stone-700'
                      }`}
                    >
                      {plan.is_filed ? 'FILED' : 'DRAFT'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <div className="flex items-center gap-1.5 font-mono text-stone-200">
                      <span className="font-bold">{dep}</span>
                      <ArrowRight className="w-3 h-3 text-stone-500" />
                      <span className="font-bold">{arr}</span>
                    </div>
                    <span className="text-stone-400 font-mono shrink-0">
                      {wpts} wpts
                      {plan.is_dtc_compatible ? ' • DTC' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 py-8 text-center text-xs text-stone-500">
            No personal or mission-assigned flight plans found.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
        <span>{memberFlightPlans.length} total plan(s) assigned</span>
        <button
          onClick={() => setActiveTab('atc')}
          className="text-amber-400 hover:text-amber-300 font-semibold"
        >
          Open ATC Workbench &rarr;
        </button>
      </div>
    </>
  );
};
