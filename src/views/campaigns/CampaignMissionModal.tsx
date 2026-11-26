import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowSquareOut,
  Binoculars,
  CalendarBlank,
  CheckCircle,
  Clock,
  Coins,
  Crosshair,
  DiscordLogo,
  FileText,
  GlobeHemisphereWest,
  Image as ImageIcon,
  Lock,
  MapPin,
  MapTrifold,
  Note,
  Radio,
  ShieldChevron,
  Sword,
  Target,
  Users,
  VideoCamera,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import {
  CampaignItem,
  CampaignMissionAor,
  CampaignMissionItem,
  CampaignSortieAttendeeItem,
} from '../../types';
import {
  formatDateTimeShort,
  formatZuluShort,
  getMissionStatusBadgeClasses,
  renderResourceIcon,
  RESOURCE_STYLE_MAP,
} from './utils';

export type MissionModalSection =
  | 'overview'
  | 'objectives'
  | 'sorties'
  | 'aar'
  | 'comms_packages';

interface CampaignMissionModalProps {
  campaign: CampaignItem;
  mission: CampaignMissionItem;
  initialSection?: MissionModalSection;
  onClose: () => void;
  onOpenExternal: (url?: string | null, fallbackPath?: string) => void;
  onOpenOnMap?: (missionId: number) => void;
}

const SMEAC_SECTIONS: Array<{
  key: keyof NonNullable<CampaignMissionItem['smeac']>;
  label: string;
}> = [
  { key: 'situation', label: '1. Situation' },
  { key: 'mission', label: '2. Mission' },
  { key: 'execution', label: '3. Execution' },
  { key: 'admin_logistics', label: '4. Admin & Logistics' },
  { key: 'command_signals', label: '5. Command & Signals' },
];

const TACTICAL_PROSE_CLASSES =
  'prose prose-invert prose-stone max-w-none text-xs text-stone-300 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_ul]:my-1.5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5 [&_ol]:my-1.5 [&_ol]:space-y-1 [&_li]:pl-0.5 [&_li>p]:mb-0 [&_strong]:text-amber-200';

function getPriorityBadge(priority?: string): { label: string; classes: string } {
  switch ((priority || 'low').toLowerCase()) {
    case 'high':
      return {
        label: 'High Priority',
        classes: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
      };
    case 'medium':
      return {
        label: 'Medium Priority',
        classes: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      };
    default:
      return {
        label: 'Standard',
        classes: 'bg-stone-800/80 text-stone-300 border-stone-700',
      };
  }
}

function getObjectiveStatusBadge(status: string, isCompleted: boolean): { label: string; classes: string } {
  if (isCompleted) {
    return {
      label: 'Completed',
      classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
    };
  }
  switch (status.toLowerCase()) {
    case 'active':
    case 'in_progress':
      return {
        label: 'Active',
        classes: 'bg-sky-500/20 text-sky-300 border-sky-500/35',
      };
    case 'failed':
      return {
        label: 'Failed',
        classes: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
      };
    default:
      return {
        label: 'Pending',
        classes: 'bg-stone-800 text-stone-400 border-stone-700',
      };
  }
}

function formatAorSummary(aor?: CampaignMissionAor | null): string | null {
  if (!aor || !aor.type) return null;
  const type = aor.type.toLowerCase();
  const labelPrefix = aor.label ? `${aor.label}: ` : '';
  if (type === 'circle') {
    const r = aor.radius_nm ?? 10;
    return `${labelPrefix}Radial Orbit (${r} NM)`;
  }
  if (type === 'box') {
    return `${labelPrefix}Bounding Box`;
  }
  return `${labelPrefix}Polygon Boundary`;
}

function getRoleBadgeClass(role: string): string {
  switch (role.toLowerCase()) {
    case 'game_master':
    case 'gm':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/35';
    case 'jtac':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
    case 'atc':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35';
    case 'gci':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35';
    case 'crew':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/35';
    default:
      return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
  }
}

function groupAttendeeRoster(attendees: CampaignSortieAttendeeItem[]) {
  const bluforBySquadron: Record<string, CampaignSortieAttendeeItem[]> = {};
  const opfor: CampaignSortieAttendeeItem[] = [];

  for (const att of attendees) {
    if (att.isOpfor) {
      opfor.push(att);
      continue;
    }
    const key = att.isSupport
      ? 'Command & Support Staff'
      : att.squadronName || 'Independent / Unassigned';
    if (!bluforBySquadron[key]) {
      bluforBySquadron[key] = [];
    }
    bluforBySquadron[key].push(att);
  }

  return { bluforBySquadron, opfor };
}

