import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  ArrowSquareOut,
  Binoculars,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  MagnifyingGlass,
  Note,
  Scroll,
  SpeakerHigh,
  Target,
  VideoCamera,
  X,
} from '@phosphor-icons/react';
import {
  CampaignIntelReportItem,
  CampaignItem,
  CampaignMissionItem,
  CampaignMissionSortieBrief,
} from '../../types';
import { MissionModalSection } from './CampaignMissionModal';
import { formatDateTimeShort, getMissionStatusBadgeClasses } from './utils';

interface CampaignIntelTabProps {
  campaign: CampaignItem;
  onOpenExternal: (url?: string | null, fallbackPath?: string) => void;
  onInspectMission?: (
    mission: CampaignMissionItem,
    section?: MissionModalSection
  ) => void;
  onOpenOnMap?: (missionId: number) => void;
}

type IntelRecencyWindow = 'current' | '14d' | 'all';

type UnifiedCampaignIntelEntry =
  | {
      kind: 's2_intel';
      uid: string;
      type: string;
      title: string;
      missionId: number | null;
      missionName: string | null;
      missionStatus: string | null;
      mission: CampaignMissionItem | null;
      sortieName: string | null;
      createdAt: string | null;
      ageDays: number;
      isActiveMission: boolean;
      isCurrentRelevant: boolean;
      isRecent14d: boolean;
      searchText: string;
      report: CampaignIntelReportItem;
    }
  | {
      kind: 'sortie_aar';
      uid: string;
      type: 'aar';
      title: string;
      missionId: number;
      missionName: string;
      missionStatus: string;
      mission: CampaignMissionItem;
      sortieName: string;
      createdAt: string | null;
      ageDays: number;
      isActiveMission: boolean;
      isCurrentRelevant: boolean;
      isRecent14d: boolean;
      searchText: string;
      sortie: CampaignMissionSortieBrief;
    };

const INTEL_TYPE_LABELS: Record<string, string> = {
  all: 'All Intel & AARs',
  aar: 'Sortie AAR & BDA',
  image: 'Imagery',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  note: 'Observation / Note',
};

const RECENCY_WINDOW_OPTIONS: Array<{
  key: IntelRecencyWindow;
  label: string;
  hint: string;
}> = [
  {
    key: 'current',
    label: 'Current & Relevant',
    hint: 'Active ops or last 30d',
  },
  {
    key: '14d',
    label: 'Last 14 Days',
    hint: 'Recent dispatches & AARs',
  },
  {
    key: 'all',
    label: 'Full Archive',
    hint: 'Include aged historical intel',
  },
];

const TACTICAL_PROSE_CLASSES =
  'text-xs text-stone-300 leading-relaxed space-y-1.5 [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:my-1.5 [&_li]:pl-0.5 [&_li>p]:inline [&_a]:text-amber-300 [&_a]:underline [&_strong]:text-stone-100';

const INITIAL_VISIBLE_IMAGES = 6;

function computeAgeDays(iso?: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return 0;
  const diffMs = Date.now() - ms;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getIntelTypeIcon(type: string) {
  switch (type) {
    case 'aar':
      return <Scroll weight="duotone" className="w-4 h-4 text-amber-400" />;
    case 'image':
      return <ImageIcon weight="duotone" className="w-4 h-4 text-sky-400" />;
    case 'video':
      return <VideoCamera weight="duotone" className="w-4 h-4 text-purple-400" />;
    case 'audio':
      return <SpeakerHigh weight="duotone" className="w-4 h-4 text-amber-400" />;
    case 'document':
      return <FileText weight="duotone" className="w-4 h-4 text-emerald-400" />;
    default:
      return <Note weight="duotone" className="w-4 h-4 text-stone-300" />;
  }
}

function isImageUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return /\.(png|jpg|jpeg|webp|gif|avif|svg)$/.test(path);
}

function isAudioUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(path);
}

function isVideoUrl(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov)$/.test(path);
}

