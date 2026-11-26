import React, { useMemo, useState } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  CalendarBlank,
  CheckCircle,
  Clock,
  Coins,
  MagnifyingGlass,
  MapTrifold,
  Sword,
  Target,
  Users,
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { CampaignItem, CampaignMissionItem } from '../../types';
import { MissionModalSection } from './CampaignMissionModal';
import {
  formatDateTimeShort,
  formatZuluShort,
  getMissionStatusBadgeClasses,
  renderResourceIcon,
} from './utils';

interface CampaignMissionsTabProps {
  campaign: CampaignItem;
  onInspectMission: (mission: CampaignMissionItem, section?: MissionModalSection) => void;
  onOpenOnMap: (missionId: number) => void;
}

type MissionStatusFilter = 'all' | 'active_open' | 'completed' | 'has_aar';

export const CampaignMissionsTab: React.FC<CampaignMissionsTabProps> = ({
  campaign,
  onInspectMission,
  onOpenOnMap,
}) => {
  const { userSession, upcomingCalendarEvents, openSortieInCalendar } = useApp();
  const [statusFilter, setStatusFilter] = useState<MissionStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allMissions = useMemo(() => campaign.missions || [], [campaign.missions]);

  const activeOpenCount = useMemo(
    () => allMissions.filter((m) => ['open', 'active'].includes(m.status.toLowerCase())).length,
    [allMissions]
  );

  const completedCount = useMemo(
    () => allMissions.filter((m) => m.status.toLowerCase() === 'completed').length,
    [allMissions]
  );

  const aarCount = useMemo(
    () => allMissions.filter((m) => (m.sorties || []).some((s) => s.hasAar)).length,
    [allMissions]
  );

  const calendarAttendeeByUid = useMemo(() => {
    const map = new Map<string, boolean>();
    upcomingCalendarEvents.forEach((ev) => {
      if (ev.is_attending) {
        map.set(ev.uid, true);
      }
    });
    return map;
  }, [upcomingCalendarEvents]);

  const filteredMissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allMissions.filter((m) => {
      const st = m.status.toLowerCase();
      const hasAar = (m.sorties || []).some((s) => s.hasAar);

      if (statusFilter === 'active_open' && st !== 'open' && st !== 'active') {
        return false;
      }
      if (statusFilter === 'completed' && st !== 'completed') {
        return false;
      }
      if (statusFilter === 'has_aar' && !hasAar) {
        return false;
      }

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.taskingName.toLowerCase().includes(q) ||
        (m.squadronName && m.squadronName.toLowerCase().includes(q)) ||
        (m.weather && m.weather.toLowerCase().includes(q)) ||
        m.objectives.some((o) => (o.objective || o.name).toLowerCase().includes(q)) ||
        m.sorties.some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.aarNotes && s.aarNotes.toLowerCase().includes(q))
        )
      );
    });
  }, [allMissions, searchQuery, statusFilter]);

  const activeList = useMemo(
    () => filteredMissions.filter((m) => ['open', 'active'].includes(m.status.toLowerCase())),
    [filteredMissions]
  );

  const completedList = useMemo(
    () => filteredMissions.filter((m) => m.status.toLowerCase() === 'completed'),
    [filteredMissions]
  );

  const shouldShowGrouped =
    statusFilter === 'all' && activeList.length > 0 && completedList.length > 0;

  const renderMissionCard = (mission: CampaignMissionItem) => {
    const missionSorties = mission.sorties || [];
    const missionHasAar = missionSorties.some((s) => s.hasAar);
    const totalRosterCount = missionSorties.reduce((acc, s) => acc + (s.attendeesCount || 0), 0);

    return (
      <div
        key={mission.id}
        className="rounded-3xl border border-stone-800 bg-stone-900/90 hover:border-stone-700 p-5 shadow-xl space-y-4 transition-colors"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${getMissionStatusBadgeClasses(
                  mission.status
                )}`}
              >
                {mission.statusLabel}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {mission.taskingName}
              </span>
              {missionHasAar && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  AAR Filed
                </span>
              )}
              {mission.squadronName && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-950 text-stone-300 border border-stone-800">
                  {mission.squadronName}
                </span>
              )}
              {mission.planningUserName && (
                <span className="text-xs text-stone-400">
                  Planner: <strong className="text-stone-200">{mission.planningUserName}</strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onInspectMission(mission, 'overview')}
              className="text-left group block"
            >
              <h3 className="font-display text-lg font-bold text-stone-100 group-hover:text-amber-300 transition-colors">
                {mission.name}
              </h3>
            </button>

            {mission.weather && (
              <p className="text-xs font-mono text-stone-400">WX: {mission.weather}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onInspectMission(mission, 'overview')}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-500/15 transition-colors"
            >
              <Target weight="bold" className="w-3.5 h-3.5" />
              <span>Mission Briefing</span>
            </button>

            {missionHasAar && (
              <button
                type="button"
                onClick={() => onInspectMission(mission, 'aar')}
                className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-colors"
              >
                <Sword className="w-3.5 h-3.5" />
                <span>View AAR</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenOnMap(mission.id)}
              className="px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-semibold text-sky-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <MapTrifold weight="duotone" className="w-4 h-4" />
              <span>Map</span>
            </button>
          </div>
        </div>

        {/* Sorties & Calendar Links Strip */}
        {missionSorties.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-stone-800/70">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 flex items-center justify-between">
              <span>Sorties &amp; Execution Schedule ({missionSorties.length})</span>
              <button
                type="button"
                onClick={() => onInspectMission(mission, 'sorties')}
                className="text-amber-400 hover:text-amber-300 normal-case font-medium hover:underline"
              >
                inspect full roster &rarr;
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
              {missionSorties.map((sortie) => {
                const isAttending = Boolean(
                  calendarAttendeeByUid.get(sortie.calendarEventUid) ||
                    (userSession?.id &&
                      sortie.attendees.some(
                        (a) => a.discordId && String(a.discordId) === String(userSession.id)
                      ))
                );

                return (
                  <div
                    key={sortie.id}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isAttending
                        ? 'bg-emerald-950/20 border-emerald-500/35'
                        : 'bg-stone-950/70 border-stone-800/90'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-stone-100">{sortie.name}</span>
                        {sortie.hasAar ? (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold uppercase">
                            AAR
                          </span>
                        ) : sortie.isSignupOpen ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold uppercase">
                            RSVP Open
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 border border-stone-700 text-[11px] font-semibold uppercase">
                            Closed
                          </span>
                        )}
                        {isAttending && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-stone-950 text-[11px] font-bold uppercase">
                            ✓ Attending
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-stone-300">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {sortie.scheduledAt ? formatZuluShort(sortie.scheduledAt) : 'TBD'}
                        </span>
                        <span>&bull;</span>
                        <span className="tabular-nums">
                          {sortie.hasAar
                            ? `${sortie.attendedCount} flew`
                            : `${sortie.attendeesCount} pilot${
                                sortie.attendeesCount === 1 ? '' : 's'
                              }`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          openSortieInCalendar(sortie.id, {
                            missionId: null,
                            missionSection: 'overview',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Open this sortie in Event Calendar to inspect or RSVP"
                      >
                        <CalendarBlank className="w-3 h-3" />
                        <span>{sortie.isSignupOpen ? 'Calendar / RSVP' : 'Calendar'}</span>
                      </button>

                      {sortie.hasAar && (
                        <button
                          type="button"
                          onClick={() => onInspectMission(mission, 'aar')}
                          className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                        >
                          AAR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : mission.startTime ? (
          <div className="flex items-center gap-2 text-xs text-stone-400 pt-1">
            <Clock className="w-3.5 h-3.5 text-stone-500" />
            <span>
              Scheduled: <span className="font-mono">{formatDateTimeShort(mission.startTime)}</span>
            </span>
          </div>
        ) : null}

        {/* Actual Objectives Names Preview */}
        {mission.objectives.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-stone-800/70">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              <span>
                Tactical Objectives ({mission.completedObjectivesCount}/{mission.objectivesCount}{' '}
                Complete)
              </span>
              <button
                type="button"
                onClick={() => onInspectMission(mission, 'objectives')}
                className="text-amber-400 hover:text-amber-300 normal-case font-medium hover:underline"
              >
                full breakdown &rarr;
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
              {mission.objectives.slice(0, 6).map((obj, idx) => (
                <div
                  key={`${mission.id}-card-obj-${idx}`}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                    obj.isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                      : 'bg-stone-950/70 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {obj.isCompleted ? (
                      <CheckCircle weight="fill" className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          obj.priority === 'high'
                            ? 'bg-rose-400'
                            : obj.priority === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-stone-500'
                        }`}
                      />
                    )}
                    <span className="font-medium truncate">{obj.objective || obj.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                    {obj.points !== undefined && obj.points > 0 && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                        +{obj.points} {obj.resourceShortLabel || 'CR'}
                      </span>
                    )}
                    <span className="px-1.5 py-0.2 rounded font-sans bg-stone-900 border border-stone-800 uppercase text-stone-400">
                      {obj.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {mission.objectives.length > 6 && (
              <button
                type="button"
                onClick={() => onInspectMission(mission, 'objectives')}
                className="text-xs font-medium text-amber-400 hover:underline"
              >
                + {mission.objectives.length - 6} more objective(s) — view all
              </button>
            )}
          </div>
        )}

        {/* Stats Footer */}
        <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between gap-3 flex-wrap text-xs text-stone-400">
          <div className="flex items-center gap-4 flex-wrap tabular-nums">
            <span className="flex items-center gap-1 text-stone-300">
              <AirplaneTilt weight="duotone" className="w-3.5 h-3.5 text-sky-400" />
              <strong>{mission.flightsCount}</strong> Flight(s)
            </span>
            {totalRosterCount > 0 && (
              <span className="flex items-center gap-1 text-stone-300">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <strong>{totalRosterCount}</strong> Rostered
              </span>
            )}
            {mission.rewardBadges.length > 0 && (
              <span className="flex items-center gap-1.5 font-mono text-amber-300 text-xs">
                <Coins weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {mission.rewardBadges
                    .map((b) => `${b.amount.toLocaleString()} ${b.shortLabel}`)
                    .join(' • ')}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {mission.lat !== null &&
              mission.lat !== undefined &&
              mission.lng !== null &&
              mission.lng !== undefined && (
                <span className="font-mono text-stone-500">
                  {mission.lat.toFixed(3)}°, {mission.lng.toFixed(3)}°
                </span>
              )}
            <button
              type="button"
              onClick={() => onInspectMission(mission, 'comms_packages')}
              className="text-stone-400 hover:text-amber-300 font-medium transition-colors"
            >
              Comms &amp; Plans &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Filters */}
      <div className="rounded-3xl border border-stone-800 bg-stone-900/90 p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <AirplaneTakeoff weight="duotone" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-stone-100">
                Campaign Missions Directory
              </h2>
              <p className="text-xs text-stone-400">
                Active &amp; completed missions, tactical objectives, sorties, AAR debriefs &amp; calendar links for {campaign.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
          <div className="flex items-center bg-stone-950 rounded-xl border border-stone-800 p-1 text-xs font-medium flex-wrap gap-1 tabular-nums">
            {(
              [
                { id: 'all', label: `All (${allMissions.length})` },
                { id: 'active_open', label: `Active & Open (${activeOpenCount})` },
                { id: 'completed', label: `Completed (${completedCount})` },
                { id: 'has_aar', label: `With AAR (${aarCount})` },
              ] as { id: MissionStatusFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  statusFilter === opt.id
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search missions, objectives, sorties, AAR..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* Missions List (Grouped when viewing All with both Active & Completed) */}
      {filteredMissions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-800 bg-stone-900/60 p-12 text-center space-y-2">
          <AirplaneTakeoff className="w-10 h-10 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">No Matching Missions</p>
          <p className="text-xs text-stone-500">
            {allMissions.length === 0
              ? 'No missions have been published for this campaign yet.'
              : 'Try adjusting your status filter or search query.'}
          </p>
        </div>
      ) : shouldShowGrouped ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Current Active &amp; Open Operations ({activeList.length})
              </h3>
            </div>
            <div className="space-y-4">{activeList.map(renderMissionCard)}</div>
          </section>

          <section className="space-y-3 pt-2">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                Completed Operations &amp; Archives ({completedList.length})
              </h3>
            </div>
            <div className="space-y-4">{completedList.map(renderMissionCard)}</div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">{filteredMissions.map(renderMissionCard)}</div>
      )}
    </div>
  );
};
