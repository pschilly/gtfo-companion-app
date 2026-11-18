import React, { useMemo } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowRight,
  ArrowsClockwise,
  Binoculars,
  BookOpen,
  CaretRight,
  Crosshair,
  GlobeHemisphereWest,
  PushPin,
  PushPinSlash,
  Rows,
  SquaresFour,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { openExternalUrl } from '../services/tauriBridge';
import { CampaignItem, CampaignMissionItem, CampaignSubTab } from '../types';
import { CampaignAirframesTab } from './campaigns/CampaignAirframesTab';
import { CampaignIntelTab } from './campaigns/CampaignIntelTab';
import { CampaignLoreTab } from './campaigns/CampaignLoreTab';
import { CampaignMissionModal, MissionModalSection } from './campaigns/CampaignMissionModal';
import { CampaignMissionsTab } from './campaigns/CampaignMissionsTab';
import { CampaignOverviewTab } from './campaigns/CampaignOverviewTab';
import { getCampaignTotalIntelCount, getStatusBadgeClasses } from './campaigns/utils';

function getPortalOrigin(): string {
  try {
    return new URL(STATIC_CONFIG.portalBaseUrl).origin;
  } catch {
    return 'https://members.globaltaskforceoverlord.org';
  }
}

export const CampaignsView: React.FC = () => {
  const {
    campaignsList,
    selectedCampaignId,
    setSelectedCampaignId,
    selectedCampaignMissionId,
    setSelectedCampaignMissionId,
    selectedCampaignMissionSection,
    setSelectedCampaignMissionSection,
    activeCampaignSubTab,
    setActiveCampaignSubTab,
    isLoadingCampaigns,
    refreshCampaigns,
    pinnedCampaignId,
    pinCampaignToHome,
  } = useApp();

  const activeCampaigns = useMemo(
    () => campaignsList.filter((c) => c.isActive),
    [campaignsList]
  );

  const selectedCampaign: CampaignItem | null = useMemo(() => {
    return (
      activeCampaigns.find((c) => c.id === selectedCampaignId) ||
      activeCampaigns[0] ||
      null
    );
  }, [activeCampaigns, selectedCampaignId]);

  const portalOrigin = useMemo(() => getPortalOrigin(), []);

  const handleOpenExternal = (url?: string | null, fallbackPath?: string) => {
    const target = url || (fallbackPath ? `${portalOrigin}${fallbackPath}` : portalOrigin);
    openExternalUrl(target);
  };

  const handleSelectCampaign = (campaign: CampaignItem, targetSubTab?: CampaignSubTab) => {
    setSelectedCampaignId(campaign.id);
    if (targetSubTab) {
      setActiveCampaignSubTab(targetSubTab);
    } else if (activeCampaignSubTab === 'campaigns_grid') {
      setActiveCampaignSubTab('overview');
    }
  };

  const handleTogglePin = (campaignId: number) => {
    if (pinnedCampaignId === campaignId) {
      pinCampaignToHome(null);
    } else {
      pinCampaignToHome(campaignId);
    }
  };

  const handleInspectMission = (
    mission: CampaignMissionItem,
    section: MissionModalSection = 'overview'
  ) => {
    setSelectedCampaignMissionSection(section);
    setSelectedCampaignMissionId(mission.id);
  };

  const inspectedMissionContext = useMemo(() => {
    if (!selectedCampaignMissionId) return null;
    if (selectedCampaign) {
      const localMatch = selectedCampaign.missions.find(
        (m) => m.id === selectedCampaignMissionId
      );
      if (localMatch) {
        return { campaign: selectedCampaign, mission: localMatch };
      }
    }
    for (const camp of activeCampaigns) {
      const match = camp.missions.find((m) => m.id === selectedCampaignMissionId);
      if (match) {
        return { campaign: camp, mission: match };
      }
    }
    return null;
  }, [activeCampaigns, selectedCampaign, selectedCampaignMissionId]);

  const campaignPrefix = selectedCampaign ? `${selectedCampaign.name} — ` : '';

  const subPageMeta: Record<
    CampaignSubTab,
    {
      label: string;
      code: string;
      title: string;
      subtitle: string;
      icon: React.ReactNode;
      badge?: number;
    }
  > = {
    overview: {
      label: 'Overview',
      code: 'S2 - Operations // Campaigns // Overview',
      title: selectedCampaign ? `${selectedCampaign.name} — Overview` : 'Campaign Overview',
      subtitle:
        'Operational progress, logistics resource pools, active missions, and recent supply activity.',
      icon: <Rows className="w-3.5 h-3.5" />,
    },
    lore: {
      label: 'Campaign Lore',
      code: 'S2 - Operations // Campaigns // Lore',
      title: `${campaignPrefix}Campaign Lore`,
      subtitle:
        'Published theater chronicles, campaign backstory chapters, and field audio/video briefings.',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      badge: selectedCampaign?.loresCount,
    },
    missions: {
      label: 'Missions',
      code: 'S2 - Operations // Campaigns // Missions',
      title: `${campaignPrefix}Missions`,
      subtitle:
        'Scheduled and completed operational sorties, SMEAC briefings, and tactical mission objectives.',
      icon: <AirplaneTakeoff className="w-3.5 h-3.5" />,
      badge: selectedCampaign?.missions.length,
    },
    intel: {
      label: 'Intel Reports',
      code: 'S2 - Operations // Campaigns // Intel',
      title: `${campaignPrefix}Intel Reports`,
      subtitle:
        'Field intelligence dispatches, reconnaissance imagery, sortie After Action Reports, and BDA.',
      icon: <Binoculars className="w-3.5 h-3.5" />,
      badge: getCampaignTotalIntelCount(selectedCampaign),
    },
    airframes: {
      label: 'Airframes',
      code: 'S2 - Operations // Campaigns // Airframes',
      title: `${campaignPrefix}Airframes`,
      subtitle:
        'Tracked campaign airframe inventory across assigned squadrons and deployed theater airbases.',
      icon: <AirplaneTilt className="w-3.5 h-3.5" />,
      badge: selectedCampaign
        ? selectedCampaign.totalTrackedAirframes || selectedCampaign.airframeSquadronGroups.length
        : undefined,
    },
    campaigns_grid: {
      label: 'All Active Campaigns',
      code: 'S2 - Operations // Campaigns // Directory',
      title: 'All Active Theater Campaigns',
      subtitle:
        'Browse ongoing theater campaigns, inspect live progress, or pin a campaign to your Home dashboard.',
      icon: <SquaresFour className="w-3.5 h-3.5" />,
      badge: activeCampaigns.length,
    },
  };

  const currentMeta = subPageMeta[activeCampaignSubTab] ?? subPageMeta.overview;

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      {/* HEADER & CAMPAIGN SELECTION CONTROLS */}
      <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 sm:p-6 shadow-xl space-y-4">
        {/* Updating Campaign Breadcrumb */}
        <nav
          aria-label="Campaign breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-stone-400 pb-3 border-b border-stone-800/70"
        >
          <span className="inline-flex items-center gap-1.5 text-stone-300 font-semibold">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>S2 - Operations</span>
          </span>

          <CaretRight className="w-3 h-3 text-stone-600 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveCampaignSubTab('campaigns_grid')}
            className="px-1.5 py-0.5 rounded-md hover:bg-stone-800 hover:text-amber-300 transition-colors"
          >
            Campaigns
          </button>

          {selectedCampaign && activeCampaignSubTab !== 'campaigns_grid' && (
            <>
              <CaretRight className="w-3 h-3 text-stone-600 shrink-0" />
              <button
                type="button"
                onClick={() => setActiveCampaignSubTab('overview')}
                className="px-1.5 py-0.5 rounded-md hover:bg-stone-800 text-stone-200 hover:text-amber-300 transition-colors max-w-[220px] truncate"
                title={`Jump to ${selectedCampaign.name} Overview`}
              >
                {selectedCampaign.name}
              </button>
            </>
          )}

          <CaretRight className="w-3 h-3 text-stone-600 shrink-0" />

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
            {currentMeta.icon}
            <span>{currentMeta.label}</span>
            {typeof currentMeta.badge === 'number' && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-200 text-[10px]">
                {currentMeta.badge}
              </span>
            )}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                <Crosshair className="w-3 h-3" />
                {currentMeta.code}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
                {activeCampaigns.length} Active
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
              {currentMeta.title}
            </h1>
            <p className="text-xs text-stone-400 max-w-2xl">{currentMeta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refreshCampaigns()}
              disabled={isLoadingCampaigns}
              className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-60"
            >
              <ArrowsClockwise
                className={`w-3.5 h-3.5 text-amber-400 ${isLoadingCampaigns ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Campaign Switcher Strip */}
        {activeCampaignSubTab !== 'campaigns_grid' && activeCampaigns.length > 0 && (
          <div className="pt-3 border-t border-stone-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
              <span className="uppercase tracking-wider font-bold text-stone-400">
                Select Active Campaign ({activeCampaigns.length})
              </span>
              {pinnedCampaignId && activeCampaigns.some((c) => c.id === pinnedCampaignId) && (
                <div className="inline-flex items-center gap-2 text-amber-300">
                  <span className="inline-flex items-center gap-1">
                    <PushPin weight="fill" className="w-3 h-3" />
                    Pinned to Home:{' '}
                    <strong>
                      {activeCampaigns.find((c) => c.id === pinnedCampaignId)?.name || 'Campaign'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => pinCampaignToHome(null)}
                    title="Unpin campaign and remove widget from Home dashboard"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-950 hover:bg-red-500/20 border border-stone-800 hover:border-red-500/40 text-stone-400 hover:text-red-300 text-[10px] font-mono transition-colors"
                  >
                    <PushPinSlash className="w-3 h-3" />
                    <span>Unpin</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {activeCampaigns.map((camp) => {
                const isSelected = selectedCampaign?.id === camp.id;
                const isPinned = pinnedCampaignId === camp.id;

                return (
                  <div
                    key={camp.id}
                    onClick={() => handleSelectCampaign(camp)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectCampaign(camp);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-stone-950 border-amber-500/60 ring-1 ring-amber-500/30 shadow-lg'
                        : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 hover:bg-stone-950'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {camp.coverImageUrl ? (
                        <img
                          src={camp.coverImageUrl}
                          alt={camp.name}
                          className="w-10 h-10 rounded-xl object-contain bg-stone-900 border border-stone-800 p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-xs text-amber-300 shrink-0">
                          {camp.abbreviation}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-display font-bold text-xs truncate ${
                              isSelected ? 'text-amber-300' : 'text-stone-100'
                            }`}
                          >
                            {camp.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400 mt-0.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded border uppercase font-bold ${getStatusBadgeClasses(
                              camp.statusColor
                            )}`}
                          >
                            {camp.statusLabel}
                          </span>
                          <span>{camp.theatre || 'Active Theatre'}</span>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">
                            {camp.progressPercentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(camp.id);
                      }}
                      title={
                        isPinned ? 'Unpin from Home widget' : 'Pin this campaign to Home widget'
                      }
                      aria-label={isPinned ? 'Unpin from Home' : 'Pin to Home'}
                      className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                        isPinned
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-amber-300 hover:border-amber-500/40'
                      }`}
                    >
                      {isPinned ? (
                        <PushPin weight="fill" className="w-3.5 h-3.5" />
                      ) : (
                        <PushPin className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* EMPTY / LOADING STATE */}
      {activeCampaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 p-12 text-center space-y-3">
          <GlobeHemisphereWest className="w-12 h-12 text-stone-600 mx-auto" />
          <div className="space-y-1">
            <h2 className="font-display font-bold text-base text-stone-200">
              {isLoadingCampaigns
                ? 'Synchronizing Campaign Intelligence...'
                : 'No Active Campaigns Available'}
            </h2>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              {isLoadingCampaigns
                ? 'Pulling active campaign status, resource balances, active missions, and supply shipments from the Member Portal.'
                : 'There are currently no active operational campaigns returned from the Member Portal API.'}
            </p>
          </div>
          {!isLoadingCampaigns && (
            <button
              type="button"
              onClick={() => refreshCampaigns()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs inline-flex items-center gap-1.5"
            >
              <ArrowsClockwise className="w-3.5 h-3.5" />
              <span>Retry Portal Sync</span>
            </button>
          )}
        </div>
      ) : activeCampaignSubTab === 'campaigns_grid' ? (
        /* ==================== ACTIVE CAMPAIGNS SELECTION GRID ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {activeCampaigns.map((camp) => {
            const isPinned = pinnedCampaignId === camp.id;
            return (
              <div
                key={camp.id}
                className={`rounded-3xl border bg-stone-900/90 p-5 shadow-xl flex flex-col justify-between gap-4 transition-all ${
                  selectedCampaign?.id === camp.id
                    ? 'border-amber-500/50 ring-1 ring-amber-500/20'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {camp.coverImageUrl ? (
                        <img
                          src={camp.coverImageUrl}
                          alt={camp.name}
                          className="w-16 h-16 rounded-2xl object-contain bg-stone-950 border border-stone-800 p-1 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-lg text-amber-300 shrink-0">
                          {camp.abbreviation}
                        </div>
                      )}
                      <div className="min-w-0 space-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getStatusBadgeClasses(
                            camp.statusColor
                          )}`}
                        >
                          {camp.statusLabel}
                        </span>
                        <h3 className="font-display font-bold text-base text-stone-100 leading-snug">
                          {camp.name}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePin(camp.id)}
                      title={
                        isPinned
                          ? 'Unpin campaign and remove widget from Home dashboard'
                          : 'Pin this campaign to Home widget'
                      }
                      className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                        isPinned
                          ? 'bg-amber-500/20 hover:bg-red-500/20 border-amber-500/50 hover:border-red-500/50 text-amber-300 hover:text-red-300'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-amber-300 hover:border-amber-500/40'
                      }`}
                    >
                      {isPinned ? (
                        <>
                          <PushPinSlash className="w-3.5 h-3.5" />
                          <span>Unpin</span>
                        </>
                      ) : (
                        <>
                          <PushPin className="w-3.5 h-3.5" />
                          <span>Pin</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                      {camp.theatre || 'Active Theatre'}
                    </span>
                    {camp.dcsServer && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                        {camp.dcsServer}
                      </span>
                    )}
                    {camp.era && (
                      <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 font-bold">
                        {camp.era}
                      </span>
                    )}
                  </div>

                  {camp.descriptionSummary ? (
                    <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">
                      {camp.descriptionSummary}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500 italic">
                      No campaign tactical briefing description provided.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-stone-400">Operational Progress</span>
                      <span className="text-amber-300 font-bold">{camp.progressPercentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-950 border border-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, camp.progressPercentage))}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {camp.resourcePools.map((pool) => (
                      <div
                        key={pool.key}
                        className="p-2 rounded-xl bg-stone-950/80 border border-stone-800 text-center"
                      >
                        <div className="text-xs font-mono font-black text-stone-100">
                          {pool.balance.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-mono text-stone-400">
                          {pool.shortLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-stone-400">
                    {camp.activeMissionsCount} active mission
                    {camp.activeMissionsCount === 1 ? '' : 's'} &bull; {camp.pendingSupplyOrdersCount}{' '}
                    supply
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectCampaign(camp, 'overview')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>View Overview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        selectedCampaign && (
          <>
            {activeCampaignSubTab === 'overview' && (
              <CampaignOverviewTab
                campaign={selectedCampaign}
                isPinned={pinnedCampaignId === selectedCampaign.id}
                onTogglePin={() => handleTogglePin(selectedCampaign.id)}
                onOpenExternal={handleOpenExternal}
                onNavigateSubTab={setActiveCampaignSubTab}
                onInspectMission={handleInspectMission}
              />
            )}
            {activeCampaignSubTab === 'lore' && (
              <CampaignLoreTab
                campaign={selectedCampaign}
                onOpenExternal={handleOpenExternal}
              />
            )}
            {activeCampaignSubTab === 'missions' && (
              <CampaignMissionsTab
                campaign={selectedCampaign}
                onOpenExternal={handleOpenExternal}
                onInspectMission={handleInspectMission}
              />
            )}
            {activeCampaignSubTab === 'intel' && (
              <CampaignIntelTab
                campaign={selectedCampaign}
                onOpenExternal={handleOpenExternal}
                onInspectMission={handleInspectMission}
              />
            )}
            {activeCampaignSubTab === 'airframes' && (
              <CampaignAirframesTab
                campaign={selectedCampaign}
                onOpenExternal={handleOpenExternal}
              />
            )}
          </>
        )
      )}

      {inspectedMissionContext && (
        <CampaignMissionModal
          campaign={inspectedMissionContext.campaign}
          mission={inspectedMissionContext.mission}
          initialSection={selectedCampaignMissionSection}
          onClose={() => {
            setSelectedCampaignMissionId(null);
            setSelectedCampaignMissionSection('overview');
          }}
          onOpenExternal={handleOpenExternal}
        />
      )}
    </div>
  );
};
