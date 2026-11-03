import React, { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Briefcase,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
  Certificate,
  Crown,
  Funnel,
  Gear,
  MagnifyingGlass,
  Medal,
  ShieldCheck,
  ShieldStar,
  Sparkle,
  Star,
  User,
  UserCheck,
  UsersFour,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { TaskForceMember, TaskForceRibbon } from '../types';
import { formatShortDate, stripHtml } from '../utils/formatters';

/**
 * Splits ribbons into military-standard rows:
 * - Max 3 ribbons per row.
 * - If total is not a multiple of 3, the TOP row holds the remainder (centered).
 * - Matching the GTFO web portal generator User::renderRibbonRackPng().
 */
function getMilitaryRibbonRows<T>(items: T[], maxColumns = 3): T[][] {
  if (!items || items.length === 0) return [];
  const entryCount = items.length;
  const rowsLayout: number[] = [];

  if (entryCount <= maxColumns) {
    rowsLayout.push(entryCount);
  } else {
    const remainder = entryCount % maxColumns;
    if (remainder > 0) {
      rowsLayout.push(remainder);
    }
    let remaining = entryCount - (remainder > 0 ? remainder : 0);
    while (remaining > 0) {
      rowsLayout.push(maxColumns);
      remaining -= maxColumns;
    }
  }

  const result: T[][] = [];
  let currentIndex = 0;
  for (const count of rowsLayout) {
    result.push(items.slice(currentIndex, currentIndex + count));
    currentIndex += count;
  }
  return result;
}

interface RibbonRackProps {
  ribbons: TaskForceRibbon[];
  rackUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const RibbonRack: React.FC<RibbonRackProps> = ({ ribbons, rackUrl, size = 'sm' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const rows = useMemo(() => getMilitaryRibbonRows(ribbons, 3), [ribbons]);

  if (!ribbons || ribbons.length === 0) return null;

  // If a pre-rendered rack PNG from User::renderRibbonRackPng() is available and hasn't errored
  if (rackUrl && !imageFailed) {
    const heightStyle =
      size === 'lg' ? 'h-14 sm:h-16' : size === 'md' ? 'h-10 sm:h-12' : 'h-8 sm:h-9';
    return (
      <div className="flex justify-center items-center py-0.5">
        <img
          src={rackUrl}
          alt="Military Ribbon Rack"
          className={`${heightStyle} max-w-full object-contain filter drop-shadow`}
          onError={() => setImageFailed(true)}
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback: stacked dynamic CSS ribbon tiles matching military order of precedence
  // Aspect ratio is 220:56 (~3.93:1) with seamless 0px gap between tiles
  const tileDims =
    size === 'lg'
      ? 'w-24 h-6 text-xs'
      : size === 'md'
      ? 'w-18 h-4.5 text-[10px]'
      : 'w-14 h-3.5 text-[9px]';

  return (
    <div className="flex flex-col items-center justify-center gap-0 py-0.5">
      {rows.map((row, rIdx) => (
        <div key={rIdx} className="flex justify-center items-center gap-0">
          {row.map((ribbon, cIdx) => (
            <div
              key={ribbon.id || `${rIdx}-${cIdx}`}
              title={`${ribbon.name}${ribbon.description ? `: ${stripHtml(ribbon.description)}` : ''}${
                ribbon.issueCount && ribbon.issueCount > 1 ? ` (${ribbon.issueCount}x)` : ''
              }`}
              className={`relative ${tileDims} overflow-hidden border border-stone-800/80 shadow-sm shrink-0 bg-stone-900 group/ribbon cursor-help`}
            >
              <img
                src={ribbon.ribbonUrl}
                alt={ribbon.name}
                className="w-full h-full object-fill"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              {ribbon.issueCount && ribbon.issueCount > 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {ribbon.numeralUrl ? (
                    <img
                      src={ribbon.numeralUrl}
                      alt={`${ribbon.issueCount}x`}
                      className="h-3 max-w-full object-contain filter drop-shadow"
                    />
                  ) : (
                    <span className="font-mono font-black text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                      {ribbon.issueCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const TaskForceRosterView: React.FC = () => {
  const {
    taskForceRoster,
    rosterCounts,
    isLoadingTaskforce,
    refreshTaskforceData,
    settings,
    setActiveTab,
    memberProfile,
    rosterSquadronFilter,
    setRosterSquadronFilter,
  } = useApp();

  // Local filter initialized from user settings (default false = CORE only)
  const [showAllMembers, setShowAllMembers] = useState<boolean>(
    settings.rosterShowAllMembers ?? false
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSquadron, setSelectedSquadron] = useState<string>('all');
  const [selectedAdminPosition, setSelectedAdminPosition] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<TaskForceMember | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);

  // Close inspector on Escape key
  React.useEffect(() => {
    if (!selectedMember) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMember(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember]);

  // Derive unique squadrons for filter dropdown
  const availableSquadrons = useMemo(() => {
    const set = new Set<string>();
    taskForceRoster.forEach((m) => {
      if (m.squadron) set.add(m.squadron);
    });
    return Array.from(set).sort();
  }, [taskForceRoster]);

  // Synchronize squadron filter if navigated with a specific squadron selected
  React.useEffect(() => {
    if (rosterSquadronFilter) {
      const match = availableSquadrons.find(
        (sq) =>
          sq.toLowerCase() === rosterSquadronFilter.toLowerCase() ||
          sq.toLowerCase().includes(rosterSquadronFilter.toLowerCase()) ||
          rosterSquadronFilter.toLowerCase().includes(sq.toLowerCase())
      );
      if (match) {
        setSelectedSquadron(match);
      } else {
        setSelectedSquadron(rosterSquadronFilter);
      }
      setCurrentPage(1);
    }
  }, [rosterSquadronFilter, availableSquadrons]);

  // Keep local toggle in sync if setting changes externally
  React.useEffect(() => {
    setShowAllMembers(settings.rosterShowAllMembers ?? false);
  }, [settings.rosterShowAllMembers]);

  // Reset page to 1 whenever filters or search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [showAllMembers, selectedSquadron, selectedAdminPosition, searchQuery]);

  const handleToggleTierFilter = (all: boolean) => {
    setShowAllMembers(all);
  };

  // Derive unique admin & specialist positions for filter dropdown
  const availableAdminPositions = useMemo(() => {
    const set = new Set<string>();
    taskForceRoster.forEach((m) => {
      if (Array.isArray(m.adminPositions)) {
        m.adminPositions.forEach((pos) => {
          if (pos && typeof pos === 'string' && pos.trim()) {
            set.add(pos.trim());
          }
        });
      }
    });
    return Array.from(set).sort();
  }, [taskForceRoster]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return taskForceRoster.filter((m) => {
      // 1. Tier filter: CORE only by default, or all if enabled
      if (!showAllMembers && !m.isCore) {
        return false;
      }
      // 2. Squadron filter
      if (selectedSquadron !== 'all' && m.squadron !== selectedSquadron) {
        return false;
      }
      // 3. Admin position filter
      if (selectedAdminPosition !== 'all') {
        const hasPos =
          Array.isArray(m.adminPositions) &&
          m.adminPositions.some(
            (p) => p.toLowerCase() === selectedAdminPosition.toLowerCase()
          );
        if (!hasPos) return false;
      }
      // 4. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchesAdmin =
        Array.isArray(m.adminPositions) &&
        m.adminPositions.some((pos) => pos.toLowerCase().includes(q));

      return (
        m.name.toLowerCase().includes(q) ||
        m.callsign.toLowerCase().includes(q) ||
        (m.grade && m.grade.toLowerCase().includes(q)) ||
        (m.gradeName && m.gradeName.toLowerCase().includes(q)) ||
        (m.squadron && m.squadron.toLowerCase().includes(q)) ||
        (m.position && m.position.toLowerCase().includes(q)) ||
        matchesAdmin
      );
    });
  }, [taskForceRoster, showAllMembers, selectedSquadron, selectedAdminPosition, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedMembers = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, safePage, pageSize]);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const coreCount = rosterCounts.coreCount || taskForceRoster.filter((m) => m.isCore).length;
  const totalCount = rosterCounts.total || taskForceRoster.length;
  const communityCount =
    rosterCounts.communityCount || Math.max(0, totalCount - coreCount);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold tracking-wider">
              S1 // PERSONNEL
            </span>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Task Force Roster
            </h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Official Global Task Force Overlord roster.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('settings')}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            title="Configure Roster Defaults in Settings"
          >
            <Gear className="w-3.5 h-3.5 text-stone-400" />
            <span>Roster Settings</span>
          </button>

          <button
            onClick={() => refreshTaskforceData()}
            disabled={isLoadingTaskforce}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-2 transition-colors shrink-0 shadow-sm disabled:opacity-50"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 text-amber-400 ${isLoadingTaskforce ? 'animate-spin' : ''}`} />
            <span>{isLoadingTaskforce ? 'Refreshing...' : 'Refresh Roster'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip: 3 Cards (CORE, Community, Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">CORE Roster</p>
            <p className="text-2xl font-bold font-display text-amber-400 mt-0.5">
              {coreCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Primary operational flight personnel
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 text-amber-400" weight="fill" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Community Roster</p>
            <p className="text-2xl font-bold font-display text-sky-400 mt-0.5">
              {communityCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Community flight members
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
            <UsersFour className="w-5 h-5 text-sky-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-md">
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Total Task Force</p>
            <p className="text-2xl font-bold font-display text-stone-100 mt-0.5">
              {totalCount}
            </p>
            <p className="text-[11px] font-mono text-stone-500 mt-0.5">
              Combined active organization roster
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-stone-300" />
          </div>
        </div>
      </div>

      {/* Control Bar: View Mode Switcher, Squadron Filter, Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900/80 border border-stone-800">
        {/* Tier Filter Toggle */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-mono self-start lg:self-auto">
          <button
            onClick={() => handleToggleTierFilter(false)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              !showAllMembers
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Star className="w-3.5 h-3.5" weight={!showAllMembers ? 'fill' : 'regular'} />
            <span>CORE</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                !showAllMembers ? 'bg-stone-950/20 text-stone-950 font-bold' : 'bg-stone-800 text-stone-400'
              }`}
            >
              {coreCount}
            </span>
          </button>

          <button
            onClick={() => handleToggleTierFilter(true)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              showAllMembers
                ? 'bg-amber-500 text-stone-950 font-bold shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UsersFour className="w-3.5 h-3.5" />
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                showAllMembers ? 'bg-stone-950/20 text-stone-950 font-bold' : 'bg-stone-800 text-stone-400'
              }`}
            >
              {totalCount}
            </span>
          </button>
        </div>

        {/* Squadron, Appointment Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-wrap">
          {availableSquadrons.length > 0 && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Funnel className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <select
                value={selectedSquadron}
                onChange={(e) => {
                  setSelectedSquadron(e.target.value);
                  setRosterSquadronFilter(e.target.value === 'all' ? null : e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full sm:w-auto"
              >
                <option value="all">All Squadrons</option>
                {availableSquadrons.map((sq) => (
                  <option key={sq} value={sq}>
                    {sq}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableAdminPositions.length > 0 && (
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Briefcase className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <select
                value={selectedAdminPosition}
                onChange={(e) => setSelectedAdminPosition(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/60 w-full sm:w-auto"
              >
                <option value="all">All Appointments</option>
                {availableAdminPositions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <MagnifyingGlass className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search callsign, squadron, appointment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Roster Cards Grid */}
      {filteredMembers.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-3">
          <UserCheck className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="font-display font-semibold text-stone-300">No Members Match Selected Filter</h3>
          <p className="text-xs text-stone-500">
            {!showAllMembers
              ? 'Try clicking "All Members" above to include community pilots.'
              : 'Try clearing your search query or squadron filter.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMembers.map((member) => {
              const isCurrentAviator =
                Boolean(memberProfile.callsign) &&
                member.callsign.toLowerCase() === memberProfile.callsign.toLowerCase();

              const isCouncil =
                Boolean(member.isCouncil || member.isCouncilMember) ||
                Number(member.id) === 1 ||
                (Array.isArray(member.adminPositions) &&
                  member.adminPositions.some((pos) => {
                    const p = pos.toLowerCase();
                    return p.includes('director') || p.includes('council');
                  }));

              const isLeadership =
                Boolean(member.isLeadership || member.isSquadronLeader) ||
                (member.position &&
                  (member.position.toLowerCase().includes('commanding officer') ||
                    member.position.toLowerCase().includes('(co)') ||
                    member.position.toLowerCase().includes('(xo)') ||
                    member.position.toLowerCase().includes('executive officer') ||
                    member.position.toLowerCase().includes('flight lead'))) ||
                (Array.isArray(member.adminPositions) &&
                  member.adminPositions.some((pos) => {
                    const p = pos.toLowerCase();
                    return p.includes('leadership') || p.includes('command');
                  }));

              const isSpecialist =
                Boolean(member.isSpecialist) ||
                (Array.isArray(member.adminPositions) &&
                  member.adminPositions.some((pos) => pos.toLowerCase().includes('specialist')));

              let glowStyle = 'border-stone-800 hover:border-stone-700';
              if (isCouncil) {
                // Gold glow for Council Members
                glowStyle =
                  'border-amber-400/90 shadow-[0_0_18px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/50 hover:shadow-[0_0_26px_rgba(251,191,36,0.55)]';
              } else if (isLeadership) {
                // Green glow for Squadron Leadership
                glowStyle =
                  'border-emerald-500/90 shadow-[0_0_18px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/50 hover:shadow-[0_0_26px_rgba(16,185,129,0.55)]';
              } else if (isSpecialist) {
                // Orange glow for Specialists
                glowStyle =
                  'border-orange-500/90 shadow-[0_0_18px_rgba(249,115,22,0.35)] ring-1 ring-orange-500/50 hover:shadow-[0_0_26px_rgba(249,115,22,0.55)]';
              }

              return (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`p-4 rounded-2xl bg-stone-900/90 border transition-all flex flex-col justify-between gap-4 cursor-pointer group hover:scale-[1.01] ${glowStyle}`}
                >
                  {/* Header: Grade Insignia & Callsign */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                        {member.insigniaUrl ? (
                          <img
                            src={member.insigniaUrl}
                            alt={member.gradeName}
                            className="max-h-full max-w-full object-contain filter drop-shadow"
                            loading="lazy"
                          />
                        ) : member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.callsign}
                            className="w-full h-full object-cover rounded-lg"
                            loading="lazy"
                          />
                        ) : (
                          <User className="w-6 h-6 text-stone-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {member.grade}
                          </span>
                          <h3 className="font-display font-bold text-stone-100 text-base truncate group-hover:text-amber-200 transition-colors">
                            {member.callsign}
                          </h3>
                        </div>
                        <p className="text-[11px] font-mono text-stone-400 truncate">
                          {member.gradeName}
                        </p>
                      </div>
                    </div>

                    {/* Tier Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 border flex items-center gap-1 ${
                        member.isCore
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-stone-800 border-stone-700 text-stone-300'
                      }`}
                    >
                      {member.isCore && <Star className="w-3 h-3 text-amber-400" weight="fill" />}
                      <span>{member.tier}</span>
                    </span>
                  </div>

                  {/* Squadron & Position Details */}
                  <div className="pt-2 border-t border-stone-800/80 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        {member.squadronEmblemUrl ? (
                          <img
                            src={member.squadronEmblemUrl}
                            alt={member.squadron || 'Squadron'}
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.src !== 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png') {
                                target.src = 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png';
                              }
                            }}
                            className="w-5 h-5 object-contain shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-stone-500 shrink-0" />
                        )}
                        <span className="text-stone-300 truncate">
                          {member.squadron || '42nd Holding Squadron'}
                        </span>
                      </div>

                      {member.flightIdentifier && (
                        <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-[10px] text-amber-300 font-bold shrink-0">
                          {member.flightIdentifier}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                      <span className="truncate">{member.position || 'Aviator'}</span>
                    </div>

                    {/* Admin & Specialist Appointments */}
                    {member.adminPositions && member.adminPositions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-stone-800/60">
                        {member.adminPositions.map((pos, pIdx) => {
                          const lower = pos.toLowerCase();
                          const isDirector = lower.includes('director');
                          const isSpecialist = lower.includes('specialist');
                          const isLead = lower.includes('leadership') || lower.includes('command');

                          return (
                            <span
                              key={pIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAdminPosition(pos);
                                setCurrentPage(1);
                              }}
                              title={`Filter roster by "${pos}"`}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight border flex items-center gap-1 transition-all cursor-pointer hover:brightness-125 ${
                                isDirector
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                  : isSpecialist
                                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                                  : isLead
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-stone-950 border-stone-800 text-stone-300'
                              }`}
                            >
                              {isDirector && <Crown className="w-3 h-3 text-amber-400 shrink-0" weight="fill" />}
                              {isSpecialist && <Sparkle className="w-3 h-3 text-orange-400 shrink-0" />}
                              {isLead && <ShieldStar className="w-3 h-3 text-emerald-400 shrink-0" />}
                              <span className="truncate">{pos}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Ribbon Rack (if applicable) */}
                    {member.ribbons && member.ribbons.length > 0 && (
                      <div className="pt-2 border-t border-stone-800/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-stone-400 font-bold tracking-wider flex items-center gap-1">
                            <Medal className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ribbon Rack</span>
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-stone-950 border border-stone-800 text-[10px] font-mono text-amber-300 font-bold">
                            {member.ribbons.length} {member.ribbons.length === 1 ? 'Award' : 'Awards'}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-stone-950/90 border border-stone-800/90 shadow-inner flex items-center justify-center overflow-hidden">
                          <RibbonRack
                            ribbons={member.ribbons}
                            rackUrl={member.ribbonRackUrl}
                            size="sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Badges footer */}
                  <div className="pt-2 border-t border-stone-800/60 flex items-center justify-between text-[11px] font-mono text-stone-500">
                    <div className="flex items-center gap-3">
                      {member.certificatesCount !== undefined && member.certificatesCount > 0 && (
                        <span className="flex items-center gap-1 text-stone-400">
                          <Certificate className="w-3 h-3 text-amber-400" />
                          <span>{member.certificatesCount}</span>
                        </span>
                      )}
                      {member.awardsCount !== undefined && member.awardsCount > 0 && (
                        <span className="flex items-center gap-1 text-stone-400">
                          <Medal className="w-3 h-3 text-sky-400" />
                          <span>{member.awardsCount}</span>
                        </span>
                      )}
                    </div>

                    {member.enlistedAt && (
                      <span className="text-[10px] text-stone-500">
                        Enlisted {formatShortDate(member.enlistedAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-md">
            <div className="text-xs font-mono text-stone-400">
              Showing <strong className="text-stone-200">{(safePage - 1) * pageSize + 1}</strong>–
              <strong className="text-stone-200">
                {Math.min(safePage * pageSize, filteredMembers.length)}
              </strong>{' '}
              of <strong className="text-amber-400">{filteredMembers.length}</strong> roster members
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 mr-2 text-xs font-mono text-stone-400">
                <span>Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/60"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </div>

              {/* Prev / First Buttons */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="First Page"
              >
                <CaretDoubleLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous Page"
              >
                <CaretLeft className="w-4 h-4" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-stone-600 font-mono text-xs">
                        ...
                      </span>
                    );
                  }
                  const num = p as number;
                  const isActive = num === safePage;
                  return (
                    <button
                      key={num}
                      onClick={() => setCurrentPage(num)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono transition-colors ${
                        isActive
                          ? 'bg-amber-500 text-stone-950 font-bold shadow'
                          : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Next / Last Buttons */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next Page"
              >
                <CaretRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Last Page"
              >
                <CaretDoubleRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div
          onClick={() => setSelectedMember(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-lg w-full overflow-hidden flex flex-col shadow-2xl cursor-default"
          >
            <div className="p-6 pb-4 border-b border-stone-800 flex items-start justify-between gap-4 bg-stone-950/60">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-center p-2 shrink-0">
                  {selectedMember.insigniaUrl ? (
                    <img
                      src={selectedMember.insigniaUrl}
                      alt={selectedMember.gradeName}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <User className="w-8 h-8 text-stone-500" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-amber-400 font-mono text-xs font-bold">
                      {selectedMember.grade}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        selectedMember.isCore
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {selectedMember.tier}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-xl text-stone-100 mt-1">
                    {selectedMember.callsign}
                  </h2>
                  <p className="text-xs font-mono text-stone-400">
                    {selectedMember.gradeName} • {selectedMember.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedMember(null)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-stone-950 border border-stone-800">
                <div>
                  <span className="text-stone-500 text-[10px] uppercase">Assigned Squadron</span>
                  <p className="text-stone-200 font-bold mt-0.5">
                    {selectedMember.squadron || '42nd Holding Squadron'}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] uppercase">Operational Position</span>
                  <p className="text-stone-200 font-bold mt-0.5">
                    {selectedMember.position || 'Aviator'}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] uppercase">Total Earned XP</span>
                  <p className="text-amber-400 font-bold mt-0.5">
                    {selectedMember.xp.toLocaleString()} XP
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 text-[10px] uppercase">Flight Identifier</span>
                  <p className="text-stone-200 font-bold mt-0.5">
                    {selectedMember.flightIdentifier || 'None'}
                  </p>
                </div>
              </div>

              {/* Administrative & Specialist Appointments */}
              {selectedMember.adminPositions && selectedMember.adminPositions.length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                    <span>Administrative &amp; Specialist Appointments</span>
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedMember.adminPositions.map((pos, idx) => {
                      const lower = pos.toLowerCase();
                      const isDirector = lower.includes('director');
                      const isSpecialist = lower.includes('specialist');
                      const isLead = lower.includes('leadership') || lower.includes('command');

                      return (
                        <div
                          key={idx}
                          className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-mono font-bold ${
                            isDirector
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : isSpecialist
                              ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                              : isLead
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-stone-900 border-stone-800 text-stone-200'
                          }`}
                        >
                          {isDirector && <Crown className="w-4 h-4 text-amber-400 shrink-0" weight="fill" />}
                          {isSpecialist && <Sparkle className="w-4 h-4 text-orange-400 shrink-0" />}
                          {isLead && <ShieldStar className="w-4 h-4 text-emerald-400 shrink-0" />}
                          <span>{pos}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Official Ribbon Rack & Decorations (if applicable) */}
              {selectedMember.ribbons && selectedMember.ribbons.length > 0 && (
                <div className="space-y-3 p-3.5 rounded-xl bg-stone-950 border border-stone-800">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Medal className="w-3.5 h-3.5 text-amber-400" />
                      <span>Official Military Ribbon Rack</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] text-amber-300 font-mono font-bold">
                      {selectedMember.ribbons.length} {selectedMember.ribbons.length === 1 ? 'Decoration' : 'Decorations'}
                    </span>
                  </div>

                  {/* Standard Military Ribbon Rack Display (3 per row, top row centered remainder) */}
                  <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800/80 flex flex-col items-center justify-center shadow-inner">
                    <RibbonRack
                      ribbons={selectedMember.ribbons}
                      rackUrl={selectedMember.ribbonRackUrl}
                      size="lg"
                    />
                  </div>

                  {/* Detailed Citation Breakdown */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedMember.ribbons.map((ribbon, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-2 rounded-lg bg-stone-900/40 border border-stone-800/60 flex items-center justify-between gap-3 text-[11px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-3 rounded-[2px] overflow-hidden border border-stone-700/60 shrink-0">
                            <img src={ribbon.ribbonUrl} alt="" className="w-full h-full object-fill" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-200 truncate">{ribbon.name}</p>
                            {ribbon.description && (
                              <p className="text-[10px] text-stone-400 truncate">{stripHtml(ribbon.description)}</p>
                            )}
                          </div>
                        </div>
                        {ribbon.issueCount && ribbon.issueCount > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300 font-bold shrink-0">
                            {ribbon.issueCount}x Awarded
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMember.enlistedAt && (
                <div className="flex items-center justify-between text-stone-400 px-1">
                  <span>Task Force Enlistment:</span>
                  <span className="text-stone-200">{formatShortDate(selectedMember.enlistedAt)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-stone-400 px-1">
                <span>Earned Certifications:</span>
                <span className="text-amber-300 font-bold">
                  {selectedMember.certificatesCount || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-stone-400 px-1">
                <span>Decorations &amp; Awards:</span>
                <span className="text-sky-300 font-bold">
                  {selectedMember.awardsCount || 0}
                </span>
              </div>
            </div>

            <div className="p-4 bg-stone-950/80 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs shadow transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
