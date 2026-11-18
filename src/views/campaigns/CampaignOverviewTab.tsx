import React from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowRight,
  ArrowSquareOut,
  Binoculars,
  BookOpen,
  CheckCircle,
  Clock,
  Coins,
  MapTrifold,
  Package,
  PushPin,
  PushPinSlash,
  Receipt,
  Target,
  HardDriveIcon,
  MapTrifoldIcon,
} from '@phosphor-icons/react';
import {
  CampaignItem,
  CampaignMissionItem,
  CampaignResourcePool,
  CampaignSubTab,
} from '../../types';
import { MissionModalSection } from './CampaignMissionModal';
import {
  formatDateTimeShort,
  formatZuluShort,
  getCampaignAarCount,
  getCampaignTotalIntelCount,
  getMissionStatusBadgeClasses,
  getStatusBadgeClasses,
  renderResourceIcon,
  RESOURCE_STYLE_MAP,
} from './utils';

interface CampaignOverviewTabProps {
  campaign: CampaignItem;
  isPinned: boolean;
  onTogglePin: () => void;
  onOpenExternal: (url?: string | null, fallbackPath?: string) => void;
  onNavigateSubTab: (subTab: CampaignSubTab) => void;
  onInspectMission: (mission: CampaignMissionItem, section?: MissionModalSection) => void;
}

