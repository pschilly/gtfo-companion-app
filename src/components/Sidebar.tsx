import React, { useState } from 'react';
import {
  AirplaneTilt,
  ArrowSquareOut,
  ArrowsClockwise,
  Certificate,
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

  const liveryCount = manifest.assets.filter((a) => a.category === 'livery').length;
  const modCount = manifest.assets.filter((a) => a.category === 'mod').length;
  const installedCount = Object.keys(installedAssets).length;

  const navSections: {
    title: string;
    items: {
      id: NavigationTab;
      label: string;
      icon: React.ReactNode;
      badge?: number | string;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'Operations',
      items: [
        {
          id: 'home',
          label: 'House',
          icon: <House className="w-4 h-4" />,
        },
      ],
    },
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
          badge: checklistSummary.pendingCount > 0 ? checklistSummary.pendingCount : '✓',
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
    }
    // {
    //   title: 'Configuration',
    //   items: [
    //     {
    //       id: 'settings',
    //       label: 'System Gear',
    //       icon: <Gear className="w-4 h-4" />,
    //     },
    //   ],
    // },
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

        {/* NavigationArrow Links — Styled after kb.globaltaskforceoverlord.org left-border list */}
        <nav className="p-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-display text-xs font-semibold text-amber-400 tracking-wide px-2 mb-2">
                {section.title}
              </h3>
              <ul className="space-y-1 border-l-2 border-stone-800 ml-2 pl-3">
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
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
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
            </div>
          ))}

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

      {/* Bottom Section: DCS Target Path + Member Identity Card */}
      <div className="p-3 space-y-3 border-t border-stone-800/80 bg-stone-950">
        {/* DCS Saved Games Target Indicator */}
        <div
          onClick={() => setActiveTab('settings')}
          className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800 hover:border-stone-700 cursor-pointer transition-colors"
          title="Click to configure DCS Saved Games directory"
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-amber-400" />
              DCS Target Mount
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              MOUNTED
            </span>
          </div>
          <p className="text-[11px] font-mono text-stone-300 truncate" title={activeDcsPath}>
            {activeDcsPath}
          </p>
        </div>

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

            {/* Member Grade + Clearance Status Pill (Moved from TopBar) */}
            {/* <button
              onClick={() => setLoginModalOpen(true)}
              title="Click to view Membership Clearance & Discord Role Sync"
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-semibold transition-all ${
                effectiveTier === 'core'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : effectiveTier === 'community'
                  ? 'bg-stone-800/80 border-stone-700 text-stone-200 hover:border-amber-500/40'
                  : 'bg-stone-800 border-stone-800 text-stone-300 hover:border-amber-500/50'
              }`}
            >
              {effectiveTier === 'core' ? (
                <>
                  <span className="flex items-center gap-1.5 truncate">
                    <Sparkle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      CORE // {memberProfile.grade}
                      {memberProfile.squadronAssignment?.code
                        ? ` (${memberProfile.squadronAssignment.code})`
                        : ''}
                    </span>
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-normal shrink-0">Sync</span>
                </>
              ) : effectiveTier === 'community' ? (
                <>
                  <span className="flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">COMMUNITY // {memberProfile.grade}</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-normal shrink-0">Sync</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 truncate">
                    <ShieldWarning className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>UNVERIFIED</span>
                  </span>
                  <span className="text-[10px] text-amber-400 font-normal shrink-0">Sync</span>
                </>
              )}
            </button> */}
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
