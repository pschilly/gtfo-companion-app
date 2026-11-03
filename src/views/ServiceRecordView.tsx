import React, { useEffect, useMemo, useState } from 'react';
import {
  AirplaneTakeoff,
  ArrowSquareOut,
  ArrowsClockwise,
  CalendarCheck,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
  Certificate,
  ChartLineUp,
  CheckCircle,
  Crosshair,
  IdentificationBadge,
  MagnifyingGlass,
  NotePencil,
  Scroll,
  Shield,
  TrendDown,
  TrendUp,
  UserCheck,
  UsersFour,
  XCircle,
} from '@phosphor-icons/react';
import { DossierNav } from '../components/DossierNav';
import { useApp } from '../context/AppContext';
import { ServiceRecordEntry } from '../types';

type FilterGroup = 'all' | 'sorties' | 'progression' | 'certifications' | 'squadron' | 'admin';

function getRecordVisuals(entry: ServiceRecordEntry): {
  icon: React.ReactNode;
  badgeClass: string;
  iconBoxClass: string;
  group: FilterGroup;
} {
  const type = (entry.type || 'note').toLowerCase();

  switch (type) {
    case 'enlistment':
      return {
        icon: <UserCheck weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        iconBoxClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        group: 'squadron',
      };
    case 'squadron':
      return {
        icon: <UsersFour weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        iconBoxClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        group: 'squadron',
      };
    case 'grade':
      return {
        icon: <Shield weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        iconBoxClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        group: 'progression',
      };
    case 'certificate':
      return {
        icon: <Certificate weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        iconBoxClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        group: 'certifications',
      };
    case 'xp_award':
      return {
        icon: <TrendUp weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        iconBoxClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        group: 'progression',
      };
    case 'xp_penalty':
      return {
        icon: <TrendDown weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        iconBoxClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        group: 'progression',
      };
    case 'callsign_change':
      return {
        icon: <IdentificationBadge weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        iconBoxClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        group: 'admin',
      };
    case 'operation-sortie':
      return {
        icon: <AirplaneTakeoff weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        iconBoxClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        group: 'sorties',
      };
    case 'opfor-sortie':
      return {
        icon: <Crosshair weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        iconBoxClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        group: 'sorties',
      };
    case 'note':
    default:
      return {
        icon: <NotePencil weight="duotone" className="w-4 h-4" />,
        badgeClass: 'bg-stone-800 text-stone-300 border-stone-700',
        iconBoxClass: 'bg-stone-800/90 text-stone-400 border-stone-700',
        group: 'admin',
      };
  }
}

function formatPortalDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