export const CampaignOverviewTab: React.FC<CampaignOverviewTabProps> = ({
  campaign,
  isPinned,
  onTogglePin,
  onOpenExternal,
  onNavigateSubTab,
  onInspectMission,
}) => {
  return (
    <div className="space-y-6">
      {/* ==================== TOP HERO & PROGRESS BANNER ==================== */}
      <div className="relative overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/90 p-5 sm:p-6 shadow-xl space-y-5">
        <div className="space-y-4 border-b border-stone-800/80 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
              {campaign.coverImageUrl ? (
                <img
                  src={campaign.coverImageUrl}
                  alt={campaign.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-contain bg-stone-950/90 border border-stone-800 p-1.5 shrink-0 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-2xl text-amber-300 shrink-0 shadow-lg">
                  {campaign.abbreviation}
                </div>
              )}

              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border flex items-center gap-1 ${getStatusBadgeClasses(
                      campaign.statusColor
                    )}`}
                  >
                    {campaign.statusLabel}
                  </span>

                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <MapTrifoldIcon className="size-4 inline mr-1" />
                    {campaign.theatre || 'Active Theatre'}
                  </span>

                  {campaign.era && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-stone-800 text-stone-300 border border-stone-700">
                      {campaign.era} ERA
                    </span>
                  )}
                </div>

                <h2 className="font-display text-2xl font-black text-stone-100 tracking-wide">
                  {campaign.name}
                </h2>

                {campaign.isCompleted && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium w-fit">
                    <CheckCircle weight="duotone" className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Campaign Completed</strong>
                      {campaign.endedAt && ` on ${formatDateTimeShort(campaign.endedAt)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onTogglePin}
                title={
                  isPinned
                    ? 'Remove pinned campaign widget from Home dashboard'
                    : 'Pin this campaign to your Home dashboard'
                }
                className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  isPinned
                    ? 'bg-amber-500/20 hover:bg-red-500/20 border-amber-500/50 hover:border-red-500/50 text-amber-300 hover:text-red-300'
                    : 'bg-stone-950 hover:bg-stone-800 border-stone-700 hover:border-amber-500/40 text-stone-200 hover:text-amber-300'
                }`}
              >
                {isPinned ? (
                  <>
                    <PushPinSlash className="w-4 h-4" />
                    <span>Unpin from Home</span>
                  </>
                ) : (
                  <>
                    <PushPin className="w-4 h-4 text-amber-400" />
                    <span>Pin to Home</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenExternal(campaign.mapUrl, `/campaigns/${campaign.slug}/map`)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
              >
                <MapTrifold weight="duotone" className="w-4 h-4" />
                <span>Interactive Map</span>
                <ArrowSquareOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onOpenExternal(campaign.portalUrl, `/campaigns/${campaign.slug}`)}
                className="px-3 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                title="Open full campaign page on Member Portal"
              >
                <span>Portal</span>
                <ArrowSquareOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full">
            {campaign.descriptionHtml ? (
              <div
                className="prose prose-invert prose-stone w-full max-w-none text-xs sm:text-sm text-stone-300 leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-amber-300"
                dangerouslySetInnerHTML={{ __html: campaign.descriptionHtml }}
              />
            ) : campaign.descriptionSummary ? (
              <p className="w-full max-w-none text-xs sm:text-sm text-stone-300 leading-relaxed">
                {campaign.descriptionSummary}
              </p>
            ) : (
              <p className="w-full max-w-none text-xs text-stone-500 italic">
                No campaign tactical briefing description provided.
              </p>
            )}
          </div>
        </div>

        {/* Campaign Operational Progress Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target weight="duotone" className="w-4 h-4 text-amber-400" />
              <span>Campaign Operational Progress</span>
            </span>

            <div className="flex items-center gap-3 font-mono text-[11px] text-stone-400">
              {campaign.targetMissions > 0 && (
                <span>
                  <strong className="text-stone-200">{campaign.earnedMissionPoints}</strong> /{' '}
                  {campaign.targetMissions} Mission Pts
                </span>
              )}
              {campaign.totalObjectivesCount > 0 && (
                <span>
                  <strong className="text-amber-400">{campaign.completedObjectivesCount}</strong> /{' '}
                  {campaign.totalObjectivesCount} Objectives Complete
                </span>
              )}
            </div>
          </div>

          <div className="relative h-6 bg-stone-950 border border-stone-800 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-amber-400 transition-all duration-500 ease-in-out rounded-full shadow-lg"
              style={{ width: `${Math.min(100, Math.max(0, campaign.progressPercentage))}%` }}
              role="progressbar"
              aria-valuenow={campaign.progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <div
              className={`absolute inset-0 flex items-center justify-center text-xs font-black font-mono tracking-wider select-none ${
                campaign.progressPercentage >= 48 ? 'text-stone-950' : 'text-stone-100'
              }`}
            >
              {campaign.progressPercentage}%
            </div>
          </div>
        </div>

        {/* Quick Links to Campaign Sub-Pages */}
        <div className="pt-2 border-t border-stone-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateSubTab('lore')}
            className="p-3 rounded-2xl bg-stone-950/70 hover:bg-stone-950 border border-stone-800 hover:border-amber-500/40 text-left transition-all group flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <BookOpen weight="duotone" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-100 group-hover:text-amber-300 truncate">
                  Campaign Lore
                </div>
                <div className="text-[10px] font-mono text-stone-400">
                  {campaign.loresCount} chapter{campaign.loresCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateSubTab('missions')}
            className="p-3 rounded-2xl bg-stone-950/70 hover:bg-stone-950 border border-stone-800 hover:border-sky-500/40 text-left transition-all group flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <AirplaneTakeoff weight="duotone" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-100 group-hover:text-sky-300 truncate">
                  Missions
                </div>
                <div className="text-[10px] font-mono text-stone-400">
                  {campaign.missions.length} total ({campaign.activeMissionsCount} active)
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-sky-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateSubTab('intel')}
            className="p-3 rounded-2xl bg-stone-950/70 hover:bg-stone-950 border border-stone-800 hover:border-emerald-500/40 text-left transition-all group flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Binoculars weight="duotone" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-100 group-hover:text-emerald-300 truncate">
                  Intel Reports
                </div>
                <div className="text-[10px] font-mono text-stone-400">
                  {(() => {
                    const totalIntelCount = getCampaignTotalIntelCount(campaign);
                    const aarCount = getCampaignAarCount(campaign);
                    return (
                      <>
                        {totalIntelCount} report{totalIntelCount === 1 ? '' : 's'}
                        {aarCount > 0 ? ` (${aarCount} AAR)` : ''}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-emerald-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateSubTab('airframes')}
            className="p-3 rounded-2xl bg-stone-950/70 hover:bg-stone-950 border border-stone-800 hover:border-purple-500/40 text-left transition-all group flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <AirplaneTilt weight="duotone" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-stone-100 group-hover:text-purple-300 truncate">
                  Airframes
                </div>
                <div className="text-[10px] font-mono text-stone-400">
                  {campaign.airframeSquadronGroups.length} squadron
                  {campaign.airframeSquadronGroups.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-purple-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* ==================== RESOURCE BALANCE STAT CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {campaign.resourcePools.map((pool: CampaignResourcePool) => {
          const style = RESOURCE_STYLE_MAP[pool.key] || RESOURCE_STYLE_MAP.command_points;
          return (
            <div
              key={pool.key}
              title={pool.description}
              className={`relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} p-4 shadow-lg flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-stone-300 uppercase tracking-wider truncate">
                  {pool.label}
                </span>
                <div className={`p-2 rounded-xl border shrink-0 ${style.iconBox}`}>
                  {renderResourceIcon(pool.key, 'w-5 h-5')}
                </div>
              </div>

              <div className="mt-3">
                <div className={`text-2xl font-black font-mono tracking-tight ${style.text}`}>
                  {pool.balance.toLocaleString()}{' '}
                  <span className={`text-xs font-bold font-mono ${style.accent}`}>
                    {pool.shortLabel}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1 line-clamp-2 leading-snug">
                  {pool.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== MAIN CONTENT: ACTIVE MISSIONS & SUPPLY SHIPMENTS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: Active Missions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
              <div className="flex items-center gap-2">
                <AirplaneTakeoff weight="duotone" className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                  Active Missions
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                  {campaign.activeMissions.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigateSubTab('missions')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>All Missions</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {campaign.activeMissions.length > 0 ? (
                campaign.activeMissions.map((mission) => (
                  <div
                    key={mission.id}
                    className="p-4 rounded-2xl border border-stone-800 bg-stone-950/70 hover:border-sky-500/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getMissionStatusBadgeClasses(
                              mission.status
                            )}`}
                          >
                            {mission.statusLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            {mission.taskingName}
                          </span>

                          {mission.sorties.length > 0 ? (
                            mission.sorties.map(
                              (sortie) =>
                                sortie.scheduledAt && (
                                  <span
                                    key={sortie.id}
                                    title={sortie.name}
                                    className="text-[11px] font-mono text-stone-300 flex items-center gap-1 bg-stone-900/90 px-1.5 py-0.5 rounded border border-stone-800"
                                  >
                                    <Clock weight="duotone" className="w-3 h-3 text-amber-500/80" />
                                    <span className="text-[10px] text-stone-400 font-bold">
                                      {sortie.name}:
                                    </span>{' '}
                                    {formatZuluShort(sortie.scheduledAt)}
                                  </span>
                                )
                            )
                          ) : mission.startTime ? (
                            <span className="text-[11px] font-mono text-stone-400 flex items-center gap-1">
                              <Clock weight="duotone" className="w-3 h-3 text-stone-500" />
                              {formatZuluShort(mission.startTime)}
                            </span>
                          ) : null}

                          {mission.rewardBadges.map((badge) => (
                            <span
                              key={badge.type}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono"
                            >
                              {renderResourceIcon(badge.type, 'w-3 h-3 text-amber-400')}
                              {badge.amount.toLocaleString()} {badge.shortLabel}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => onInspectMission(mission, 'overview')}
                          className="text-left group block max-w-full"
                        >
                          <h4 className="text-sm font-bold text-stone-100 group-hover:text-amber-300 transition-colors truncate">
                            {mission.name}
                          </h4>
                        </button>

                        {mission.weather && (
                          <p className="text-xs text-stone-400 line-clamp-1 font-mono">
                            WX: {mission.weather}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onInspectMission(mission, 'overview')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-mono font-bold text-amber-300 transition-colors"
                        >
                          Inspect Mission
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onOpenExternal(
                              mission.mapUrl,
                              `/campaigns/${campaign.slug}/map?mission_id=${mission.id}`
                            )
                          }
                          title="Open mission on Member Portal Tactical Map"
                          className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/40 text-sky-400 transition-all"
                        >
                          <MapTrifold weight="duotone" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {mission.objectives.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mission.objectives.slice(0, 6).map((obj, oIdx) => (
                          <span
                            key={`${mission.id}-obj-${oIdx}`}
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono inline-flex items-center gap-1.5 max-w-full ${
                              obj.isCompleted
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-stone-900 border-stone-800 text-stone-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                obj.isCompleted
                                  ? 'bg-emerald-400'
                                  : obj.priority === 'high'
                                  ? 'bg-rose-400'
                                  : obj.priority === 'medium'
                                  ? 'bg-amber-400'
                                  : 'bg-stone-500'
                              }`}
                            />
                            <span className="truncate max-w-[260px]">
                              {obj.objective || obj.name}
                            </span>
                            {obj.points !== undefined && obj.points > 0 && (
                              <span className="text-amber-300 font-bold shrink-0">
                                +{obj.points} {obj.resourceShortLabel || 'CR'}
                              </span>
                            )}
                          </span>
                        ))}
                        {mission.objectives.length > 6 && (
                          <span className="px-2 py-0.5 rounded-lg bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-400">
                            +{mission.objectives.length - 6} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between gap-2 flex-wrap text-xs text-stone-400">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-stone-300">
                          <AirplaneTilt weight="duotone" className="w-3.5 h-3.5 text-sky-400" />
                          <strong>{mission.flightsCount}</strong> Flight(s)
                        </span>
                        {mission.objectivesCount > 0 && (
                          <span className="flex items-center gap-1 font-mono text-stone-300">
                            <Target weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                            <strong>
                              {mission.completedObjectivesCount}/{mission.objectivesCount}
                            </strong>{' '}
                            Objective(s)
                          </span>
                        )}
                        {mission.totalRewardsSummary && mission.totalRewardsSummary !== 'None' && (
                          <span className="flex items-center gap-1 font-mono text-amber-400 text-[11px]">
                            <Coins weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                            <strong>{mission.earnedRewardsSummary}</strong> /{' '}
                            {mission.totalRewardsSummary}
                          </span>
                        )}
                      </div>

                      {mission.lat !== null &&
                        mission.lat !== undefined &&
                        mission.lng !== null &&
                        mission.lng !== undefined && (
                          <span className="font-mono text-[11px] text-stone-500">
                            {mission.lat.toFixed(3)}°, {mission.lng.toFixed(3)}°
                          </span>
                        )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-800 rounded-2xl space-y-2">
                  <AirplaneTakeoff className="w-8 h-8 text-stone-600 mx-auto opacity-50" />
                  <p>No active or open missions scheduled for this campaign.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: Pending Supply Shipments & Recent Resource Ledger */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800/80 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Package weight="duotone" className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-stone-100 uppercase tracking-wider">
                  Pending Supply Shipments
                </h3>
                {campaign.pendingSupplyOrders.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    {campaign.pendingSupplyOrders.length}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  onOpenExternal(undefined, `/campaigns/${campaign.slug}/supply-orders`)
                }
                className="text-xs text-stone-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
              >
                <span>All Orders</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3.5">
              {campaign.pendingSupplyOrders.length > 0 ? (
                campaign.pendingSupplyOrders.map((order) => {
                  const payloadPct = Math.min(100, Math.max(0, order.payloadPercentage));
                  const barColor =
                    payloadPct >= 100
                      ? 'bg-rose-500'
                      : payloadPct >= 80
                      ? 'bg-amber-500'
                      : 'bg-sky-500';
                  const dotColor =
                    order.statusColor === 'warning'
                      ? 'bg-amber-400 animate-pulse'
                      : order.statusColor === 'info'
                      ? 'bg-sky-400'
                      : order.statusColor === 'primary'
                      ? 'bg-indigo-400 animate-pulse'
                      : 'bg-emerald-400';

                  return (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-stone-800/90 bg-stone-950/70 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs text-sky-400 tracking-wider">
                            #{order.identifier}
                          </span>
                          <span className="text-[11px] font-mono text-stone-400 truncate">
                            {order.flightCallsign} &bull; {order.airframeShortName}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 shrink-0 ${getStatusBadgeClasses(
                            order.statusColor
                          )}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          {order.statusLabel}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                        <div className="flex items-center gap-1.5 text-stone-300 min-w-0">
                          <AirplaneTakeoff
                            weight="duotone"
                            className="w-3.5 h-3.5 text-stone-400 shrink-0"
                          />
                          <span className="text-stone-400 truncate max-w-[130px]" title={order.originName}>
                            {order.originIcao || order.originName}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-stone-600 shrink-0" />
                          <span className="text-stone-100 font-semibold truncate">
                            {order.destinationName}
                          </span>
                          {order.distanceNm > 0 && (
                            <span className="text-[10px] font-mono text-stone-500 shrink-0">
                              ({order.distanceNm.toLocaleString()} NM)
                            </span>
                          )}
                        </div>

                        <div className="font-mono text-xs font-bold text-amber-400 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {order.costLogisticsPoints} LP
                        </div>
                      </div>

                      <div className="space-y-1.5 bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/80">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-400 font-mono">
                            Payload:{' '}
                            <strong className="text-stone-200">
                              {order.totalWeightLbs.toLocaleString()}
                            </strong>{' '}
                            / {order.maxPayloadLbs.toLocaleString()} lbs
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              payloadPct >= 100
                                ? 'text-rose-400'
                                : payloadPct >= 80
                                ? 'text-amber-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {order.payloadPercentage}% capacity
                          </span>
                        </div>

                        <div className="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden border border-stone-800">
                          <div
                            className={`${barColor} h-1.5 rounded-full transition-all duration-300`}
                            style={{ width: `${payloadPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                          <span>{order.totalItemsCount} munitions units</span>
                          <span>{order.remainingPayloadLbs.toLocaleString()} lbs free</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                          <span>Cargo Manifest</span>
                          <span className="font-mono text-stone-500">
                            {order.items.length} item type(s)
                          </span>
                        </div>

                        {order.items.length > 0 ? (
                          <div className="divide-y divide-stone-800/60 rounded-xl border border-stone-800/60 bg-stone-900/50 max-h-36 overflow-y-auto">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="p-2 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-stone-200 truncate">
                                      {item.name}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25">
                                      &times;{item.quantity}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-stone-400 font-mono flex items-center gap-2 flex-wrap">
                                    <span>{item.totalWeightLbs.toLocaleString()} lbs</span>
                                    {item.requestedBy && (
                                      <span className="text-stone-500">by {item.requestedBy}</span>
                                    )}
                                    {item.notes && (
                                      <span className="text-stone-500 italic truncate">
                                        &bull; &ldquo;{item.notes}&rdquo;
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2.5 text-center text-xs text-stone-500 border border-dashed border-stone-800 rounded-xl bg-stone-950/40">
                            Hold empty. Manage manifest cargo on the Member Portal.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-800 rounded-2xl space-y-2 bg-stone-950/40">
                  <Package className="w-8 h-8 text-stone-600 mx-auto opacity-60" />
                  <p className="text-stone-300 font-medium">
                    No pending supply shipments currently scheduled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
