import React, { useState } from 'react';
import {
  AirplaneTilt,
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Certificate,
  Check,
  Folder,
  Gear,
  HardDrive,
  House,
  ListChecks,
  Lock,
  Medal,
  Package,
  PaintBrush,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SignOut,
  Sparkle,
  SquaresFour,
  UserCheck,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { NavigationTab } from '../types';
import { LogoutConfirmModal } from './LogoutConfirmModal';

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
  } = useApp();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const liveryCount = manifest.assets.filter((a) => a.category === 'livery').length;
  const modCount = manifest.assets.filter((a) => a.category === 'mod').length;
  const installedCount = Object.keys(installedAssets).length;

  const navSections: {
    title: string;
    items: {
      id: NavigationTab;
      label: string;
      icon: React.ReactNode;
      badge?: React.ReactNode;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'Member Dossier',
      items: [
        {
          id: 'dashboard',
          label: 'Overview',
          icon: <SquaresFour className="w-4 h-4" />,
          badge: memberProfile?.grade,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
        },
        {
          id: 'checklist',
          label: 'Member Readiness',
          icon: <ListChecks className="w-4 h-4" />,
          badge:
            checklistSummary.pendingCount > 0 ? (
              checklistSummary.pendingCount
            ) : (
              <Check weight="bold" className="w-2.5 h-2.5" />
            ),
          badgeColor:
            checklistSummary.pendingCount > 0
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
        },
        {
          id: 'airframes',
          label: 'Qualified Airframes',
          icon: <AirplaneTilt className="w-4 h-4" />,
          badge: memberProfile?.qualifiedAirframes?.length || undefined,
        },
        {
          id: 'qualifications',
          label: 'Certifications',
          icon: <Certificate className="w-4 h-4" />,
          badge: memberProfile?.certificates?.length || undefined,
        },
        {
          id: 'awards',
          label: 'Awards & Ribbons',
          icon: <Medal className="w-4 h-4" />,
          badge: memberProfile?.awards?.length || undefined,
        },
      ],
    },
    {
      title: 'Assets',
      items: [
        {
          id: 'library',
          label: 'Library',
          icon: <Folder className="w-4 h-4" />,
          badge: outdatedAssets.length > 0 ? outdatedAssets.length : installedCount,
          badgeColor:
            outdatedAssets.length > 0
              ? 'bg-amber-500 text-stone-950 font-bold animate-pulse'
              : 'bg-stone-800 text-stone-300',
        },
        {
          id: 'liveries',
          label: 'Airframe Liveries',
          icon: <PaintBrush className="w-4 h-4" />,
          badge: liveryCount,
        },
        {
          id: 'mods',
          label: 'Mods',
          icon: <Package className="w-4 h-4" />,
          badge: modCount,
        },
      ],
    },
  ];

  const activeDcsPath =
    settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath || 'Detecting...';

  return (
    <aside className="w-68 bg-stone-950/95 border-r border-stone-800/80 flex flex-col justify-between shrink-0 select-none">
      {/* Top Community Branding Header */}
      <div>
        <div className="p-5 border-b border-stone-800/80 flex items-center gap-3.5">
          <div className="rounded-xl flex items-center justify-center relative overflow-hidden shrink-0">
            <img
              src={STATIC_CONFIG.logoUrl}
              alt={STATIC_CONFIG.fullName}
              className="size-14 object-contain"
            />
            {/* <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-stone-950" /> */}
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold tracking-tight text-sm bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent leading-tight">
              Companion App
            </div>
            
            <p className="text-[10px] font-mono text-stone-500 truncate uppercase tracking-wider mt-0.5">
              Global Task Force Overlord
            </p>
          </div>
        </div>

        {/* Navigation Links — Styled after kb.globaltaskforceoverlord.org left-border list */}
        <nav className="p-4 space-y-4">
          {/* Standalone Home Navigation Item */}
          <div className="mb-1">
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
          </div>

          {/* Collapsible Category Sections */}
          {navSections.map((section) => {
            const isCollapsed = !!collapsedSections[section.title];
            return (
              <div key={section.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-amber-400/90 hover:text-amber-300 tracking-wide rounded hover:bg-stone-900/60 transition-colors group cursor-pointer"
                >
                  <span className="font-display uppercase tracking-wider text-[11px]">
                    {section.title}
                  </span>
                  <span className="text-stone-500 group-hover:text-amber-400 transition-colors">
                    {isCollapsed ? (
                      <CaretRight className="w-3.5 h-3.5" />
                    ) : (
                      <CaretDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="space-y-1 border-l-2 border-stone-800 ml-2 pl-3 pt-0.5">
                    {section.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id} className="relative">
                          <button
                            onClick={() => setActiveTab(item.id)}
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
                                className={`min-w-5 h-5 px-1.5 flex items-center justify-center text-[10px] font-mono leading-none rounded-full shrink-0 ${
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
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Quick External KB Link */}
          <div className="pt-1 px-2">
            <a
              href={STATIC_CONFIG.kbUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 text-xs font-display text-stone-400 hover:text-amber-400 transition-colors"
            >
              <span>GTFO Knowledge Base</span>
              <ArrowSquareOut className="w-3.5 h-3.5" />
            </a>
          </div>
        </nav>
      </div>

      {/* Bottom Section: Settings Action + Member Identity Card */}
      <div className="p-3 space-y-3 border-t border-stone-800/80 bg-stone-950">
        {/* Settings Navigation Button */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono transition-all group ${
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
              <span className="font-display font-bold text-[13px] block leading-tight text-stone-200 group-hover:text-amber-300">
                Settings
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-stone-500 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800/80 shrink-0">
            v{STATIC_CONFIG.appVersion}
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
                    <p className="text-xs font-display font-semibold text-stone-100 group-hover:text-amber-400 transition-colors truncate">
                      {userSession.globalName}
                    </p>
                    <span className="px-1.5 py-0.2 rounded bg-stone-800 text-amber-400 font-mono text-[10px] font-bold shrink-0">
                      {memberProfile.grade}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-stone-400 truncate">
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
            <p className="text-[11px] text-stone-400 leading-relaxed">
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
