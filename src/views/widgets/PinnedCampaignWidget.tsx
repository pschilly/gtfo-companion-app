import React from 'react';
import {
  AirplaneTakeoff,
  ArrowRight,
  Crosshair,
  Package,
  PushPin,
  PushPinSlash,
  Target,
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { HomeWidgetProps } from './types';

export const PinnedCampaignWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const {
    campaignsList,
    pinnedCampaignId,
    pinCampaignToHome,
    setSelectedCampaignId,
    setActiveTab,
    isLoadingCampaigns,
  } = useApp();

  const isWide = colSpan === 12;
  const maxMissions = isWide ? 4 : 2;
  const activeCampaigns = campaignsList.filter((c) => c.isActive);

  const campaign =
    (pinnedCampaignId
      ? activeCampaigns.find((c) => c.id === pinnedCampaignId)
      : undefined) ||
    activeCampaigns[0] ||
    null;

  const isExplicitlyPinned = Boolean(
    campaign && pinnedCampaignId && campaign.id === pinnedCampaignId
  );

  const handleOpenCampaign = () => {
    if (campaign) {
      setSelectedCampaignId(campaign.id);
    }
    setActiveTab('campaigns');
  };

  if (!campaign) {
    return (
      <>
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Crosshair className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                  Pinned Campaign Overview
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  S2 - Operations theater summary
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('campaigns')}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <span>Campaigns</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
            {isLoadingCampaigns
              ? 'Loading ongoing campaign data from portal...'
              : 'No active operational campaigns found.'}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
          <span>S2 - Operations</span>
          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className="text-amber-400 hover:text-amber-300 font-bold"
          >
            Open Campaigns &rarr;
          </button>
        </div>
      </>
    );
  }

  const missionsSlice = campaign.activeMissions.slice(0, maxMissions);

  return (
    <>
      <div className="space-y-4">
        {/* Widget Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-800 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            {campaign.coverImageUrl ? (
              <img
                src={campaign.coverImageUrl}
                alt={campaign.name}
                className="w-9 h-9 rounded-xl object-contain bg-stone-950 border border-stone-800 p-0.5 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-black text-xs shrink-0">
                {campaign.abbreviation}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base truncate">
                  {campaign.name}
                </h3>
                {isExplicitlyPinned && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-mono uppercase font-bold shrink-0"
                    title="Pinned campaign"
                  >
                    <PushPin weight="fill" className="w-2.5 h-2.5" />
                    Pinned
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-400 flex-wrap">
                <span className="text-amber-300">{campaign.theatre || 'Active Theatre'}</span>
                {campaign.dcsServer && (
                  <>
                    <span>•</span>
                    <span className="text-sky-300 truncate max-w-[140px]">
                      {campaign.dcsServer}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeCampaigns.length > 1 && (
              <select
                value={campaign.id}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isFinite(val) && val > 0) {
                    pinCampaignToHome(val);
                  }
                }}
                aria-label="Select pinned campaign"
                className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-200 focus:outline-none focus:border-amber-500/50 max-w-[155px]"
              >
                {activeCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => pinCampaignToHome(null)}
              title="Unpin campaign from Home dashboard"
              aria-label="Unpin campaign from Home dashboard"
              className="px-2 py-1 rounded-lg bg-stone-950 hover:bg-red-500/20 border border-stone-800 hover:border-red-500/40 text-stone-400 hover:text-red-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
            >
              <PushPinSlash className="w-3 h-3" />
              <span>Unpin</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCampaign}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <span>Overview</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Operational Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-stone-300 flex items-center gap-1 font-semibold">
              <Target weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
              Operational Progress
            </span>
            <span className="text-stone-400">
              {campaign.totalObjectivesCount > 0 ? (
                <>
                  <strong className="text-amber-300">{campaign.completedObjectivesCount}</strong>/
                  {campaign.totalObjectivesCount} obj &bull;{' '}
                </>
              ) : null}
              <strong className="text-amber-300">{campaign.progressPercentage}%</strong>
            </span>
          </div>

          <div className="h-2.5 rounded-full bg-stone-950 border border-stone-800 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, campaign.progressPercentage))}%` }}
            />
          </div>
        </div>

        {/* 4-Column Resource Balances */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {campaign.resourcePools.map((pool) => {
            const accentClass =
              pool.key === 'command_points'
                ? 'text-amber-300 border-amber-500/25'
                : pool.key === 'airframe_credits'
                ? 'text-sky-300 border-sky-500/25'
                : pool.key === 'isr_credits'
                ? 'text-emerald-300 border-emerald-500/25'
                : 'text-purple-300 border-purple-500/25';

            return (
              <div
                key={pool.key}
                className={`p-2.5 rounded-xl bg-stone-950/70 border ${accentClass} flex flex-col justify-between`}
                title={pool.label}
              >
                <span className="text-[10px] font-mono text-stone-400 uppercase truncate">
                  {pool.shortLabel}
                </span>
                <span className="text-sm font-mono font-black mt-0.5">
                  {pool.balance.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Active Missions Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span className="flex items-center gap-1.5 font-semibold text-stone-300">
              <AirplaneTakeoff weight="duotone" className="w-3.5 h-3.5 text-sky-400" />
              Active Missions ({campaign.activeMissions.length})
            </span>
            {campaign.pendingSupplyOrdersCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                <Package className="w-3 h-3" />
                {campaign.pendingSupplyOrdersCount} supply
              </span>
            )}
          </div>

          {missionsSlice.length > 0 ? (
            <div className={isWide ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : 'space-y-2'}>
              {missionsSlice.map((mission) => (
                <div
                  key={mission.id}
                  onClick={handleOpenCampaign}
                  className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition-all cursor-pointer group flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {mission.statusLabel}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        {mission.taskingName}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-stone-100 group-hover:text-amber-300 transition truncate mt-1">
                      {mission.name}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-stone-400 shrink-0">
                    {mission.flightsCount} flt
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-[11px] font-mono text-stone-500 rounded-xl border border-dashed border-stone-800">
              No active missions currently scheduled.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
        <span>
          {campaign.pendingSupplyOrdersCount} pending supply shipment
          {campaign.pendingSupplyOrdersCount === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={handleOpenCampaign}
          className="text-amber-400 hover:text-amber-300 font-bold"
        >
          Open Campaign Overview &rarr;
        </button>
      </div>
    </>
  );
};