function renderFreshnessBadge(entry: UnifiedCampaignIntelEntry) {
  if (entry.isActiveMission) {
    return (
      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-bold uppercase tracking-wider">
        Active Op
      </span>
    );
  }
  if (!entry.isCurrentRelevant) {
    return (
      <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-700/80 text-stone-400 uppercase tracking-wider">
        Archived{entry.createdAt ? ` • ${entry.ageDays}d ago` : ''}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300 uppercase tracking-wider">
      Recent
      {entry.createdAt
        ? entry.ageDays === 0
          ? ' • Today'
          : ` • ${entry.ageDays}d ago`
        : ''}
    </span>
  );
}

export const CampaignIntelTab: React.FC<CampaignIntelTabProps> = ({
  campaign,
  onOpenExternal,
  onInspectMission,
  onOpenOnMap,
}) => {
  const [recencyWindow, setRecencyWindow] = useState<IntelRecencyWindow>('current');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [missionScope, setMissionScope] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);
  const [expandedImagesByUid, setExpandedImagesByUid] = useState<Record<string, boolean>>({});
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setRecencyWindow('current');
    setTypeFilter('all');
    setMissionScope('all');
    setSearchQuery('');
    setCurrentPage(1);
    setExpandedImagesByUid({});
    setLightboxImageUrl(null);
  }, [campaign.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [recencyWindow, typeFilter, missionScope, searchQuery, pageSize]);

  const toggleImageExpansion = (uid: string) => {
    setExpandedImagesByUid((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const missionsById = useMemo(() => {
    const map = new Map<number, CampaignMissionItem>();
    (campaign.missions || []).forEach((m) => {
      map.set(m.id, m);
    });
    return map;
  }, [campaign.missions]);

  const allUnifiedEntries = useMemo<UnifiedCampaignIntelEntry[]>(() => {
    const entries: UnifiedCampaignIntelEntry[] = [];

    (campaign.intelReports || []).forEach((report) => {
      const linkedMission = report.missionId
        ? missionsById.get(report.missionId) || null
        : null;
      const missionStatus = linkedMission?.status || null;
      const isActiveMission = ['active', 'open'].includes(
        (missionStatus || '').toLowerCase()
      );
      const ageDays = computeAgeDays(report.createdAt);
      const isCampaignWide = report.missionId === null || report.missionId === undefined;
      const isCurrentRelevant =
        isActiveMission || (isCampaignWide && ageDays <= 45) || ageDays <= 30;
      const isRecent14d = ageDays <= 14;

      entries.push({
        kind: 's2_intel',
        uid: `intel-${report.id}`,
        type: report.type,
        title: report.title,
        missionId: report.missionId ?? null,
        missionName: report.missionName || linkedMission?.name || null,
        missionStatus,
        mission: linkedMission,
        sortieName: report.sortieName || null,
        createdAt: report.createdAt || null,
        ageDays,
        isActiveMission,
        isCurrentRelevant,
        isRecent14d,
        searchText: [
          report.title,
          report.notes,
          report.missionName,
          linkedMission?.name,
          report.sortieName,
          report.reporterName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        report,
      });
    });

    (campaign.missions || []).forEach((mission) => {
      const missionStatus = mission.status || 'open';
      const isActiveMission = ['active', 'open'].includes(missionStatus.toLowerCase());

      (mission.sorties || []).forEach((sortie) => {
        if (!sortie.hasAar) {
          return;
        }
        const timestamp = sortie.scheduledAt || mission.startTime || null;
        const ageDays = computeAgeDays(timestamp);
        const isCurrentRelevant = isActiveMission || ageDays <= 30;
        const isRecent14d = ageDays <= 14;
        const displayTitle = `${mission.name} — ${sortie.name} (AAR #${sortie.sortieNumber})`;

        entries.push({
          kind: 'sortie_aar',
          uid: `aar-${sortie.id}`,
          type: 'aar',
          title: displayTitle,
          missionId: mission.id,
          missionName: mission.name,
          missionStatus,
          mission,
          sortieName: sortie.name,
          createdAt: timestamp,
          ageDays,
          isActiveMission,
          isCurrentRelevant,
          isRecent14d,
          searchText: [
            displayTitle,
            mission.name,
            mission.taskingName,
            mission.squadronName,
            mission.planningUserName,
            sortie.name,
            sortie.ourLosses,
            sortie.enemyLosses,
            sortie.aarNotes,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          sortie,
        });
      });
    });

    entries.sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const aValid = Number.isNaN(aTs) ? 0 : aTs;
      const bValid = Number.isNaN(bTs) ? 0 : bTs;
      return bValid - aValid;
    });

    return entries;
  }, [campaign.intelReports, campaign.missions, missionsById]);

  const aarCount = useMemo(
    () => allUnifiedEntries.filter((e) => e.kind === 'sortie_aar').length,
    [allUnifiedEntries]
  );

  const missionOptions = useMemo(() => {
    const map = new Map<number, string>();
    allUnifiedEntries.forEach((entry) => {
      if (entry.missionId && entry.missionName) {
        map.set(entry.missionId, entry.missionName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allUnifiedEntries]);

  const scopeMatchedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUnifiedEntries.filter((entry) => {
      if (typeFilter !== 'all' && entry.type !== typeFilter) {
        return false;
      }
      if (
        missionScope === 'campaign_wide' &&
        entry.missionId !== null &&
        entry.missionId !== undefined
      ) {
        return false;
      }
      if (
        missionScope !== 'all' &&
        missionScope !== 'campaign_wide' &&
        String(entry.missionId) !== missionScope
      ) {
        return false;
      }
      if (!q) return true;
      return entry.searchText.includes(q);
    });
  }, [allUnifiedEntries, missionScope, searchQuery, typeFilter]);

  const filteredEntries = useMemo(() => {
    return scopeMatchedEntries.filter((entry) => {
      if (recencyWindow === 'current') {
        return entry.isCurrentRelevant;
      }
      if (recencyWindow === '14d') {
        return entry.isRecent14d;
      }
      return true;
    });
  }, [recencyWindow, scopeMatchedEntries]);

  const agedOutCount = Math.max(0, scopeMatchedEntries.length - filteredEntries.length);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredEntries.length);

  const paginatedEntries = useMemo(
    () => filteredEntries.slice(startIndex, endIndex),
    [filteredEntries, startIndex, endIndex]
  );

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

  return (
    <div className="space-y-5">
      {/* Header & Filters */}
      <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Binoculars weight="duotone" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-base text-stone-100">
                  Intelligence Reports &amp; After Action Assessments
                </h2>
                {aarCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-medium tabular-nums text-amber-300">
                    {aarCount} Sortie AAR{aarCount === 1 ? '' : 's'} Linked
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Reconnaissance dispatches, imagery, and filed sortie BDA / AAR reports for{' '}
                {campaign.name}
              </p>
            </div>
          </div>
        </div>

        {/* Relevance / Recency Window Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 mr-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Relevance Window:
            </span>
            <div className="flex items-center bg-stone-950 rounded-xl border border-stone-800 p-1 text-xs font-medium flex-wrap">
              {RECENCY_WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  title={opt.hint}
                  onClick={() => setRecencyWindow(opt.key)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    recencyWindow === opt.key
                      ? 'bg-emerald-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {agedOutCount > 0 && recencyWindow !== 'all' ? (
            <button
              type="button"
              onClick={() => setRecencyWindow('all')}
              className="text-xs text-stone-400 hover:text-amber-300 flex items-center gap-1.5 self-start md:self-auto transition-colors"
            >
              <span>
                {agedOutCount} older report{agedOutCount === 1 ? '' : 's'} aged out of current view
              </span>
              <span className="underline text-amber-400">Show Archive</span>
            </button>
          ) : (
            <span className="text-xs tabular-nums text-stone-500">
              {filteredEntries.length === 0
                ? `Showing 0 of ${allUnifiedEntries.length} total entr${
                    allUnifiedEntries.length === 1 ? 'y' : 'ies'
                  }`
                : `Showing ${startIndex + 1}–${endIndex} of ${filteredEntries.length} matching (${allUnifiedEntries.length} total)`}
            </span>
          )}
        </div>

        {/* Type, Scope & Search Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-stone-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-stone-950 rounded-xl border border-stone-800 p-1 text-xs font-medium flex-wrap">
              {Object.entries(INTEL_TYPE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    typeFilter === key
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              value={missionScope}
              onChange={(e) => setMissionScope(e.target.value)}
              aria-label="Filter by mission scope"
              className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Scopes</option>
              <option value="campaign_wide">Campaign-Wide Intel</option>
              {missionOptions.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search intel, AARs, losses, callsign..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Intel & AAR Feed Grid */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 p-12 text-center space-y-3">
          <Binoculars className="w-10 h-10 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">
            {agedOutCount > 0 && recencyWindow !== 'all'
              ? 'All Matching Intel Has Aged Out of Current Window'
              : 'No Intelligence Reports Found'}
          </p>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {allUnifiedEntries.length === 0
              ? 'No intelligence reports or sortie AARs have been logged for this campaign yet.'
              : agedOutCount > 0 && recencyWindow !== 'all'
                ? `${agedOutCount} older intelligence report${agedOutCount === 1 ? '' : 's'} / sortie AAR${agedOutCount === 1 ? '' : 's'} from completed missions ${recencyWindow === '14d' ? 'outside the 14-day window' : 'over 30 days old'} are stored in the historical archive.`
                : 'Try clearing filters or adjusting your search query.'}
          </p>
          {agedOutCount > 0 && recencyWindow !== 'all' && (
            <button
              type="button"
              onClick={() => setRecencyWindow('all')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold text-amber-300 transition-colors"
            >
              <span>View Historical Archive ({agedOutCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
            {paginatedEntries.map((entry) => {
            if (entry.kind === 'sortie_aar') {
              const { mission, sortie } = entry;
              const bdaImages = (sortie.bdaMediaItems || []).filter((m) => !m.isVideo && isImageUrl(m.url));
              const bdaVideos = (sortie.bdaMediaItems || []).filter((m) => m.isVideo || isVideoUrl(m.url));
              const bdaDocs = (sortie.bdaMediaItems || []).filter(
                (m) => !m.isVideo && !isImageUrl(m.url) && !isVideoUrl(m.url)
              );
              const discordAarUrl = sortie.aarDiscordMessageUrl || sortie.discordMessageUrl;

              return (
                <div
                  key={entry.uid}
                  className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/10 p-5 shadow-xl flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 shrink-0">
                          {getIntelTypeIcon('aar')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 uppercase font-bold tracking-wider">
                              Sortie AAR &amp; BDA
                            </span>
                            {renderFreshnessBadge(entry)}
                            <span
                              className={`px-1.5 py-0.5 rounded border uppercase font-semibold ${getMissionStatusBadgeClasses(
                                mission.status
                              )}`}
                            >
                              {mission.statusLabel || mission.status}
                            </span>
                            {sortie.attendedCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 tabular-nums inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                {sortie.attendedCount} Attended
                              </span>
                            )}
                          </div>
                          <h3 className="font-display font-bold text-base text-stone-100 mt-1.5">
                            {sortie.name}
                          </h3>
                          <div className="text-xs text-stone-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <Target className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="text-stone-300">{mission.name}</span>
                            <span className="text-stone-600">&bull;</span>
                            <span className="font-mono">Sortie #{sortie.sortieNumber}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Friendly vs Enemy Losses Grid */}
                    {(sortie.ourLossesHtml ||
                      sortie.ourLosses ||
                      sortie.enemyLossesHtml ||
                      sortie.enemyLosses) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-rose-500/25 bg-rose-950/15 p-3">
                          <div className="text-[11px] uppercase tracking-wider text-rose-300 font-bold mb-1.5">
                            Friendly Losses
                          </div>
                          {sortie.ourLossesHtml ? (
                            <div
                              className={TACTICAL_PROSE_CLASSES}
                              dangerouslySetInnerHTML={{ __html: sortie.ourLossesHtml }}
                            />
                          ) : (
                            <p className="text-xs text-stone-300 whitespace-pre-line">
                              {sortie.ourLosses || 'No losses recorded.'}
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-3">
                          <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold mb-1.5">
                            Estimated Enemy Losses
                          </div>
                          {sortie.enemyLossesHtml ? (
                            <div
                              className={TACTICAL_PROSE_CLASSES}
                              dangerouslySetInnerHTML={{ __html: sortie.enemyLossesHtml }}
                            />
                          ) : (
                            <p className="text-xs text-stone-300 whitespace-pre-line">
                              {sortie.enemyLosses || 'No enemy losses recorded.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AAR Narrative Notes */}
                    {(sortie.aarNotesHtml || sortie.aarNotes) && (
                      <div className="rounded-2xl border border-stone-800 bg-stone-950/75 p-3.5">
                        <div className="text-[11px] uppercase tracking-wider text-stone-400 font-bold mb-1.5">
                          Debrief &amp; Assessment
                        </div>
                        {sortie.aarNotesHtml ? (
                          <div
                            className={TACTICAL_PROSE_CLASSES}
                            dangerouslySetInnerHTML={{ __html: sortie.aarNotesHtml }}
                          />
                        ) : (
                          <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">
                            {sortie.aarNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* BDA Images */}
                    {bdaImages.length > 0 && (() => {
                      const isExpanded = Boolean(expandedImagesByUid[entry.uid]);
                      const visibleImages = isExpanded
                        ? bdaImages
                        : bdaImages.slice(0, INITIAL_VISIBLE_IMAGES);
                      const hiddenCount = bdaImages.length - visibleImages.length;

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                            <span>BDA Reconnaissance Imagery ({bdaImages.length})</span>
                            {bdaImages.length > INITIAL_VISIBLE_IMAGES && (
                              <button
                                type="button"
                                onClick={() => toggleImageExpansion(entry.uid)}
                                className="text-amber-400 hover:text-amber-300 underline"
                              >
                                {isExpanded ? 'Collapse' : `+${hiddenCount} more`}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {visibleImages.map((media, idx) => (
                              <button
                                key={`${entry.uid}-img-${idx}`}
                                type="button"
                                onClick={() => setLightboxImageUrl(media.url)}
                                className="rounded-xl overflow-hidden border border-stone-800 hover:border-amber-400/60 bg-stone-950 transition-colors"
                              >
                                <img
                                  src={media.url}
                                  alt={`${sortie.name} BDA #${idx + 1}`}
                                  className="w-full h-28 object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* BDA Videos */}
                    {bdaVideos.map((media, idx) => (
                      <video
                        key={`${entry.uid}-vid-${idx}`}
                        controls
                        preload="none"
                        className="w-full max-h-56 rounded-xl border border-stone-800 bg-black"
                      >
                        <source src={media.url} />
                      </video>
                    ))}

                    {/* BDA Other Documents */}
                    {bdaDocs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {bdaDocs.map((media, idx) => (
                          <button
                            key={`${entry.uid}-doc-${idx}`}
                            type="button"
                            onClick={() => onOpenExternal(media.url)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs text-stone-200 flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span className="truncate max-w-[200px]">{media.filename}</span>
                            <ArrowSquareOut className="w-3 h-3 text-stone-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AAR Card Footer */}
                  <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2 flex-wrap text-xs text-stone-400">
                    <div>
                      <span>
                        Lead:{' '}
                        <strong className="text-stone-200">
                          {mission.planningUserName || mission.squadronName || 'Command Staff'}
                        </strong>
                      </span>
                      {entry.createdAt && (
                        <span className="text-stone-500">
                          {' '}
                          &bull; {formatDateTimeShort(entry.createdAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {onInspectMission && (
                        <button
                          type="button"
                          onClick={() => onInspectMission(mission, 'aar')}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-bold flex items-center gap-1 transition-colors"
                        >
                          <Scroll className="w-3.5 h-3.5" />
                          <span>Open Mission AAR</span>
                        </button>
                      )}
                      {discordAarUrl && (
                        <button
                          type="button"
                          onClick={() => onOpenExternal(discordAarUrl)}
                          className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                        >
                          <span>Discord</span>
                          <ArrowSquareOut className="w-3 h-3" />
                        </button>
                      )}
                      {onOpenOnMap && (
                        <button
                          type="button"
                          onClick={() => onOpenOnMap(mission.id)}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          <span>Map</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Standard S2 Intelligence Report Card
            const { report, mission } = entry;
            const images = report.fileUrls.filter(isImageUrl);
            const audioFiles = report.fileUrls.filter(isAudioUrl);
            const videoFiles = report.fileUrls.filter(isVideoUrl);
            const docs = report.fileUrls.filter(
              (u) => !isImageUrl(u) && !isAudioUrl(u) && !isVideoUrl(u)
            );

            return (
              <div
                key={entry.uid}
                className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-stone-950 border border-stone-800 shrink-0">
                        {getIntelTypeIcon(report.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300 uppercase font-semibold tracking-wider">
                            {INTEL_TYPE_LABELS[report.type] || report.type}
                          </span>
                          {renderFreshnessBadge(entry)}
                          {mission && (
                            <span
                              className={`px-1.5 py-0.5 rounded border uppercase font-semibold ${getMissionStatusBadgeClasses(
                                mission.status
                              )}`}
                            >
                              {mission.statusLabel || mission.status}
                            </span>
                          )}
                          <span className="text-stone-400 truncate">
                            {entry.missionName || 'Campaign-Wide Intel'}
                          </span>
                          {report.sortieName && (
                            <span className="text-stone-500">&bull; {report.sortieName}</span>
                          )}
                        </div>
                        <h3 className="font-display font-bold text-base text-stone-100 mt-1">
                          {report.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {report.notes && (
                    <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">
                      {report.notes}
                    </p>
                  )}

                  {images.length > 0 && (() => {
                    const isExpanded = Boolean(expandedImagesByUid[entry.uid]);
                    const visibleImages = isExpanded
                      ? images
                      : images.slice(0, INITIAL_VISIBLE_IMAGES);
                    const hiddenCount = images.length - visibleImages.length;

                    return (
                      <div className="space-y-1.5">
                        {images.length > INITIAL_VISIBLE_IMAGES && (
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                            <span>Reconnaissance Imagery ({images.length})</span>
                            <button
                              type="button"
                              onClick={() => toggleImageExpansion(entry.uid)}
                              className="text-amber-400 hover:text-amber-300 underline"
                            >
                              {isExpanded ? 'Collapse' : `+${hiddenCount} more`}
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {visibleImages.map((url, idx) => (
                            <button
                              key={`${report.id}-img-${idx}`}
                              type="button"
                              onClick={() => setLightboxImageUrl(url)}
                              className="rounded-xl overflow-hidden border border-stone-800 hover:border-amber-400/60 bg-stone-950 transition-colors"
                            >
                              <img
                                src={url}
                                alt={`${report.title} #${idx + 1}`}
                                className="w-full h-28 object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {audioFiles.map((url, idx) => (
                    <div
                      key={`${report.id}-aud-${idx}`}
                      className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1"
                    >
                      <div className="text-xs font-medium text-amber-300">
                        Intercept Audio #{idx + 1}
                      </div>
                      <audio controls preload="none" className="w-full">
                        <source src={url} />
                      </audio>
                    </div>
                  ))}

                  {videoFiles.map((url, idx) => (
                    <video
                      key={`${report.id}-vid-${idx}`}
                      controls
                      preload="none"
                      className="w-full max-h-56 rounded-xl border border-stone-800 bg-black"
                    >
                      <source src={url} />
                    </video>
                  ))}

                  {report.videoUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenExternal(report.videoUrl)}
                      className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-medium text-purple-300 flex items-center gap-1.5"
                    >
                      <VideoCamera weight="duotone" className="w-4 h-4" />
                      <span>Open External Video Feed</span>
                      <ArrowSquareOut className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {docs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {docs.map((url, idx) => {
                        const fileName = decodeURIComponent(
                          url.split('?')[0].split('/').pop() || `Document ${idx + 1}`
                        );
                        return (
                          <button
                            key={`${report.id}-doc-${idx}`}
                            type="button"
                            onClick={() => onOpenExternal(url)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-xs text-stone-200 flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="truncate max-w-[200px]">{fileName}</span>
                            <ArrowSquareOut className="w-3 h-3 text-stone-500" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-2 flex-wrap text-xs text-stone-400">
                  <div>
                    {report.reporterName ? (
                      <span>
                        Reported by <strong className="text-stone-200">{report.reporterName}</strong>
                      </span>
                    ) : (
                      <span>S2 Intelligence</span>
                    )}
                    {report.createdAt && (
                      <span className="text-stone-500"> &bull; {formatDateTimeShort(report.createdAt)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {mission && onInspectMission && (
                      <button
                        type="button"
                        onClick={() => onInspectMission(mission, 'overview')}
                        className="px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/40 text-stone-200 hover:text-amber-300 flex items-center gap-1 transition-colors"
                      >
                        <Target className="w-3.5 h-3.5 text-amber-400" />
                        <span>Inspect Mission</span>
                      </button>
                    )}
                    {report.discordMessageUrl && (
                      <button
                        type="button"
                        onClick={() => onOpenExternal(report.discordMessageUrl)}
                        className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                      >
                        <span>Discord</span>
                        <ArrowSquareOut className="w-3 h-3" />
                      </button>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-md">
            <div className="text-xs tabular-nums text-stone-400 flex items-center gap-2 flex-wrap">
              <span>
                Showing <strong className="text-stone-200">{startIndex + 1}</strong>–
                <strong className="text-stone-200">{endIndex}</strong> of{' '}
                <strong className="text-amber-400">{filteredEntries.length}</strong> matching
                intel entr{filteredEntries.length === 1 ? 'y' : 'ies'}
              </span>
              {agedOutCount > 0 && recencyWindow !== 'all' && (
                <button
                  type="button"
                  onClick={() => setRecencyWindow('all')}
                  className="text-amber-400/90 hover:text-amber-300 underline"
                >
                  (+{agedOutCount} archived)
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="flex items-center gap-1.5 mr-2 text-xs text-stone-400">
                <span>Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Intel reports per page"
                  className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-200 text-xs tabular-nums focus:outline-none focus:border-amber-500/60"
                >
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="First Page"
                aria-label="First Page"
              >
                <CaretDoubleLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <CaretLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1.5 text-stone-600 font-mono text-xs"
                      >
                        ...
                      </span>
                    );
                  }
                  const num = p as number;
                  const isActive = num === safePage;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCurrentPage(num)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono transition-colors ${
                        isActive
                          ? 'bg-amber-500 text-stone-950 font-bold shadow'
                          : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next Page"
                aria-label="Next Page"
              >
                <CaretRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Last Page"
                aria-label="Last Page"
              >
                <CaretDoubleRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Image Lightbox */}
      {lightboxImageUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setLightboxImageUrl(null)}
            className="fixed inset-0 !m-0 w-screen h-screen z-50 bg-stone-950/65 backdrop-blur-md flex items-center justify-center p-6 cursor-pointer"
          >
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 hover:text-amber-300"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Reconnaissance Imagery"
              className="max-w-full max-h-[85vh] rounded-2xl border border-stone-700 shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </div>
  );
};