export const CampaignMissionModal: React.FC<CampaignMissionModalProps> = ({
  campaign,
  mission,
  initialSection = 'overview',
  onClose,
  onOpenExternal,
  onOpenOnMap,
}) => {
  const { userSession, openSortieInCalendar, setSelectedFlightPlanId, setActiveTab } = useApp();
  const [activeSection, setActiveSection] = useState<MissionModalSection>(initialSection);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection, mission.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage, onClose]);

  const sorties = mission.sorties || [];
  const sortiesWithAar = useMemo(() => sorties.filter((s) => s.hasAar), [sorties]);
  const linkedIntels = useMemo(
    () => (campaign.intelReports || []).filter((r) => r.missionId === mission.id),
    [campaign.intelReports, mission.id]
  );

  const smeacCount = useMemo(() => {
    if (!mission.smeac) return 0;
    return SMEAC_SECTIONS.filter((sec) => Boolean(mission.smeac?.[sec.key])).length;
  }, [mission.smeac]);

  const isUserAttendingAny = useMemo(() => {
    if (!userSession?.id) return false;
    return sorties.some((s) =>
      s.attendees.some((a) => a.discordId && String(a.discordId) === String(userSession.id))
    );
  }, [sorties, userSession?.id]);

  const sidebarItems: Array<{
    id: MissionModalSection;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'overview',
      label: 'Overview & SMEAC',
      icon: <FileText className="w-4 h-4 shrink-0" />,
      badge: smeacCount > 0 ? `${smeacCount}/5` : undefined,
    },
    {
      id: 'objectives',
      label: 'Objectives & Rewards',
      icon: <Target className="w-4 h-4 shrink-0" />,
      badge:
        mission.objectivesCount > 0
          ? `${mission.completedObjectivesCount}/${mission.objectivesCount}`
          : mission.rewardsBreakdown.length || undefined,
    },
    {
      id: 'sorties',
      label: 'Sorties & Roster',
      icon: <Users className="w-4 h-4 shrink-0" />,
      badge: sorties.length,
    },
    {
      id: 'aar',
      label: 'After Action Reports',
      icon: <Sword className="w-4 h-4 shrink-0" />,
      badge: sortiesWithAar.length > 0 ? sortiesWithAar.length : undefined,
    },
    {
      id: 'comms_packages',
      label: 'Comms, Flights & Intel',
      icon: <Radio className="w-4 h-4 shrink-0" />,
      badge:
        mission.frequencies.length +
        mission.flightPlans.length +
        mission.flights.length +
        linkedIntels.length,
    },
  ];

  const handleOpenFlightPlanInAtc = (planId: number | string) => {
    setSelectedFlightPlanId(planId);
    setActiveTab('atc');
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 !m-0 w-screen h-screen z-[1400] flex items-center justify-center p-3 sm:p-5 bg-stone-950/45 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[88vh] max-h-[900px] flex flex-col rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================== MODAL HEADER ==================== */}
        <div className="p-4 sm:p-5 bg-stone-950/95 border-b border-stone-800 flex flex-col lg:flex-row lg:items-start justify-between gap-4 shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${getMissionStatusBadgeClasses(
                  mission.status
                )}`}
              >
                {mission.statusLabel}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {mission.taskingName}
              </span>
              {mission.squadronName && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-900 text-stone-300 border border-stone-800 flex items-center gap-1">
                  <ShieldChevron className="w-3 h-3 text-amber-400" />
                  {mission.squadronName}
                </span>
              )}
              {sortiesWithAar.length > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {sortiesWithAar.length} AAR Filed
                </span>
              )}
              {isUserAttendingAny && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                  ✓ Attending Sortie
                </span>
              )}
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-100 leading-tight">
              {mission.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
              <span className="text-amber-300 font-semibold">{campaign.name}</span>
              {campaign.theatre && (
                <>
                  <span>•</span>
                  <span>{campaign.theatre}</span>
                </>
              )}
              {mission.planningUserName && (
                <>
                  <span>•</span>
                  <span>
                    Planner: <strong className="text-stone-200">{mission.planningUserName}</strong>
                  </span>
                </>
              )}
              {mission.missionTime && (
                <>
                  <span>•</span>
                  <span className="font-mono text-sky-300">{mission.missionTime}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {mission.discordThreadUrl && (
              <button
                type="button"
                onClick={() => onOpenExternal(mission.discordThreadUrl)}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <DiscordLogo className="w-4 h-4" />
                <span>Briefing Thread</span>
                <ArrowSquareOut className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenOnMap && (
              <button
                type="button"
                onClick={() => onOpenOnMap(mission.id)}
                className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <MapTrifold weight="duotone" className="w-4 h-4" />
                <span>Open on Map</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800 transition-colors"
              title="Close Mission Modal (ESC)"
              aria-label="Close Mission Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================== TWO-PANE SIDEBAR + CONTENT BODY ==================== */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Navigation Sidebar */}
          <aside className="w-full md:w-64 lg:w-72 shrink-0 bg-stone-950/90 border-b md:border-b-0 md:border-r border-stone-800 flex flex-col justify-between p-3 sm:p-4 overflow-y-auto">
            <nav aria-label="Mission details sections" className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
              {sidebarItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all whitespace-nowrap shrink-0 text-left ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/45 text-amber-300 font-bold shadow-sm'
                        : 'bg-stone-900/50 hover:bg-stone-900 border-stone-800/80 text-stone-300 hover:text-stone-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={isActive ? 'text-amber-400' : 'text-stone-500'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[11px] tabular-nums shrink-0 ${
                          isActive
                            ? 'bg-amber-500/25 text-amber-200 border border-amber-500/30'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Telemetry Summary (Desktop Sidebar Footer) */}
            <div className="hidden md:block mt-4 p-3.5 rounded-2xl bg-stone-900/70 border border-stone-800 space-y-2.5 text-xs">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 border-b border-stone-800 pb-1.5">
                Mission Telemetry
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-400">Sorties</span>
                <span className="font-mono text-stone-200 font-bold">{sorties.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-400">Objectives</span>
                <span className="font-mono text-amber-300 font-bold">
                  {mission.completedObjectivesCount}/{mission.objectivesCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-400">Flights</span>
                <span className="font-mono text-sky-300 font-bold">{mission.flightsCount}</span>
              </div>
              {mission.totalRewardsSummary && mission.totalRewardsSummary !== 'None' && (
                <div className="pt-1.5 border-t border-stone-800 space-y-0.5">
                  <span className="text-[11px] text-stone-500 uppercase tracking-wider font-medium">Rewards Earned / Total</span>
                  <div className="font-mono text-amber-300 font-bold leading-snug">
                    {mission.earnedRewardsSummary} / {mission.totalRewardsSummary}
                  </div>
                </div>
              )}
              {mission.lat !== null &&
                mission.lat !== undefined &&
                mission.lng !== null &&
                mission.lng !== undefined && (
                  <div className="pt-1.5 border-t border-stone-800 flex items-center justify-between text-stone-400">
                    <span>Coords</span>
                    <span className="font-mono text-stone-200">
                      {mission.lat.toFixed(3)}°, {mission.lng.toFixed(3)}°
                    </span>
                  </div>
                )}
            </div>
          </aside>

          {/* Right Scrollable Content Pane */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6 bg-stone-900/50">
            {/* ==================== SECTION 1: OVERVIEW & SMEAC ==================== */}
            {activeSection === 'overview' && (
              <div className="space-y-5">
                {/* Key Metadata Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Execution Window</span>
                    </div>
                    <div className="text-xs font-semibold text-stone-100 mt-1">
                      {mission.missionTime ||
                        (mission.startTime
                          ? formatDateTimeShort(mission.startTime)
                          : 'See Sortie Schedule')}
                    </div>
                    {mission.startTime && (
                      <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                        Zulu: {formatZuluShort(mission.startTime)}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <GlobeHemisphereWest className="w-3.5 h-3.5 text-sky-400" />
                      <span>Tasking &amp; Squadron</span>
                    </div>
                    <div className="text-xs font-semibold text-stone-100 mt-1 truncate">
                      {mission.taskingName}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5 truncate">
                      {mission.squadronName || 'Multi-Squadron Tasking'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Area of Responsibility</span>
                    </div>
                    <div className="text-xs font-semibold text-stone-100 mt-1 truncate">
                      {formatAorSummary(mission.aor) || 'Primary Target Point'}
                    </div>
                    <div className="text-xs font-mono text-stone-400 mt-0.5">
                      {mission.lat !== null &&
                      mission.lat !== undefined &&
                      mission.lng !== null &&
                      mission.lng !== undefined
                        ? `${mission.lat.toFixed(4)}°, ${mission.lng.toFixed(4)}°`
                        : 'See Tactical Map'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <WarningCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Weather (METAR)</span>
                    </div>
                    <div className="text-xs font-mono text-stone-200 mt-1 line-clamp-2">
                      {mission.weather || 'Standard Theater WX'}
                    </div>
                  </div>
                </div>

                {/* General Overview Briefing */}
                {mission.descriptionHtml && (
                  <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Note className="w-4 h-4" />
                      <span>General Overview Briefing</span>
                    </h3>
                    <div
                      className={`${TACTICAL_PROSE_CLASSES} sm:text-sm [&_p]:mb-2 [&_strong]:text-amber-300`}
                      dangerouslySetInnerHTML={{ __html: mission.descriptionHtml }}
                    />
                  </div>
                )}

                {/* SMEAC Operational Orders */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-amber-400" />
                      <span>SMEAC Operational Orders</span>
                    </h3>
                    <span className="text-xs tabular-nums text-stone-400">
                      {smeacCount}/5 Paragraphs Populated
                    </span>
                  </div>

                  {smeacCount === 0 && !mission.descriptionHtml ? (
                    <div className="p-6 rounded-2xl bg-stone-950/60 border border-dashed border-stone-800 text-center text-xs text-stone-400">
                      No detailed SMEAC briefing paragraphs have been published for this mission yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {SMEAC_SECTIONS.map((sec) => {
                        const html = mission.smeac?.[sec.key];
                        if (!html) return null;
                        return (
                          <div
                            key={sec.key}
                            className="p-4 rounded-2xl bg-stone-950/75 border border-stone-800 space-y-2"
                          >
                            <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                              {sec.label}
                            </div>
                            <div
                              className={`${TACTICAL_PROSE_CLASSES} sm:text-sm [&_p]:mb-2`}
                              dangerouslySetInnerHTML={{ __html: html }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mission Media & Briefing Slides */}
                {mission.images.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                      <span>Mission Media &amp; Briefing Slides ({mission.images.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mission.images.map((imgUrl, idx) => (
                        <button
                          key={`${mission.id}-slide-${idx}`}
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: imgUrl,
                              title: `${mission.name} — Slide ${idx + 1}`,
                            })
                          }
                          className="group relative aspect-video rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 hover:border-sky-500/50 transition-all text-left"
                        >
                          <img
                            src={imgUrl}
                            alt={`${mission.name} slide ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-stone-950/85 border border-stone-700 text-[11px] font-medium text-sky-300">
                            Expand
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== SECTION 2: OBJECTIVES & REWARDS ==================== */}
            {activeSection === 'objectives' && (
              <div className="space-y-6">
                {/* Resource Rewards Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <Coins weight="duotone" className="w-4 h-4 text-amber-400" />
                      <span>Contract Payouts &amp; Resource Rewards</span>
                    </h3>
                    {mission.totalRewardsSummary && mission.totalRewardsSummary !== 'None' && (
                      <span className="text-xs font-mono text-amber-300">
                        Earned: <strong>{mission.earnedRewardsSummary}</strong> /{' '}
                        {mission.totalRewardsSummary}
                      </span>
                    )}
                  </div>

                  {mission.rewardsBreakdown.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {mission.rewardsBreakdown.map((item) => {
                        const style =
                          RESOURCE_STYLE_MAP[item.type] || RESOURCE_STYLE_MAP.command_points;
                        return (
                          <div
                            key={item.type}
                            className={`p-3.5 rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} space-y-2`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-300 truncate">
                                {item.label}
                              </span>
                              <div className={`p-1.5 rounded-lg border shrink-0 ${style.iconBox}`}>
                                {renderResourceIcon(item.type, 'w-4 h-4')}
                              </div>
                            </div>
                            <div className={`text-lg font-bold font-display tabular-nums ${style.text}`}>
                              +{item.total.toLocaleString()}{' '}
                              <span className={`text-xs font-mono ${style.accent}`}>{item.shortLabel}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs tabular-nums text-stone-400">
                              <span>
                                Earned:{' '}
                                <strong className="text-stone-200">
                                  {item.earned.toLocaleString()}
                                </strong>
                              </span>
                              {item.isFullyEarned && (
                                <span className="text-emerald-400 font-semibold">✓ Full</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : mission.rewardBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {mission.rewardBadges.map((badge) => (
                        <span
                          key={badge.type}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5"
                        >
                          {renderResourceIcon(badge.type, 'w-4 h-4 text-amber-400')}
                          <span>
                            +{badge.amount.toLocaleString()} {badge.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-xs text-stone-500 text-center">
                      No specific resource rewards configured for this mission.
                    </div>
                  )}
                </div>

                {/* Tactical Objectives List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <Target weight="duotone" className="w-4 h-4 text-amber-400" />
                      <span>
                        Tactical Objectives ({mission.completedObjectivesCount}/
                        {mission.objectivesCount} Complete)
                      </span>
                    </h3>
                  </div>

                  {mission.objectives.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-center text-xs text-stone-500">
                      No discrete tactical objectives defined for this mission yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mission.objectives.map((obj, idx) => {
                        const prio = getPriorityBadge(obj.priority);
                        const stat = getObjectiveStatusBadge(obj.status, obj.isCompleted);
                        const objAor = formatAorSummary(obj.aor);

                        return (
                          <div
                            key={`${mission.id}-modal-obj-${idx}`}
                            className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                              obj.isCompleted
                                ? 'bg-emerald-950/20 border-emerald-500/35'
                                : 'bg-stone-950/75 border-stone-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-[11px] font-mono font-bold text-stone-400">
                                    OBJ #{(obj.index ?? idx) + 1}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded border text-[11px] font-semibold uppercase tracking-wider ${prio.classes}`}
                                  >
                                    {prio.label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded border text-[11px] font-semibold uppercase tracking-wider ${stat.classes}`}
                                  >
                                    {stat.label}
                                  </span>
                                  {obj.points !== undefined && obj.points > 0 && (
                                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold inline-flex items-center gap-1">
                                      {renderResourceIcon(
                                        obj.resourceType || 'command_points',
                                        'w-3 h-3'
                                      )}
                                      +{obj.points.toLocaleString()}{' '}
                                      {obj.resourceShortLabel || 'CR'}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-stone-100 leading-snug">
                                  {obj.objective || obj.name}
                                </h4>
                              </div>
                            </div>

                            {(obj.mgrs ||
                              objAor ||
                              (obj.squadrons && obj.squadrons.length > 0)) && (
                              <div className="pt-2 border-t border-stone-800/70 flex flex-wrap items-center gap-2 text-xs">
                                {obj.mgrs && (
                                  <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 font-mono text-stone-300">
                                    MGRS: <strong className="text-amber-300">{obj.mgrs}</strong>
                                  </span>
                                )}
                                {objAor && (
                                  <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300">
                                    {objAor}
                                  </span>
                                )}
                                {obj.squadrons &&
                                  obj.squadrons.map((sq) => (
                                    <span
                                      key={sq.id}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-200"
                                    >
                                      {sq.emblemUrl && (
                                        <img
                                          src={sq.emblemUrl}
                                          alt={sq.name}
                                          className="w-3.5 h-3.5 object-contain"
                                        />
                                      )}
                                      <span>{sq.abbreviation || sq.name}</span>
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== SECTION 3: SORTIES & ROSTER ==================== */}
            {activeSection === 'sorties' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <CalendarBlank className="w-4 h-4 text-amber-400" />
                      <span>Scheduled Sorties &amp; Flight Rosters ({sorties.length})</span>
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Inspect confirmed squadron attendance or open any sortie directly inside the Event Calendar to manage your RSVP.
                    </p>
                  </div>
                </div>

                {sorties.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-center space-y-2">
                    <AirplaneTakeoff className="w-9 h-9 text-stone-600 mx-auto" />
                    <p className="text-sm font-semibold text-stone-300">No Sorties Scheduled Yet</p>
                    <p className="text-xs text-stone-500">
                      Execution dates and sortie sign-up rosters will appear here once scheduled by mission planners.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sorties.map((sortie) => {
                      const grouped = groupAttendeeRoster(sortie.attendees || []);
                      const userAtt = userSession?.id
                        ? sortie.attendees.find(
                            (a) => a.discordId && String(a.discordId) === String(userSession.id)
                          )
                        : undefined;

                      return (
                        <div
                          key={sortie.id}
                          className="rounded-2xl border border-stone-800 bg-stone-950/75 p-4 sm:p-5 space-y-4"
                        >
                          {/* Sortie Header */}
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 pb-3 border-b border-stone-800/80">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold font-display text-amber-300 flex items-center gap-1.5">
                                  <AirplaneTakeoff weight="duotone" className="w-4 h-4" />
                                  {sortie.name}
                                </span>

                                {sortie.hasAar ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                                    AAR Filed
                                  </span>
                                ) : sortie.isConcluded ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-stone-800 text-stone-400 border border-stone-700">
                                    Concluded
                                  </span>
                                ) : sortie.isSignupOpen ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                                    Sign-up Open
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/35">
                                    Cut-off Passed
                                  </span>
                                )}

                                {userAtt && (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-stone-950">
                                    ✓ You: {userAtt.flightCallsign || userAtt.roleLabel}
                                  </span>
                                )}

                                {sortie.allowOpfor && (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums bg-rose-950/50 text-rose-300 border border-rose-500/30">
                                    OPFOR ({sortie.opforCount}
                                    {sortie.opforSlots ? `/${sortie.opforSlots}` : ''})
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300">
                                <span className="flex items-center gap-1.5 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>
                                    {sortie.scheduledAt
                                      ? `${formatDateTimeShort(sortie.scheduledAt)} (${formatZuluShort(
                                          sortie.scheduledAt
                                        )})`
                                      : 'TBD'}
                                  </span>
                                </span>

                                {sortie.signupCutoffAt && (
                                  <span className="flex items-center gap-1 text-stone-400">
                                    <Lock className="w-3 h-3 text-stone-500" />
                                    <span>Cut-off: <span className="font-mono">{formatDateTimeShort(sortie.signupCutoffAt)}</span></span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Continuity & External Links */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openSortieInCalendar(sortie.id, {
                                    missionId: mission.id,
                                    missionSection: 'sorties',
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/15 transition-colors"
                              >
                                <CalendarBlank weight="bold" className="w-3.5 h-3.5" />
                                <span>
                                  {sortie.isSignupOpen
                                    ? 'Open & RSVP in Calendar'
                                    : 'View in Event Calendar'}
                                </span>
                              </button>

                              {sortie.hasAar && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSection('aar')}
                                  className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                                >
                                  <Sword className="w-3.5 h-3.5" />
                                  <span>View AAR</span>
                                </button>
                              )}

                              {sortie.discordEventUrl && (
                                <button
                                  type="button"
                                  onClick={() => onOpenExternal(sortie.discordEventUrl)}
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-1 transition-colors"
                                >
                                  <DiscordLogo className="w-3.5 h-3.5" />
                                  <span>Event</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Support Slots Allocation Strip */}
                          {(sortie.gameMasterSlots > 0 ||
                            sortie.jtacSlots > 0 ||
                            sortie.atcSlots > 0 ||
                            sortie.gciSlots > 0) && (
                            <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                              <span className="text-stone-400 text-[11px] uppercase tracking-wider font-semibold">
                                Support Slots:
                              </span>
                              {sortie.gameMasterSlots > 0 && (
                                <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-amber-500/10 border border-amber-500/25 text-amber-300">
                                  GM {sortie.gameMasterCount}/{sortie.gameMasterSlots}
                                </span>
                              )}
                              {sortie.jtacSlots > 0 && (
                                <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                                  JTAC {sortie.jtacCount}/{sortie.jtacSlots}
                                </span>
                              )}
                              {sortie.atcSlots > 0 && (
                                <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
                                  ATC {sortie.atcCount}/{sortie.atcSlots}
                                </span>
                              )}
                              {sortie.gciSlots > 0 && (
                                <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
                                  GCI {sortie.gciCount}/{sortie.gciSlots}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Sortie Briefing Notes */}
                          {sortie.notesHtml ? (
                            <div className="bg-stone-900/70 px-4 py-3 rounded-xl border border-stone-800/80 overflow-hidden">
                              <div
                                className={TACTICAL_PROSE_CLASSES}
                                dangerouslySetInnerHTML={{ __html: sortie.notesHtml }}
                              />
                            </div>
                          ) : sortie.notes ? (
                            <p className="text-xs text-stone-300 whitespace-pre-line bg-stone-900/70 px-4 py-3 rounded-xl border border-stone-800/80 leading-relaxed">
                              {sortie.notes}
                            </p>
                          ) : null}

                          {/* Registered Flight Roster */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-stone-200 flex items-center gap-1.5 tabular-nums">
                                <Users className="w-3.5 h-3.5 text-amber-400" />
                                {sortie.hasAar
                                  ? `Attendance (${sortie.attendedCount} Attended / ${sortie.absentCount} Absent)`
                                  : `Registered Roster (${sortie.attendeesCount})`}
                              </span>
                            </div>

                            {sortie.attendees.length === 0 ? (
                              <div className="p-4 rounded-xl border border-dashed border-stone-800 text-center text-xs text-stone-500">
                                No pilots or support personnel signed up for this sortie yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {Object.entries(grouped.bluforBySquadron).map(
                                  ([sqnName, list]) => (
                                    <div
                                      key={sqnName}
                                      className="rounded-xl border border-stone-800 bg-stone-900/70 overflow-hidden"
                                    >
                                      <div className="px-3 py-1.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-amber-300 truncate">
                                          {sqnName}
                                        </span>
                                        <span className="text-stone-400 tabular-nums shrink-0">
                                          {list.length} Pilot{list.length === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                      <div className="divide-y divide-stone-800/60">
                                        {list.map((att) => {
                                          const isAbsent =
                                            sortie.hasAar && att.isPresent === false;
                                          return (
                                            <div
                                              key={att.id}
                                              className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                                                isAbsent ? 'opacity-60' : ''
                                              }`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                                {att.flightCallsign && (
                                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono font-bold text-[11px]">
                                                    {att.flightCallsign}
                                                  </span>
                                                )}
                                                <span
                                                  className={`font-semibold truncate ${
                                                    isAbsent
                                                      ? 'line-through text-stone-500'
                                                      : 'text-stone-100'
                                                  }`}
                                                >
                                                  {att.callsign}
                                                </span>
                                                <span
                                                  className={`px-1.5 py-0.2 rounded border text-[11px] font-semibold uppercase ${getRoleBadgeClass(
                                                    att.role
                                                  )}`}
                                                >
                                                  {att.roleLabel}
                                                </span>
                                                {sortie.hasAar &&
                                                  (att.isPresent === false ? (
                                                    <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold uppercase">
                                                      Absent
                                                    </span>
                                                  ) : att.xpAwarded ? (
                                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-bold">
                                                      +500 XP
                                                    </span>
                                                  ) : null)}
                                              </div>
                                              <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 shrink-0">
                                                {att.isSupport
                                                  ? att.roleLabel
                                                  : att.airframeAbbreviation ||
                                                    att.airframeName ||
                                                    'TBD'}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )
                                )}

                                {grouped.opfor.length > 0 && (
                                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 overflow-hidden">
                                    <div className="px-3 py-1.5 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between text-xs">
                                      <span className="font-semibold text-rose-300">
                                        OPFOR Aggressor Element
                                      </span>
                                      <span className="text-rose-300/80 tabular-nums">
                                        {grouped.opfor.length} Pilot
                                        {grouped.opfor.length === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    <div className="divide-y divide-rose-500/20">
                                      {grouped.opfor.map((att) => (
                                        <div
                                          key={att.id}
                                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {att.flightCallsign && (
                                              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-200 font-mono font-bold text-[11px]">
                                                {att.flightCallsign}
                                              </span>
                                            )}
                                            <span className="font-semibold text-rose-200 truncate">
                                              {att.callsign}
                                            </span>
                                          </div>
                                          <span className="px-2 py-0.5 rounded bg-stone-950 border border-rose-500/30 text-[11px] font-mono text-rose-300 shrink-0">
                                            {att.airframeAbbreviation ||
                                              att.airframeName ||
                                              'OPFOR'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== SECTION 4: AFTER ACTION REPORTS (AAR & BDA) ==================== */}
            {activeSection === 'aar' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    <Sword className="w-4 h-4 text-cyan-400" />
                    <span>After Action Reports &amp; BDA ({sortiesWithAar.length})</span>
                  </h3>
                </div>

                {sortiesWithAar.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-center space-y-2">
                    <Sword className="w-9 h-9 text-stone-600 mx-auto" />
                    <p className="text-sm font-semibold text-stone-300">
                      No After Action Reports Filed Yet
                    </p>
                    <p className="text-xs text-stone-500 max-w-md mx-auto">
                      AARs, friendly and enemy loss assessments, debrief notes, gun camera recordings, and BDA photography will appear here once submitted after sortie execution.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortiesWithAar.map((sortie) => {
                      const bdaVideos = sortie.bdaMediaItems.filter((m) => m.isVideo);
                      const bdaImages = sortie.bdaMediaItems.filter((m) => !m.isVideo);

                      return (
                        <div
                          key={`aar-${sortie.id}`}
                          className="rounded-2xl border border-cyan-500/30 bg-stone-950/80 p-5 space-y-4 shadow-lg"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold font-display text-cyan-300">
                                  {sortie.name} — After Action Report
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] tabular-nums font-semibold">
                                  {sortie.attendedCount} Attended / {sortie.absentCount} Absent
                                </span>
                              </div>
                              {sortie.scheduledAt && (
                                <p className="text-xs font-mono text-stone-400 mt-0.5">
                                  Flown: {formatDateTimeShort(sortie.scheduledAt)} (
                                  {formatZuluShort(sortie.scheduledAt)})
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openSortieInCalendar(sortie.id, {
                                    missionId: mission.id,
                                    missionSection: 'aar',
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                              >
                                <CalendarBlank className="w-3.5 h-3.5" />
                                <span>Calendar Record</span>
                              </button>

                              {sortie.aarDiscordMessageUrl && (
                                <button
                                  type="button"
                                  onClick={() => onOpenExternal(sortie.aarDiscordMessageUrl)}
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <DiscordLogo className="w-3.5 h-3.5" />
                                  <span>Discord AAR</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Friendly & Enemy Losses */}
                          {(sortie.ourLossesHtml ||
                            sortie.ourLosses ||
                            sortie.enemyLossesHtml ||
                            sortie.enemyLosses) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(sortie.ourLossesHtml || sortie.ourLosses) && (
                                <div className="px-4 py-3 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1.5 overflow-hidden">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                                    Friendly Losses
                                  </div>
                                  {sortie.ourLossesHtml ? (
                                    <div
                                      className={`${TACTICAL_PROSE_CLASSES} text-rose-200`}
                                      dangerouslySetInnerHTML={{ __html: sortie.ourLossesHtml }}
                                    />
                                  ) : (
                                    <p className="text-xs text-rose-200 whitespace-pre-line leading-relaxed">
                                      {sortie.ourLosses}
                                    </p>
                                  )}
                                </div>
                              )}

                              {(sortie.enemyLossesHtml || sortie.enemyLosses) && (
                                <div className="px-4 py-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-1.5 overflow-hidden">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                    Estimated Enemy Losses
                                  </div>
                                  {sortie.enemyLossesHtml ? (
                                    <div
                                      className={`${TACTICAL_PROSE_CLASSES} text-emerald-200`}
                                      dangerouslySetInnerHTML={{ __html: sortie.enemyLossesHtml }}
                                    />
                                  ) : (
                                    <p className="text-xs text-emerald-200 whitespace-pre-line leading-relaxed">
                                      {sortie.enemyLosses}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* AAR Narrative Notes */}
                          {(sortie.aarNotesHtml || sortie.aarNotes) && (
                            <div className="px-4 py-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-1.5 overflow-hidden">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                                Debrief Narrative &amp; Summary
                              </div>
                              {sortie.aarNotesHtml ? (
                                <div
                                  className={`${TACTICAL_PROSE_CLASSES} sm:text-sm`}
                                  dangerouslySetInnerHTML={{ __html: sortie.aarNotesHtml }}
                                />
                              ) : (
                                <p className="text-xs sm:text-sm text-stone-300 whitespace-pre-line leading-relaxed">
                                  {sortie.aarNotes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Gun Camera / Strike Videos */}
                          {bdaVideos.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
                                <VideoCamera className="w-4 h-4 text-rose-400" />
                                <span>Gun Camera &amp; Strike Footage ({bdaVideos.length})</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {bdaVideos.map((v, vIdx) => (
                                  <div
                                    key={`vid-${vIdx}`}
                                    className="aspect-video rounded-xl overflow-hidden border border-stone-800 bg-black"
                                  >
                                    <video
                                      controls
                                      preload="metadata"
                                      playsInline
                                      className="w-full h-full object-contain"
                                    >
                                      <source src={v.url} type={`video/${v.extension || 'mp4'}`} />
                                    </video>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* BDA Imagery Grid */}
                          {bdaImages.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold tracking-wider uppercase text-stone-300 flex items-center gap-1.5">
                                <ImageIcon className="w-4 h-4 text-cyan-400" />
                                <span>BDA Imagery ({bdaImages.length})</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                {bdaImages.map((img, iIdx) => (
                                  <button
                                    key={`bda-img-${iIdx}`}
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage({
                                        url: img.url,
                                        title: `${sortie.name} — BDA (${img.filename})`,
                                      })
                                    }
                                    className="group relative aspect-video rounded-xl overflow-hidden border border-stone-800 bg-stone-950 hover:border-cyan-500/50 transition-all"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.filename}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      loading="lazy"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== SECTION 5: COMMS, FLIGHT PLANS, FLIGHTS & INTEL ==================== */}
            {activeSection === 'comms_packages' && (
              <div className="space-y-6">
                {/* Package & Net Frequencies */}
                <div className="space-y-2.5">
                  <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    <Radio weight="duotone" className="w-4 h-4 text-amber-400" />
                    <span>Package &amp; Net Frequencies ({mission.frequencies.length})</span>
                  </h3>

                  {mission.frequencies.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-xs text-stone-500 text-center">
                      No mission-wide radio frequencies configured.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-stone-950/75">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-stone-900 border-b border-stone-800 font-sans text-[11px] uppercase tracking-wider text-stone-400">
                          <tr>
                            <th className="px-3.5 py-2.5">Agency / Station</th>
                            <th className="px-3.5 py-2.5">Frequency</th>
                            <th className="px-3.5 py-2.5">Band / Mod</th>
                            <th className="px-3.5 py-2.5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {mission.frequencies.map((freq, idx) => (
                            <tr key={idx} className="hover:bg-stone-900/50">
                              <td className="px-3.5 py-2.5 font-sans font-bold text-stone-100">
                                {freq.name}
                              </td>
                              <td className="px-3.5 py-2.5 text-amber-300 font-bold">
                                {freq.frequency} MHz
                              </td>
                              <td className="px-3.5 py-2.5 text-sky-300">
                                {freq.band} / {freq.modulation}
                              </td>
                              <td className="px-3.5 py-2.5 font-sans text-stone-400">
                                {freq.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Associated Flight Plans (Linked to ATC) */}
                <div className="space-y-2.5">
                  <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    <AirplaneTilt weight="duotone" className="w-4 h-4 text-sky-400" />
                    <span>Associated Flight Plans ({mission.flightPlans.length})</span>
                  </h3>

                  {mission.flightPlans.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-xs text-stone-500 text-center">
                      No filed or mission flight plans associated yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {mission.flightPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="p-3.5 rounded-2xl border border-stone-800 bg-stone-950/75 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display font-bold text-sm text-amber-300">
                                {plan.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-stone-900 border border-stone-700 text-[11px] font-mono text-stone-400">
                                {plan.identifier}
                              </span>
                              {plan.isFiled && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Filed
                                </span>
                              )}
                              {plan.airframeName && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-medium">
                                  {plan.airframeName}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-400 flex flex-wrap items-center gap-2">
                              {(plan.departureAirfield || plan.destinationAirfield) && (
                                <span className="font-mono">
                                  {plan.departureAirfield || 'DEP'} &rarr;{' '}
                                  {plan.destinationAirfield || 'ARR'}
                                </span>
                              )}
                              {plan.authorName && (
                                <span>&bull; by {plan.authorName}</span>
                              )}
                              <span className="font-mono">&bull; {plan.waypointsCount} WPTs</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenFlightPlanInAtc(plan.id)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-semibold shrink-0 transition-colors"
                          >
                            Open in ATC &amp; DTC &rarr;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assigned Flight Packages */}
                {mission.flights.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                      <AirplaneTakeoff weight="duotone" className="w-4 h-4 text-emerald-400" />
                      <span>Assigned Flight Packages ({mission.flights.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mission.flights.map((flight) => (
                        <div
                          key={flight.id}
                          className="p-3.5 rounded-2xl border border-stone-800 bg-stone-950/75 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-xs text-amber-300">
                              {flight.callsign}
                            </span>
                            {flight.frequency && (
                              <span className="text-xs font-mono text-sky-300">
                                {flight.frequency} MHz
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-stone-300">
                            {flight.task && (
                              <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800">
                                {flight.task}
                              </span>
                            )}
                            {flight.airframeName && (
                              <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300">
                                {flight.airframeName}
                              </span>
                            )}
                            {flight.squadronName && (
                              <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800">
                                {flight.squadronName}
                              </span>
                            )}
                          </div>
                          {flight.slots.length > 0 && (
                            <div className="pt-1.5 border-t border-stone-800/70 space-y-1">
                              {flight.slots.map((slot) => (
                                <div
                                  key={slot.position}
                                  className="flex items-center justify-between text-[11px] font-mono"
                                >
                                  <span className="text-stone-400">#{slot.position}</span>
                                  <span
                                    className={
                                      slot.pilotName ? 'text-stone-100 font-semibold' : 'text-stone-500'
                                    }
                                  >
                                    {slot.pilotName || 'Open Slot'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Mission Intel Reports */}
                <div className="space-y-2.5">
                  <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    <Binoculars weight="duotone" className="w-4 h-4 text-emerald-400" />
                    <span>Linked Intel Reports ({linkedIntels.length})</span>
                  </h3>

                  {linkedIntels.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-stone-800 bg-stone-950/40 text-xs text-stone-500 text-center">
                      No intel reports directly linked to this mission.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {linkedIntels.map((intel) => (
                        <div
                          key={intel.id}
                          className="p-3.5 rounded-2xl border border-stone-800 bg-stone-950/75 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
                                {intel.type}
                              </span>
                              <h4 className="text-xs font-bold text-stone-100 truncate">
                                {intel.title}
                              </h4>
                            </div>
                            {intel.discordMessageUrl && (
                              <button
                                type="button"
                                onClick={() => onOpenExternal(intel.discordMessageUrl)}
                                className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-indigo-300 hover:border-indigo-500/40 shrink-0"
                                title="View on Discord"
                              >
                                <DiscordLogo className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {intel.notes && (
                            <p className="text-xs text-stone-300 line-clamp-3 leading-relaxed">
                              {intel.notes}
                            </p>
                          )}
                          <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-800/70">
                            <span>{intel.reporterName || 'Squadron Pilot'}</span>
                            {intel.createdAt && <span className="font-mono">{formatDateTimeShort(intel.createdAt)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MEDIA LIGHTBOX OVERLAY ==================== */}
      {lightboxImage && (
        <div
          className="fixed inset-0 !m-0 z-[1450] bg-stone-950/65 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxImage(null);
          }}
        >
          <div
            className="max-w-5xl w-full max-h-[90vh] flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-xs text-stone-200">
              <span className="font-bold truncate">{lightboxImage.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="w-full max-h-[82vh] object-contain rounded-2xl border border-stone-800 bg-stone-950"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
