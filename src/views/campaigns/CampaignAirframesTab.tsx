import React from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  Compass,
  ShieldChevron,
} from '@phosphor-icons/react';
import { CampaignItem } from '../../types';

interface CampaignAirframesTabProps {
  campaign: CampaignItem;
}

export const CampaignAirframesTab: React.FC<CampaignAirframesTabProps> = ({
  campaign,
}) => {
  const groups = campaign.airframeSquadronGroups || [];
  const totalAll = groups.reduce((sum, g) => sum + (g.totalCount || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Squadron Cards Grid */}
      {groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 p-12 text-center space-y-2">
          <AirplaneTilt className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-stone-200">No Tracked Airframes</h3>
          <p className="text-xs text-stone-400 max-w-md mx-auto">
            No tracked airframes are configured for this campaign yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {groups.map((group, gIdx) => (
            <div
              key={group.id ?? `group-${gIdx}`}
              className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/90 shadow-xl flex flex-col justify-between"
            >
              {/* Squadron Card Header */}
              <div className="p-5 bg-stone-950/70 border-b border-stone-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {group.imageUrl ? (
                    <img
                      src={group.imageUrl}
                      alt={group.name}
                      className="w-14 h-14 object-contain shrink-0 rounded-xl bg-stone-900 p-1 border border-stone-800"
                    />
                  ) : (
                    <div className="w-14 h-14 shrink-0 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                      <ShieldChevron weight="duotone" className="w-7 h-7" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-base text-stone-100 leading-tight truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-400 font-medium flex-wrap">
                      {group.nickname && <span>&ldquo;{group.nickname}&rdquo;</span>}
                      {group.abbreviation && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-stone-800 border border-stone-700 text-stone-300">
                          {group.abbreviation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Squadron Total
                  </div>
                  <div className="text-2xl font-bold font-display tabular-nums text-amber-400">
                    {group.totalCount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Airframes Accounting Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-stone-800 bg-stone-950/40 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Airframe</th>
                      <th className="py-2.5 px-4 text-center">Available</th>
                      <th className="py-2.5 px-4">Airbase Stations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/70">
                    {group.airframes.map((item) => {
                      const bases = Object.entries(item.airbaseBreakdown || {});
                      return (
                        <tr
                          key={item.dcsEntity || item.name}
                          className="hover:bg-stone-950/50 transition-colors"
                        >
                          <td className="py-3 px-4 align-top">
                            <div className="font-semibold text-stone-100 leading-tight">
                              {item.name}
                            </div>
                            {item.dcsEntity && item.dcsEntity !== item.name && (
                              <div className="text-[11px] font-mono text-stone-500 mt-0.5">
                                {item.dcsEntity}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 align-top text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                                item.totalCount > 0
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-stone-800 text-stone-400 border border-stone-700'
                              }`}
                            >
                              {item.totalCount}
                            </span>
                          </td>

                          <td className="py-3 px-4 align-top">
                            {bases.length === 0 ? (
                              <span className="text-xs text-stone-500 italic" />
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {bases.map(([baseName, baseQty]) => (
                                  <span
                                    key={baseName}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-stone-950 border border-stone-800 text-stone-300"
                                  >
                                    <span>{baseName}</span>
                                    <span className="font-bold text-amber-300 font-mono">
                                      {baseQty}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