export const ServiceRecordView: React.FC = () => {
  const { memberProfile, syncMemberPortal } = useApp();
  const [selectedGroup, setSelectedGroup] = useState<FilterGroup>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const records = memberProfile.serviceRecords || [];
  const stats = memberProfile.serviceRecordStats || {
    totalRsvps: 0,
    attended: 0,
    absent: 0,
    pending: 0,
    rate: null,
    rateFormatted: 'N/A',
    totalEntries: records.length,
  };

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      await syncMemberPortal();
    } finally {
      setIsSyncing(false);
    }
  };

  const groupCounts = useMemo(() => {
    const counts: Record<FilterGroup, number> = {
      all: records.length,
      sorties: 0,
      progression: 0,
      certifications: 0,
      squadron: 0,
      admin: 0,
    };
    records.forEach((r) => {
      const { group } = getRecordVisuals(r);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (selectedGroup !== 'all') {
        const { group } = getRecordVisuals(r);
        if (group !== selectedGroup) return false;
      }
      if (q) {
        const hay = `${r.typeLabel} ${r.type} ${r.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, selectedGroup, searchQuery]);

  // Reset to page 1 when filter, search, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGroup, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRecords.length);

  const paginatedRecords = useMemo(
    () => filteredRecords.slice(startIndex, endIndex),
    [filteredRecords, startIndex, endIndex]
  );

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  const filterTabs: { id: FilterGroup; label: string; count: number }[] = [
    { id: 'all', label: 'All Entries', count: groupCounts.all },
    { id: 'sorties', label: 'Combat & OPFOR Sorties', count: groupCounts.sorties },
    { id: 'progression', label: 'Rank & XP', count: groupCounts.progression },
    { id: 'certifications', label: 'Certifications', count: groupCounts.certifications },
    { id: 'squadron', label: 'Squadron & Enlistment', count: groupCounts.squadron },
    { id: 'admin', label: 'Administrative', count: groupCounts.admin },
  ];

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Sub Navigation */}
      <DossierNav />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              My Service Record
            </h1>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
              {records.length} {records.length === 1 ? 'ENTRY' : 'ENTRIES'}
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Chronological personnel file, sortie attendance ledger, rank promotions, and experience logs for{' '}
            <strong className="text-stone-200">{memberProfile.callsign}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Sync latest service record entries from Member Portal"
          >
            <ArrowsClockwise className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sync</span>
          </button>

          <a
            href="https://members.globaltaskforceoverlord.org/personnel-record/service-record"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>Portal Service Record</span>
            <ArrowSquareOut className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Sortie Attendance Stats Overview (matches ServiceRecordAttendanceStatsWidget) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-lg flex items-start justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              Sorties Attended
            </div>
            <div className="text-2xl font-display font-bold text-stone-100 mt-1">
              {stats.attended}
            </div>
            <div className="text-xs font-mono text-emerald-400 mt-1">
              {stats.attended} Show-ups
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle weight="duotone" className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-lg flex items-start justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              No-Shows / Absent
            </div>
            <div className="text-2xl font-display font-bold text-stone-100 mt-1">
              {stats.absent}
            </div>
            <div className="text-xs font-mono text-rose-400 mt-1">
              {stats.absent} Missed Sorties
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <XCircle weight="duotone" className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-lg flex items-start justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              Total Sortie RSVPs
            </div>
            <div className="text-2xl font-display font-bold text-stone-100 mt-1">
              {stats.totalRsvps}
            </div>
            <div className="text-xs font-mono text-sky-400 mt-1">
              {stats.totalRsvps} Total Registered
              {stats.pending > 0 ? ` (${stats.pending} Pending AAR)` : ''}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <CalendarCheck weight="duotone" className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-lg flex items-start justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
              Attendance Rate
            </div>
            <div className="text-2xl font-display font-bold text-amber-300 mt-1">
              {stats.rateFormatted}
            </div>
            <div className="text-xs font-mono text-stone-400 mt-1">
              {stats.attended}/{stats.totalRsvps} Flown
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ChartLineUp weight="duotone" className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900/90 border border-stone-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterTabs.map((tab) => {
            const active = selectedGroup === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedGroup(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs flex items-center gap-1.5 transition-all ${
                  active
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                    : 'bg-stone-950/60 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    active ? 'bg-stone-950 text-amber-300' : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <MagnifyingGlass className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service record entries..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500/60 focus:outline-none text-xs font-mono text-stone-200 placeholder:text-stone-500"
          />
        </div>
      </div>

      {/* Service Record Ledger */}
      <div className="rounded-2xl bg-stone-900/90 border border-stone-800 shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-800/80 flex flex-wrap items-center justify-between gap-3 bg-stone-950/50">
          <div className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-wider text-amber-400">
            <Scroll className="w-4 h-4" />
            <span>Official Personnel Service Ledger</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-stone-400">
              {filteredRecords.length === 0
                ? '0 entries'
                : `Showing ${startIndex + 1}–${endIndex} of ${filteredRecords.length} entries`}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Previous page"
                >
                  <CaretLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] text-stone-300">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Next page"
                >
                  <CaretRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 border border-stone-700/80 flex items-center justify-center text-amber-400 mx-auto mb-3">
              <Scroll weight="duotone" className="w-6 h-6" />
            </div>
            {records.length === 0 ? (
              <>
                <div className="text-sm font-display font-semibold text-stone-200">
                  You do not have any service record entries...
                </div>
                <div className="text-xs italic text-stone-400">
                  Either you are really good... Or really bad — who&apos;s to say?
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-display font-semibold text-stone-200">
                  No matching service record entries
                </div>
                <div className="text-xs text-stone-400">
                  Try clearing your search filter or selecting a different category above.
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-stone-800/70">
              {paginatedRecords.map((item) => {
                const visuals = getRecordVisuals(item);
                const formattedDate = formatPortalDate(item.createdAt);
                const relTime = formatRelativeTime(item.createdAt);

                return (
                  <div
                    key={item.id}
                    className="px-5 py-3.5 hover:bg-stone-800/35 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${visuals.iconBoxClass}`}
                        title={item.typeLabel}
                      >
                        {visuals.icon}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold uppercase tracking-wider ${visuals.badgeClass}`}
                          >
                            {item.typeLabel}
                          </span>
                          {relTime && (
                            <span className="text-[11px] font-mono text-stone-500">
                              {relTime}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-stone-200 leading-relaxed break-words">
                          {item.details}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pl-12 sm:pl-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                        Recorded
                      </span>
                      <span className="text-xs font-mono font-semibold text-stone-300">
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3.5 border-t border-stone-800/80 bg-stone-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 font-mono text-xs focus:outline-none focus:border-amber-500/60"
                >
                  {[10, 15, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="hidden md:inline text-stone-500 pl-2">
                  Showing {startIndex + 1}–{endIndex} of {filteredRecords.length}
                </span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage <= 1}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="First page"
                  >
                    <CaretDoubleLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="Previous page"
                  >
                    <CaretLeft className="w-3.5 h-3.5" />
                  </button>

                  {pageNumbers.map((page, idx) =>
                    page === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 font-mono text-xs text-stone-500"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-7 h-7 px-2 rounded-lg font-mono text-xs font-semibold transition-all ${
                          page === safeCurrentPage
                            ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                            : 'bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="Next page"
                  >
                    <CaretRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="Last page"
                  >
                    <CaretDoubleRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

