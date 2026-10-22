import React, { useState } from 'react';
import {
  AirplaneTilt,
  ArrowCircleUp,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  Certificate,
  CheckCircle,
  DownloadSimple,
  Folder,
  Medal,
  Package,
  PaintBrush,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  Users,
  Warning,
} from '@phosphor-icons/react';
import { DossierNav } from '../components/DossierNav';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { GTFO_GRADE_META } from '../data/portalData';
import { MemberGradeLevel } from '../types';

export const DashboardView: React.FC = () => {
  const {
    manifest,
    installedAssets,
    outdatedAssets,
    missingRequiredAssets,
    effectiveTier,
    memberProfile,
    isPortalLive,
    syncMemberPortal,
    syncManifest,
    setActiveTab,
    updateAllOutdated,
    installAllRequiredForUser,
    dcsEnv,
    settings,
    userSession,
    dcsNicknameInfo,
    expectedDcsNickname,
    isNicknameMatching,
    updateDcsNickname,
  } = useApp();

  const [isSyncingPortal, setIsSyncingPortal] = useState(false);

  const airframes = memberProfile.qualifiedAirframes || [];
  const primaryAirframe = airframes.find((a) => a.isPrimary) || airframes[0] || null;
  const certificates = memberProfile.certificates || [];
  const awards = memberProfile.awards || [];
  const totalCertXp = certificates.reduce((sum, c) => sum + (c.xpValue || 0), 0);
  const totalAwardXp = awards.reduce((sum, a) => sum + (a.xpValue || 0), 0);
  const installedCount = Object.keys(installedAssets).length;

  const handlePortalRefresh = async () => {
    setIsSyncingPortal(true);
    try {
      await Promise.all([syncMemberPortal(), syncManifest()]);
    } finally {
      setIsSyncingPortal(false);
    }
  };

  const gradeList = Object.keys(GTFO_GRADE_META) as MemberGradeLevel[];
  const currentGradeIdx = gradeList.indexOf(memberProfile.grade);
  const currentGradeMeta = GTFO_GRADE_META[memberProfile.grade] || GTFO_GRADE_META.G1;

  const xpProgressPercent = (() => {
    if (!memberProfile.nextGrade) return 100;
    if (typeof memberProfile.gradePercentage === 'number' && memberProfile.gradePercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.gradePercentage));
    }
    if (typeof memberProfile.tierPercentage === 'number' && memberProfile.tierPercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.tierPercentage));
    }
    const nextCeiling = memberProfile.nextGrade.xpRequired || 1;
    return Math.min(100, Math.max(4, ((memberProfile.xp || 0) / nextCeiling) * 100));
  })();

  const avatarSrc = memberProfile.avatarUrl || userSession?.avatarUrl || null;

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub NavigationArrow */}
      <DossierNav />

      {/* MEMBER DOSSIER HERO CARD (KB Theme) */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/90 shadow-2xl">
        {/* Decorative KB Amber/Red Glows */}
        <div className="absolute -top-28 -left-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-24 w-96 h-96 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

        {/* Top Dossier Status Bar */}
        <div className="relative z-10 px-6 py-3.5 bg-stone-950/80 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wider text-amber-400">
              <SquaresFour className="w-3.5 h-3.5" />
              <span>Member Dossier</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePortalRefresh}
              disabled={isSyncingPortal}
              className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-[11px] font-mono flex items-center gap-1.5 transition-all"
            >
              <ArrowsClockwise
                className={`w-3 h-3 text-amber-400 ${isSyncingPortal ? 'animate-spin' : ''}`}
              />
              <span>Sync Portal</span>
            </button>

            <a
              href={STATIC_CONFIG.kbUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-400 text-[11px] font-mono flex items-center gap-1 transition-all"
            >
              <span>Knowledge Base</span>
              <ArrowSquareOut className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Main Dossier Body: 3 Columns (Pilot Identity & Tier | Grade Progression | Squadron Assignment) */}
        <div className="relative z-10 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Column 1: Pilot Identity & Membership Status (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-xl bg-stone-950/75 border border-stone-800/90 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {memberProfile.isCouncilMember && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                    <Sparkle className="w-3 h-3 text-amber-300" />
                    Council Member
                  </span>
                )}
                {memberProfile.isSquadronLeader && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                    Squadron Leadership
                  </span>
                )}
                {effectiveTier === 'core' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                    CORE Roster
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-200 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                    Community Roster
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={memberProfile.callsign}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/50 shadow-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-stone-900 border-2 border-amber-500/50 flex items-center justify-center font-display font-bold text-xl text-amber-400 shrink-0">
                  {memberProfile.callsign.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-0.5">
                <h1 className="font-display text-xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent truncate">
                  {memberProfile.callsign}
                </h1>
                {memberProfile.adminPosition ? (
                  <div className="text-xs font-mono font-semibold text-amber-300 truncate">
                    {memberProfile.adminPosition}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-amber-400 truncate">
                    {memberProfile.position}
                  </div>
                )}
                <div className="text-xs font-mono text-stone-400 truncate">
                  {memberProfile.adminPositions && memberProfile.adminPositions.length > 1
                    ? `${memberProfile.adminPositions.filter((p) => p !== memberProfile.adminPosition)[0]}`
                    : ''}
                </div>

                <div className="flex items-center gap-1.5 pt-1 text-[11px] font-mono">
                  <span className="text-stone-400">DCS Tag:</span>
                  <span
                    className={`font-semibold truncate max-w-[120px] ${
                      isNicknameMatching ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                    title={dcsNicknameInfo?.currentNickname || expectedDcsNickname}
                  >
                    {dcsNicknameInfo?.currentNickname || expectedDcsNickname}
                  </span>
                  {isNicknameMatching ? (
                    <span title="DCS slot #1 matches GTFO tag" className="inline-flex">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    </span>
                  ) : (
                    <button
                      onClick={() => updateDcsNickname(expectedDcsNickname)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors shrink-0"
                      title="Set DCS Nickname in nicknames.lua slot #1"
                    >
                      Fix Tag
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-stone-400">
                Time Served:{' '}
                <strong className="text-stone-200">
                  {memberProfile.timeServedLabel || `${memberProfile.timeServedMonths} mo`}
                </strong>
              </span>
              <span
                className="text-stone-400 flex items-center gap-1.5 cursor-help"
                title={memberProfile.dcsUcid ? `DCS UCID: ${memberProfile.dcsUcid}` : 'DCS UCID unlinked'}
              >
                {memberProfile.dcsUcid ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                    <span className="text-stone-300">DCS Server Bot Linked</span>
                  </>
                ) : (
                  <span>Enlisted {memberProfile.joinedAt}</span>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-800/60">
              <button
                onClick={() => setActiveTab('airframes')}
                className="px-2 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[10px] font-mono text-stone-300 flex items-center gap-1 transition-colors hover:text-amber-300"
                title="View Qualified Airframes"
              >
                <AirplaneTilt className="w-3 h-3 text-amber-400" />
                <span>{airframes.length} Airframe{airframes.length === 1 ? '' : 's'}</span>
              </button>
              <button
                onClick={() => setActiveTab('qualifications')}
                className="px-2 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[10px] font-mono text-stone-300 flex items-center gap-1 transition-colors hover:text-amber-300"
                title="View Combat Qualifications"
              >
                <Certificate className="w-3 h-3 text-amber-400" />
                <span>{certificates.length} Cert{certificates.length === 1 ? '' : 's'}</span>
              </button>
              <button
                onClick={() => setActiveTab('awards')}
                className="px-2 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-800 text-[10px] font-mono text-stone-300 flex items-center gap-1 transition-colors hover:text-amber-300"
                title="View Awards & Ribbons"
              >
                <Medal className="w-3 h-3 text-amber-400" />
                <span>{awards.length} Medal{awards.length === 1 ? '' : 's'}</span>
              </button>
            </div>
          </div>

          {/* Column 2: Official KB Grade Card (G0 - G11) (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-xl bg-stone-950/75 border border-stone-800/90 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-display font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Medal className="w-4 h-4" />
                <span>Service Grade &amp; Seniority</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[11px] font-mono text-amber-300 font-bold shrink-0">
                {memberProfile.grade}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-stone-900 border border-stone-800 p-2 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src={memberProfile.gradeIconUrl || currentGradeMeta.iconUrl}
                  alt={memberProfile.gradeTitle}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="font-display text-lg font-bold text-stone-100">
                  {memberProfile.gradeTitle}
                </div>
                <div className="text-xs font-mono text-amber-400">
                  {(memberProfile.xp || 0).toLocaleString()} XP Earned
                </div>
                {/* <p className="text-xs font-mono text-stone-400 truncate">
                  {memberProfile.nextGrade && typeof memberProfile.remainingXp === 'number'
                    ? `${memberProfile.remainingXp.toLocaleString()} XP remaining to ${
                        memberProfile.nextGrade.grade
                      }`
                    : currentGradeMeta.notes}
                </p> */}
              </div>
            </div>

            <div className="space-y-1.5 pt-2.5 border-t border-stone-800/80">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-stone-400">
                  Current: <strong className="text-stone-200">{memberProfile.grade}</strong>
                </span>
                <span className="text-stone-400">
                  {memberProfile.nextGrade ? (
                    <>
                      Next:{' '}
                      <strong className="text-amber-400">
                        {memberProfile.nextGrade.grade} (
                        {memberProfile.nextGrade.xpRequired.toLocaleString()} XP)
                      </strong>{' '}
                      <span className="text-stone-300">
                        &bull; {Math.round(xpProgressPercent)}%
                      </span>
                    </>
                  ) : (
                    <strong className="text-amber-400">Maximum Grade Achieved (G11)</strong>
                  )}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                  style={{
                    width: `${xpProgressPercent}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Column 3: Squadron Assignment Card (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-xl bg-stone-950/75 border border-stone-800/90 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-display font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Squadron Assignment</span>
              </span>
              {memberProfile.squadronAssignment ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold uppercase shrink-0">
                  {memberProfile.squadronAssignment.code}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-400 text-[10px] font-mono uppercase shrink-0">
                  UNASSIGNED
                </span>
              )}
            </div>

            {memberProfile.squadronAssignment ? (
              <>
                <div className="flex items-center gap-4">
                  <img
                    src={memberProfile.squadronAssignment.emblemUrl}
                    alt={memberProfile.squadronAssignment.name}
                    className="w-16 h-16 rounded-xl object-contain bg-stone-900 p-1.5 border border-stone-800 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="font-display text-base font-bold text-stone-100 truncate">
                      {memberProfile.squadronAssignment.name}
                    </div>
                    {memberProfile.squadronAssignment.nickname && (
                      <div className="text-xs font-mono text-amber-400 font-semibold truncate">
                        &quot;{memberProfile.squadronAssignment.nickname}&quot;
                      </div>
                    )}
                    {(memberProfile.squadronAssignment.primaryAirframe ||
                      memberProfile.squadronAssignment.radioCallsign) && (
                      <div className="text-xs font-mono text-stone-400 truncate">
                        {memberProfile.squadronAssignment.primaryAirframe}
                        {memberProfile.squadronAssignment.primaryAirframe &&
                        memberProfile.squadronAssignment.radioCallsign
                          ? ' • '
                          : ''}
                        {memberProfile.squadronAssignment.radioCallsign && (
                          <span className="text-stone-200">
                            {memberProfile.squadronAssignment.radioCallsign}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-stone-400">
                    Billet: <strong className="text-stone-200">{memberProfile.position}</strong>
                  </span>
                  <span className="text-stone-400">
                    Flight ID:{' '}
                    <strong className="text-amber-400">
                      {memberProfile.flightIdentifier
                        ? `${memberProfile.flightIdentifier}`
                        : memberProfile.position}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800/80 text-xs text-stone-400 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-200 font-display font-semibold">
                    <AirplaneTilt className="w-4 h-4 text-amber-400" />
                    <span>General Community Aviation Wing</span>
                  </div>
                  <p className="leading-relaxed">
                    Flying as a General Community Member without a fixed CORE squadron billet.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
                  <span>Status: Community Wing</span>
                  <span className="text-amber-400">Unassigned</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Quick Action Strip */}
        <div className="relative z-10 px-6 py-4 bg-stone-950/90 border-t border-stone-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {missingRequiredAssets.length > 0 && (
              <button
                onClick={installAllRequiredForUser}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center gap-2 transition-colors shadow"
              >
                <DownloadSimple className="w-4 h-4" />
                <span>Deploy {missingRequiredAssets.length} Required Package(s)</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('liveries')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs flex items-center gap-2 transition-colors shadow"
            >
              <PaintBrush className="w-4 h-4" />
              <span>Airframe Liveries</span>
            </button>
            <button
              onClick={() => setActiveTab('mods')}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-display font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>Mods</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-display font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Folder className="w-4 h-4 text-amber-400" />
              <span>Installed Library ({installedCount})</span>
            </button>
          </div>

          {outdatedAssets.length > 0 && (
            <button
              onClick={updateAllOutdated}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs flex items-center gap-1.5"
            >
              <ArrowCircleUp className="w-4 h-4" />
              <span>Update {outdatedAssets.length} Outdated Package(s)</span>
            </button>
          )}
        </div>
      </div>

      {/* DOSSIER SUB-PAGES SHOWCASE STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Airframes Card */}
        <div
          onClick={() => setActiveTab('airframes')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg hover:shadow-amber-500/5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <AirplaneTilt className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors truncate">
                  Qualified Airframes
                </h3>
                <p className="text-[11px] font-mono text-stone-400 truncate">
                  {primaryAirframe?.name || 'Airframe Ratings'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800 text-amber-300 font-mono text-xs font-bold shrink-0">
              {airframes.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-2.5 border-t border-stone-800/80">
            <span>{airframes.filter((a) => a.isInstructor).length > 0 ? 'Instructor Rated' : 'Standard Pilot'}</span>
            <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
              Open Hangar <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Certifications Card */}
        <div
          onClick={() => setActiveTab('qualifications')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg hover:shadow-amber-500/5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Certificate className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors truncate">
                  Certifications
                </h3>
                <p className="text-[11px] font-mono text-stone-400 truncate">
                  Earned Flight Credentials
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800 text-amber-300 font-mono text-xs font-bold shrink-0">
              {certificates.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-2.5 border-t border-stone-800/80">
            <span>+{totalCertXp.toLocaleString()} XP Earned</span>
            <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
              View Certificates <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Awards Card */}
        <div
          onClick={() => setActiveTab('awards')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 cursor-pointer transition-all flex flex-col justify-between space-y-3 group shadow-lg hover:shadow-amber-500/5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Medal className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors truncate">
                  Awards &amp; Ribbons
                </h3>
                <p className="text-[11px] font-mono text-stone-400 truncate">
                  Campaigns &amp; Medals
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-stone-950 border border-stone-800 text-amber-300 font-mono text-xs font-bold shrink-0">
              {awards.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-stone-400 pt-2.5 border-t border-stone-800/80">
            <span>+{totalAwardXp.toLocaleString()} XP Bonus</span>
            <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
              Ribbon Rack <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
