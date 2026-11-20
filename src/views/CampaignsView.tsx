import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowRight,
  ArrowsClockwise,
  Binoculars,
  BookOpen,
  CaretDown,
  CaretRight,
  Check,
  Crosshair,
  GlobeHemisphereWest,
  MapTrifold,
  PushPin,
  PushPinSlash,
  Rows,
  SquaresFour,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { openExternalUrl } from '../services/tauriBridge';
import { CampaignItem, CampaignMissionItem, CampaignSubTab } from '../types';
import { CampaignAirframesTab } from './campaigns/CampaignAirframesTab';
import { CampaignIntelTab } from './campaigns/CampaignIntelTab';
import { CampaignLoreTab } from './campaigns/CampaignLoreTab';
import { CampaignMissionModal, MissionModalSection } from './campaigns/CampaignMissionModal';
import { CampaignMissionsTab } from './campaigns/CampaignMissionsTab';
import { CampaignOverviewTab } from './campaigns/CampaignOverviewTab';
import { CampaignMapTab } from './campaigns/map/CampaignMapTab';
import { getCampaignTotalIntelCount, getStatusBadgeClasses } from './campaigns/utils';

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

  const [mapFocusMissionId, setMapFocusMissionId] = useState<number | null>(null);
  const [isCampaignMenuOpen, setIsCampaignMenuOpen] = useState(false);
  const campaignMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isCampaignMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (campaignMenuRef.current && !campaignMenuRef.current.contains(event.target as Node)) {
        setIsCampaignMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCampaignMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCampaignMenuOpen]);

  const handleOpenExternal = (url?: string | null) => {
    if (url) {
      openExternalUrl(url);
    }
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
    map: {
      label: 'Campaign Map',
      code: 'S2 - Operations // Campaigns // Tactical Map',
      title: selectedCampaign ? `${selectedCampaign.name} — Campaign Map` : 'Campaign Map',
      subtitle:
        'Live interactive theater map, SAM threats, support orbits, ISR recon, and DCS flight plan editor.',
      icon: <MapTrifold className="w-3.5 h-3.5" />,
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
  const isMapSubTab = activeCampaignSubTab === 'map';

  return (
    <div
      className={
        isMapSubTab
          ? 'flex-1 flex flex-col min-h-0 w-full gap-3'
          : 'space-y-6 pb-10 w-full max-w-[2400px] mx-auto'
      }
    >
      {/* HEADER & CAMPAIGN SELECTION CONTROLS */}
      <div
        className={
          isMapSubTab
            ? 'relative z-30 rounded-2xl border border-stone-800 bg-stone-900/90 px-4 py-3 shadow-xl space-y-2 shrink-0'
            : 'relative z-30 rounded-3xl border border-stone-800 bg-stone-900/90 p-5 sm:p-6 shadow-xl space-y-4'
        }
      >
        {/* Updating Campaign Breadcrumb */}
        <nav
          aria-label="Campaign breadcrumb"
          className={`flex flex-wrap items-center gap-1.5 text-xs font-mono text-stone-400 border-b border-stone-800/70 ${
            isMapSubTab ? 'pb-2' : 'pb-3'
          }`}
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
            {!isMapSubTab && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <Crosshair className="w-3 h-3" />
                  {currentMeta.code}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold">
                  {activeCampaigns.length} Active
                </span>
              </div>
            )}

            <h1
              className={`font-display font-extrabold text-stone-100 tracking-tight ${
                isMapSubTab ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              {currentMeta.title}
            </h1>
            {!isMapSubTab && (
              <p className="text-xs text-stone-400 max-w-2xl">{currentMeta.subtitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {activeCampaignSubTab !== 'campaigns_grid' &&
              activeCampaigns.length > 0 &&
              selectedCampaign && (
                <div ref={campaignMenuRef} className="relative">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isCampaignMenuOpen}
                    onClick={() => setIsCampaignMenuOpen((open) => !open)}
                    className={`h-10 pl-2 pr-2.5 rounded-xl bg-stone-950 hover:bg-stone-900 border flex items-center gap-2.5 shadow-md transition-all cursor-pointer ${
                      isCampaignMenuOpen
                        ? 'border-amber-500/70 ring-1 ring-amber-500/30'
                        : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {selectedCampaign.coverImageUrl ? (
                      <img
                        src={selectedCampaign.coverImageUrl}
                        alt={selectedCampaign.name}
                        className="w-7 h-7 rounded-lg object-contain bg-stone-900 border border-stone-800 p-0.5 shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-[10px] text-amber-300 shrink-0">
                        {selectedCampaign.abbreviation}
                      </div>
                    )}

                    <div className="text-left min-w-0 max-w-[200px]">
                      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-stone-500 leading-none">
                        <span>Active Campaign</span>
                        {pinnedCampaignId === selectedCampaign.id && (
                          <PushPin
                            weight="fill"
                            className="w-2.5 h-2.5 text-amber-400 shrink-0"
                          />
                        )}
                        {activeCampaigns.length > 1 && (
                          <span className="px-1 rounded bg-stone-900 border border-stone-800 text-amber-300/90 font-semibold">
                            {activeCampaigns.length}
                          </span>
                        )}
                      </div>
                      <div className="font-display font-bold text-xs text-stone-100 truncate leading-tight mt-0.5">
                        {selectedCampaign.name}
                      </div>
                    </div>

                    <CaretDown
                      className={`w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform duration-150 ${
                        isCampaignMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isCampaignMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="Active Campaigns"
                      className="absolute right-0 top-full mt-2 w-[350px] max-w-[90vw] rounded-2xl border border-stone-700/90 bg-stone-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-3 py-2 border-b border-stone-800/80 bg-stone-900/70 flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="uppercase tracking-wider font-bold text-stone-400">
                          Active Campaigns ({activeCampaigns.length})
                        </span>
                        {pinnedCampaignId &&
                          activeCampaigns.some((c) => c.id === pinnedCampaignId) && (
                            <div className="inline-flex items-center gap-1.5 text-amber-300">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25">
                                <PushPin weight="fill" className="w-2.5 h-2.5" />
                                <span>Pinned</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => pinCampaignToHome(null)}
                                title="Unpin campaign and remove widget from Home dashboard"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-950 hover:bg-red-500/20 border border-stone-800 hover:border-red-500/40 text-stone-400 hover:text-red-300 transition-colors cursor-pointer"
                              >
                                <PushPinSlash className="w-2.5 h-2.5" />
                                <span>Unpin</span>
                              </button>
                            </div>
                          )}
                      </div>

                      <div className="max-h-[320px] overflow-y-auto p-1.5 space-y-1">
                        {activeCampaigns.map((camp) => {
                          const isSelected = selectedCampaign?.id === camp.id;
                          const isPinned = pinnedCampaignId === camp.id;

                          return (
                            <div
                              key={camp.id}
                              role="option"
                              aria-selected={isSelected}
                              tabIndex={0}
                              onClick={() => {
                                handleSelectCampaign(camp);
                                setIsCampaignMenuOpen(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSelectCampaign(camp);
                                  setIsCampaignMenuOpen(false);
                                }
                              }}
                              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                isSelected
                                  ? 'bg-stone-900 border-amber-500/60 ring-1 ring-amber-500/25'
                                  : 'bg-stone-950/60 border-stone-800/80 hover:border-stone-700 hover:bg-stone-900/70'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {camp.coverImageUrl ? (
                                  <img
                                    src={camp.coverImageUrl}
                                    alt={camp.name}
                                    className="w-9 h-9 rounded-lg object-contain bg-stone-900 border border-stone-800 p-0.5 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-mono font-black text-xs text-amber-300 shrink-0">
                                    {camp.abbreviation}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span
                                      className={`font-display font-bold text-xs truncate ${
                                        isSelected ? 'text-amber-300' : 'text-stone-100'
                                      }`}
                                    >
                                      {camp.name}
                                    </span>
                                    {isSelected && (
                                      <Check
                                        weight="bold"
                                        className="w-3.5 h-3.5 text-amber-400 shrink-0"
                                      />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400 mt-0.5 flex-wrap">
                                    <span
                                      className={`px-1.5 py-0.2 rounded border uppercase font-bold ${getStatusBadgeClasses(
                                        camp.statusColor
                                      )}`}
                                    >
                                      {camp.statusLabel}
                                    </span>
                                    <span className="truncate">
                                      {camp.theatre || 'Active Theatre'}
                                    </span>
                                    <span>•</span>
                                    <span className="text-amber-300 font-semibold">
                                      {camp.progressPercentage}%
                                    </span>
                                  </div>
                                  <div className="h-1 rounded-full bg-stone-900 border border-stone-800/80 overflow-hidden mt-1">
                                    <div
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.max(0, camp.progressPercentage)
                                        )}%`,
                                      }}
                                    />
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
                                  isPinned
                                    ? 'Unpin from Home widget'
                                    : 'Pin this campaign to Home widget'
                                }
                                aria-label={isPinned ? 'Unpin from Home' : 'Pin to Home'}
                                className={`p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
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

                      <div className="px-3 py-2 border-t border-stone-800/80 bg-stone-900/70 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-stone-500 truncate">
                          {selectedCampaign.theatre || 'Active Theatre'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCampaignSubTab('campaigns_grid');
                            setIsCampaignMenuOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          <span>All Campaigns</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            <button
              type="button"
              onClick={() => refreshCampaigns()}
              disabled={isLoadingCampaigns}
              className="h-10 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
            >
              <ArrowsClockwise
                className={`w-3.5 h-3.5 text-amber-400 ${isLoadingCampaigns ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5">
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
                onNavigateSubTab={setActiveCampaignSubTab}
                onInspectMission={handleInspectMission}
                onOpenMissionOnMap={(missionId) => {
                  setMapFocusMissionId(missionId);
                  setActiveCampaignSubTab('map');
                }}
              />
            )}
            {activeCampaignSubTab === 'map' && (
              <CampaignMapTab
                campaign={selectedCampaign}
                initialMissionId={mapFocusMissionId}
                onConsumedInitialTarget={() => setMapFocusMissionId(null)}
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
                onInspectMission={handleInspectMission}
                onOpenOnMap={(missionId) => {
                  setMapFocusMissionId(missionId);
                  setActiveCampaignSubTab('map');
                }}
              />
            )}
            {activeCampaignSubTab === 'intel' && (
              <CampaignIntelTab
                campaign={selectedCampaign}
                onOpenExternal={handleOpenExternal}
                onInspectMission={handleInspectMission}
                onOpenOnMap={(missionId) => {
                  setMapFocusMissionId(missionId);
                  setActiveCampaignSubTab('map');
                }}
              />
            )}
            {activeCampaignSubTab === 'airframes' && (
              <CampaignAirframesTab campaign={selectedCampaign} />
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
          onOpenOnMap={(missionId) => {
            setSelectedCampaignMissionId(null);
            setSelectedCampaignMissionSection('overview');
            setSelectedCampaignId(inspectedMissionContext.campaign.id);
            setMapFocusMissionId(missionId);
            setActiveCampaignSubTab('map');
          }}
        />
      )}
    </div>
  );
};
