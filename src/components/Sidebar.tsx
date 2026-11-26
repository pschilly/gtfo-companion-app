import React, { useEffect, useRef, useState } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowSquareOut,
  ArrowsClockwise,
  Binoculars,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretRight,
  Certificate,
  Check,
  Compass,
  Crosshair,
  Folder,
  Gear,
  GraduationCap,
  HardDrive,
  House,
  ListChecks,
  Lock,
  MapTrifold,
  Medal,
  Package,
  PaintBrush,
  Rows,
  Scroll,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SidebarSimple,
  SignOut,
  Sparkle,
  SquaresFour,
  UserCheck,
  UsersFour,
  Warehouse,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { CampaignSubTab, NavigationTab } from '../types';
import { getCampaignTotalIntelCount } from '../views/campaigns/utils';
import { LogoutConfirmModal } from './LogoutConfirmModal';

const SIDEBAR_COLLAPSED_KEY = 'gtfo_sidebar_collapsed_v1';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    manifest,
    installedAssets,
    outdatedAssets,
    userSession,
    effectiveTier,
    memberProfile,
    setLoginModalOpen,
    logoutDiscord,
    dcsEnv,
    settings,
    checklistSummary,
    memberFlightPlans,
    campaignsList,
    selectedCampaignId,
    activeCampaignSubTab,
    setActiveCampaignSubTab,
    currentAppVersion,
  } = useApp();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isCollapsed) {
      setHoveredSection(null);
      setPinnedSection(null);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setPinnedSection(null);
        setHoveredSection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSidebarCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };
  // User manual collapse/expand overrides (collapsed by default unless active tab is inside)
  const [sectionOpenOverrides, setSectionOpenOverrides] = useState<Record<string, boolean>>({});

  const isTabMatch = (itemId?: NavigationTab, currentTab?: NavigationTab) => {
    if (!itemId || !currentTab) return false;
    if (itemId === currentTab) return true;
    if (
      itemId === 'library' &&
      (currentTab === 'library' || currentTab === 'liveries' || currentTab === 'mods')
    ) {
      return true;
    }
    return false;
  };

  const isSectionOpen = (sectionTitle: string, items: { id?: NavigationTab }[]) => {
    if (sectionOpenOverrides[sectionTitle] !== undefined) {
      return sectionOpenOverrides[sectionTitle];
    }
    // Collapsed by default; if activeTab is an item in this section, keep it expanded
    return items.some((item) => isTabMatch(item.id, activeTab));
  };

  const toggleSection = (title: string, items: { id?: NavigationTab }[]) => {
    setSectionOpenOverrides((prev) => {
      const currentlyOpen =
        prev[title] !== undefined
          ? prev[title]
          : items.some((item) => isTabMatch(item.id, activeTab));
      return {
        ...prev,
        [title]: !currentlyOpen,
      };
    });
  };

  const totalAssetsCount = manifest.assets.length;
  const activeCampaigns = campaignsList.filter((c) => c.isActive);
  const activeCampaignsCount = activeCampaigns.length;
  const activeSidebarCampaign =
    activeCampaigns.find((c) => c.id === selectedCampaignId) || activeCampaigns[0] || null;

  const campaignSubItems: Array<{
    subTab: CampaignSubTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      subTab: 'overview',
      label: 'Overview',
      icon: <Rows className="w-3.5 h-3.5" />,
    },
    {
      subTab: 'map',
      label: 'Campaign Map',
      icon: <MapTrifold className="w-3.5 h-3.5" />,
    },
    {
      subTab: 'lore',
      label: 'Campaign Lore',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      badge: activeSidebarCampaign?.loresCount || undefined,
    },
    {
      subTab: 'missions',
      label: 'Missions',
      icon: <AirplaneTakeoff className="w-3.5 h-3.5" />,
      badge: activeSidebarCampaign?.missions.length || undefined,
    },
    {
      subTab: 'intel',
      label: 'Intel Reports',
      icon: <Binoculars className="w-3.5 h-3.5" />,
      badge: getCampaignTotalIntelCount(activeSidebarCampaign) || undefined,
    },
    {
      subTab: 'airframes',
      label: 'Airframes',
      icon: <AirplaneTilt className="w-3.5 h-3.5" />,
      badge:
        activeSidebarCampaign?.totalTrackedAirframes ||
        activeSidebarCampaign?.airframeSquadronGroups.length ||
        undefined,
    },
  ];

  const navSections: {
    title: string;
    icon: React.ReactNode;
    items: {
      id?: NavigationTab;
      label: string;
      icon: React.ReactNode;
      href?: string;
      badge?: React.ReactNode;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'Your Dossier',
      icon: <SquaresFour className="w-4 h-4" />,
      items: [
        {
          id: 'dashboard',
          label: 'Overview',
          icon: <SquaresFour className="w-4 h-4" />,
          badge: memberProfile?.grade,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        },
        {
          id: 'airframes',
          label: 'Qualified Airframes',
          icon: <AirplaneTilt className="w-4 h-4" />,
          badge: memberProfile.qualifiedAirframes?.length || undefined,
        },
        {
          id: 'qualifications',
          label: 'Certifications',
          icon: <Certificate className="w-4 h-4" />,
          badge: memberProfile.certificates?.length || undefined,
        },
        {
          id: 'awards',
          label: 'Awards & Ribbons',
          icon: <Medal className="w-4 h-4" />,
          badge: memberProfile.awards?.length || undefined,
        },
        {
          id: 'service_record',
          label: 'Service Record',
          icon: <Scroll className="w-4 h-4" />,
          badge: memberProfile.serviceRecords?.length || undefined,
        },
      ],
    },
    {
      title: 'S1 - Personnel',
      icon: <UsersFour className="w-4 h-4" />,
      items: [
        {
          id: 'squadrons',
          label: 'Squadrons',
          icon: <AirplaneTilt className="w-4 h-4" />,
        },
        {
          id: 'roster',
          label: 'Taskforce Roster',
          icon: <UserCheck className="w-4 h-4" />,
          badge: settings.rosterShowAllMembers ? 'ALL' : 'CORE',
          badgeColor: settings.rosterShowAllMembers
            ? 'bg-stone-800 text-stone-300'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold',
        },
      ],
    },
    {
      title: 'S2 - Operations',
      icon: <Crosshair className="w-4 h-4" />,
      items: [
        {
          id: 'campaigns',
          label: 'Campaigns',
          icon: <Crosshair className="w-4 h-4" />,
          badge: activeCampaignsCount > 0 ? activeCampaignsCount : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        },
        {
          id: 'atc',
          label: 'Air Traffic Control',
          icon: <Compass className="w-4 h-4" />,
          badge: memberFlightPlans?.length || undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        },
      ],
    },
    {
      title: 'S3 - Training',
      icon: <GraduationCap className="w-4 h-4" />,
      items: [
        {
          id: 'qualifications_zone',
          label: 'Qualifications Zone',
          icon: <GraduationCap className="w-4 h-4" />,
          badge: (settings.trackedQualificationIds || []).length > 0
            ? `${(settings.trackedQualificationIds || []).length}`
            : undefined,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold',
        },
        {
          label: 'Knowledge Base',
          icon: <BookOpen className="w-4 h-4" />,
          href: STATIC_CONFIG.kbUrl,
        },
      ],
    },
    {
      title: 'S4 - Logistics',
      icon: <Warehouse className="w-4 h-4" />,
      items: [
        {
          id: 'library',
          label: 'Asset Manager',
          icon: <Package className="w-4 h-4" />,
          badge: outdatedAssets.length > 0 ? outdatedAssets.length : totalAssetsCount,
          badgeColor:
            outdatedAssets.length > 0
              ? 'bg-amber-500 text-stone-950 font-bold animate-pulse'
              : 'bg-stone-800 text-stone-300',
        },
      ],
    },
  ];

  const activeDcsPath =
    settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath || 'Detecting...';

  return (
    <aside
      ref={sidebarRef}
      className={`${
        isCollapsed ? 'w-[68px]' : 'w-64'
      } bg-stone-950/95 border-r border-stone-800/80 flex flex-col justify-between shrink-0 select-none transition-all duration-200 relative z-50`}
    >
      {/* Top Community Branding Header */}
      <div className="flex-1 flex flex-col min-h-0">
        {isCollapsed ? (
          <div className="py-3.5 px-2 border-b border-stone-800/80 flex flex-col items-center gap-2.5 shrink-0">
            <img
              src={STATIC_CONFIG.logoUrl}
              alt={STATIC_CONFIG.fullName}
              className="size-9 object-contain"
            />
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="w-8 h-8 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-amber-400 flex items-center justify-center transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <SidebarSimple className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 border-b border-stone-800/80 flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
                <img
                  src={STATIC_CONFIG.logoUrl}
                  alt={STATIC_CONFIG.fullName}
                  className="size-12 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold tracking-wide text-base bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent leading-tight">
                  GTFO Companion
                </div>
                {/* <p className="text-[11px] text-stone-500 truncate uppercase tracking-wider mt-0.5">
                  Global Task Force Overlord
                </p> */}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="p-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 border border-stone-800/90 text-stone-400 hover:text-amber-400 transition-colors shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <SidebarSimple className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links — Styled after kb.globaltaskforceoverlord.org left-border list */}
        <nav
          className={`flex-1 ${
            isCollapsed
              ? 'overflow-visible py-3 px-2 space-y-1.5'
              : 'overflow-y-auto overflow-x-hidden p-4 space-y-4'
          }`}
        >
          {isCollapsed ? (
            <>
              {/* Standalone Home & Event Calendar Icon Buttons */}
              <div className="space-y-1.5">
                <button
                  onClick={() => setActiveTab('home')}
                  title="Home"
                  aria-label="Home"
                  className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center relative transition-all duration-150 ${
                    activeTab === 'home'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                  }`}
                >
                  <House className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setActiveTab('calendar')}
                  title="Event Calendar"
                  aria-label="Event Calendar"
                  className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center relative transition-all duration-150 ${
                    activeTab === 'calendar'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                  }`}
                >
                  <CalendarBlank className="w-4 h-4" />
                </button>
              </div>

              <div className="my-2 border-t border-stone-800/70 mx-2" />

              {/* Collapsed Category Icons with Hover / Click Popouts */}
              <div className="space-y-1.5">
                {navSections.map((section) => {
                  const isSectionActive = section.items.some((item) =>
                    isTabMatch(item.id, activeTab)
                  );
                  const isPopoutOpen =
                    hoveredSection === section.title || pinnedSection === section.title;
                  const hasOutdatedInSection = section.items.some(
                    (item) => item.id === 'library' && outdatedAssets.length > 0
                  );

                  return (
                    <div
                      key={section.title}
                      className="relative"
                      onMouseEnter={() => setHoveredSection(section.title)}
                      onMouseLeave={() =>
                        setHoveredSection((prev) => (prev === section.title ? null : prev))
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setPinnedSection((prev) =>
                            prev === section.title ? null : section.title
                          )
                        }
                        title={section.title}
                        aria-label={section.title}
                        aria-expanded={isPopoutOpen}
                        className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center relative transition-all duration-150 cursor-pointer ${
                          isSectionActive || isPopoutOpen
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-sm'
                            : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                        }`}
                      >
                        {section.icon}
                        {hasOutdatedInSection && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </button>

                      {isPopoutOpen && (
                        <div className="absolute left-full top-0 pl-2 z-50">
                          <div className="w-56 rounded-2xl bg-stone-950/95 backdrop-blur-xl border border-stone-800 shadow-2xl shadow-black p-2 space-y-1 ring-1 ring-white/10">
                            <div className="px-2.5 py-1.5 border-b border-stone-800/80 flex items-center gap-2 text-amber-400">
                              <span className="shrink-0">{section.icon}</span>
                              <span className="font-display uppercase tracking-wider text-xs font-bold truncate">
                                {section.title}
                              </span>
                            </div>

                            <div className="pt-0.5 space-y-1">
                              {section.items.map((item) => {
                                if (item.href) {
                                  return (
                                    <a
                                      key={item.label}
                                      href={item.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => {
                                        setPinnedSection(null);
                                        setHoveredSection(null);
                                      }}
                                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 text-stone-400 hover:text-stone-200 hover:bg-stone-900/80 group"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-stone-400 group-hover:text-amber-400 transition-colors shrink-0">
                                          {item.icon}
                                        </span>
                                        <span className="font-display text-[13px] group-hover:text-amber-300 transition-colors truncate">
                                          {item.label}
                                        </span>
                                      </div>
                                      <ArrowSquareOut className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 transition-colors shrink-0" />
                                    </a>
                                  );
                                }

                                const isActive = isTabMatch(item.id, activeTab);
                                return (
                                  <div key={item.id} className="space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.id) setActiveTab(item.id);
                                        setPinnedSection(null);
                                        setHoveredSection(null);
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                                        isActive
                                          ? 'font-semibold text-amber-400 bg-amber-500/10'
                                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/80'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                          className={`shrink-0 ${
                                            isActive ? 'text-amber-400' : 'text-stone-400'
                                          }`}
                                        >
                                          {item.icon}
                                        </span>
                                        <span className="font-display text-[13px] truncate">
                                          {item.label}
                                        </span>
                                      </div>
                                      {item.badge !== undefined && item.badge !== 0 && (
                                        <span
                                          className={`min-w-5 h-5 px-1.5 flex items-center justify-center text-[11px] font-bold tabular-nums leading-none rounded-full shrink-0 ${
                                            item.badgeColor ||
                                            (isActive
                                              ? 'bg-amber-500/20 text-amber-300'
                                              : 'bg-stone-900 text-stone-400 border border-stone-800')
                                          }`}
                                        >
                                          {item.badge}
                                        </span>
                                      )}
                                    </button>
                                    {item.id === 'campaigns' && (
                                      <div className="ml-3 pl-2.5 border-l border-stone-800/90 space-y-0.5">
                                        {campaignSubItems.map((sub) => {
                                          const isSubActive =
                                            activeTab === 'campaigns' &&
                                            activeCampaignSubTab === sub.subTab;
                                          return (
                                            <button
                                              key={sub.subTab}
                                              type="button"
                                              onClick={() => {
                                                setActiveCampaignSubTab(sub.subTab);
                                                setActiveTab('campaigns');
                                                setPinnedSection(null);
                                                setHoveredSection(null);
                                              }}
                                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                                isSubActive
                                                  ? 'text-amber-300 bg-amber-500/10 font-semibold'
                                                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                                              }`}
                                            >
                                              <span className="flex items-center gap-2 truncate">
                                                {sub.icon}
                                                <span className="truncate">{sub.label}</span>
                                              </span>
                                              {sub.badge !== undefined && sub.badge > 0 && (
                                                <span className="text-[11px] font-semibold tabular-nums text-stone-500">
                                                  {sub.badge}
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Standalone Home & Event Calendar Navigation Items */}
              <div className="mb-1 space-y-1">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 relative ${
                    activeTab === 'home'
                      ? 'font-semibold text-amber-400 bg-amber-500/10 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={activeTab === 'home' ? 'text-amber-400' : 'text-stone-400'}>
                      <House className="w-4 h-4" />
                    </span>
                    <span className="font-display text-[13px]">Home</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 relative ${
                    activeTab === 'calendar'
                      ? 'font-semibold text-amber-400 bg-amber-500/10 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={activeTab === 'calendar' ? 'text-amber-400' : 'text-stone-400'}>
                      <CalendarBlank className="w-4 h-4" />
                    </span>
                    <span className="font-display text-[13px]">Event Calendar</span>
                  </div>
                </button>
              </div>

              {/* Collapsible Category Sections */}
              {navSections.map((section) => {
                const isOpen = isSectionOpen(section.title, section.items);
                const isSectionActive = section.items.some((item) => isTabMatch(item.id, activeTab));
                return (
                  <div key={section.title} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.title, section.items)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold tracking-wide rounded-lg hover:bg-stone-900/60 transition-all group cursor-pointer ${
                        isSectionActive
                          ? 'text-amber-400 bg-amber-500/5'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-amber-400/80 group-hover:text-amber-300 transition-colors shrink-0">
                          {section.icon}
                        </span>
                        <span className="font-display uppercase tracking-wider text-xs truncate">
                          {section.title}
                        </span>
                        {!isOpen && isSectionActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] shrink-0" />
                        )}
                      </div>
                      <span className="text-stone-500 group-hover:text-amber-400 transition-colors shrink-0">
                        {isOpen ? (
                          <CaretDown className="w-3.5 h-3.5" />
                        ) : (
                          <CaretRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="space-y-1 border-l-2 border-stone-800 ml-2 pl-3 pt-0.5">
                        {section.items.map((item) => {
                          if (item.href) {
                            return (
                              <li key={item.label} className="relative">
                                <a
                                  href={item.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 text-stone-400 hover:text-stone-200 hover:bg-stone-900/70 group"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-stone-400 group-hover:text-amber-400 transition-colors">
                                      {item.icon}
                                    </span>
                                    <span className="font-display text-[13px] group-hover:text-amber-300 transition-colors">
                                      {item.label}
                                    </span>
                                  </div>
                                  <ArrowSquareOut className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 transition-colors" />
                                </a>
                              </li>
                            );
                          }
                          const isActive = isTabMatch(item.id, activeTab);
                          return (
                            <li key={item.id} className="relative space-y-1">
                              <button
                                onClick={() => item.id && setActiveTab(item.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 relative ${
                                  isActive
                                    ? 'font-semibold text-amber-400 bg-amber-500/10 before:content-[""] before:absolute before:-left-[17px] before:top-1/2 before:-translate-y-1/2 before:h-2 before:w-2 before:rounded-full before:bg-amber-400 before:shadow-[0_0_8px_#fbbf24]'
                                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={isActive ? 'text-amber-400' : 'text-stone-400'}>
                                    {item.icon}
                                  </span>
                                  <span className="font-display text-[13px]">{item.label}</span>
                                </div>
                                {item.badge !== undefined && item.badge !== 0 && (
                                  <span
                                    className={`min-w-5 h-5 px-1.5 flex items-center justify-center text-[11px] font-bold tabular-nums leading-none rounded-full shrink-0 ${
                                      item.badgeColor ||
                                      (isActive
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-stone-900 text-stone-400 border border-stone-800')
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </button>

                              {item.id === 'campaigns' && activeTab === 'campaigns' && (
                                <ul className="ml-3 pl-3 border-l border-stone-800 space-y-0.5 pt-0.5">
                                  {campaignSubItems.map((sub) => {
                                    const isSubActive = activeCampaignSubTab === sub.subTab;
                                    return (
                                      <li key={sub.subTab}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveCampaignSubTab(sub.subTab);
                                            setActiveTab('campaigns');
                                          }}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                            isSubActive
                                              ? 'font-semibold text-amber-300 bg-amber-500/10'
                                              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/70'
                                          }`}
                                        >
                                          <span className="flex items-center gap-2 truncate">
                                            <span
                                              className={
                                                isSubActive ? 'text-amber-400' : 'text-stone-500'
                                              }
                                            >
                                              {sub.icon}
                                            </span>
                                            <span className="truncate">{sub.label}</span>
                                          </span>
                                          {sub.badge !== undefined && sub.badge > 0 && (
                                            <span className="text-[11px] font-semibold tabular-nums text-stone-500">
                                              {sub.badge}
                                            </span>
                                          )}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </nav>
      </div>

      {/* Bottom Section: Settings Action + Member Identity Card */}
      {isCollapsed ? (
        <div className="p-2 space-y-2.5 border-t border-stone-800/80 bg-stone-950 shrink-0 flex flex-col items-center">
          {/* Collapsed Settings Icon Button */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-10 h-10 mx-auto rounded-xl border flex items-center justify-center transition-all group ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 text-stone-400 hover:text-amber-400 hover:bg-stone-900'
            }`}
            title={`Settings (v${currentAppVersion})`}
            aria-label="Settings"
          >
            <Gear className={`w-4 h-4 ${activeTab === 'settings' ? 'text-amber-400 animate-spin-slow' : ''}`} />
          </button>

          {/* Collapsed User Profile / Sign Out */}
          {userSession ? (
            <div className="flex flex-col items-center gap-1.5 w-full pt-1 border-t border-stone-800/70">
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                title={`${userSession.globalName} (${memberProfile.grade}) — Membership Clearance`}
                className="w-9 h-9 mx-auto rounded-lg overflow-hidden border border-stone-700 hover:border-amber-500/60 transition-colors cursor-pointer flex items-center justify-center bg-amber-500/20 text-amber-300 font-display font-bold text-xs"
              >
                {userSession.avatarUrl ? (
                  <img
                    src={userSession.avatarUrl}
                    alt={userSession.globalName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userSession.globalName.slice(0, 2).toUpperCase()
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out of Discord"
                aria-label="Sign out of Discord"
                className="w-8 h-8 mx-auto rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
              >
                <SignOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              title="Sign in with Discord"
              aria-label="Sign in with Discord"
              className="w-10 h-10 mx-auto rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center shadow-sm transition-all"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-3 space-y-3 border-t border-stone-800/80 bg-stone-950 shrink-0">
          {/* Settings Navigation Button */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all group ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100 hover:bg-stone-900'
            }`}
            title="Open Settings (DCS Configuration, Updates & About)"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-amber-500/30 text-amber-300'
                    : 'bg-stone-800/80 text-stone-400 group-hover:text-amber-400 group-hover:bg-stone-800'
                }`}
              >
                <Gear className={`w-4 h-4 ${activeTab === 'settings' ? 'text-amber-400 animate-spin-slow' : ''}`} />
              </div>
              <div className="text-left min-w-0">
                <span className="font-display font-bold text-sm block leading-tight text-stone-200 group-hover:text-amber-300">
                  Settings
                </span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-stone-500 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800/80 shrink-0">
              v{currentAppVersion}
            </span>
          </button>

          {/* User Discord & Member Dossier Mini Card */}
          {userSession ? (
            <div className="p-3 rounded-xl bg-stone-900/95 border border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={() => setLoginModalOpen(true)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
                  title="Click to view Membership Clearance & Discord Role Sync"
                >
                  {userSession.avatarUrl ? (
                    <img
                      src={userSession.avatarUrl}
                      alt={userSession.globalName}
                      className="w-9 h-9 rounded-lg object-cover border border-stone-700 group-hover:border-amber-500/60 transition-colors shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm border bg-amber-500/20 border-amber-500/50 text-amber-300 shrink-0">
                      {userSession.globalName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-display font-semibold text-stone-100 group-hover:text-amber-400 transition-colors truncate">
                        {userSession.globalName}
                      </p>
                      <span className="px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono text-[11px] font-bold shrink-0">
                        {memberProfile.grade}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 truncate">
                      {memberProfile.adminPosition
                        ? memberProfile.adminPosition
                        : memberProfile.squadronAssignment
                        ? `${memberProfile.squadronAssignment.code} "${memberProfile.squadronAssignment.nickname}"`
                        : `@${userSession.username}`}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: Role Sync & Sign Out */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setLoginModalOpen(true)}
                    title="Membership Clearance & Discord Role Sync"
                    className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors"
                  >
                    <ArrowsClockwise className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    title="Sign out of Discord"
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <SignOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-display font-medium text-amber-300">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Discord Auth Required</span>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Sign in with Discord to verify your Global Task Force Overlord membership roles.
              </p>
              <button
                onClick={() => setLoginModalOpen(true)}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <UserCheck className="w-4 h-4" />
                Sign in with Discord
              </button>
            </div>
          )}
        </div>
      )}

      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={logoutDiscord}
        callsign={userSession?.globalName || userSession?.username || 'Pilot'}
        avatarUrl={userSession?.avatarUrl}
      />
    </aside>
  );
};
