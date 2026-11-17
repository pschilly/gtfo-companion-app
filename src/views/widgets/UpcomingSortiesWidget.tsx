import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarBlank, ShieldCheck } from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../../config/constants';
import { useApp } from '../../context/AppContext';
import { fetchCalendarEvents } from '../../services/calendarService';
import { CalendarEventItem } from '../../types';
import { getWidgetListLayout, HomeWidgetProps } from './types';

export const UpcomingSortiesWidget: React.FC<HomeWidgetProps> = ({ colSpan }) => {
  const {
    upcomingCalendarEvents,
    setSelectedCalendarEventUid,
    setActiveTab,
    userSession,
  } = useApp();

  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setEventsLoading(true);
    const now = new Date();
    fetchCalendarEvents(
      STATIC_CONFIG.portalBaseUrl,
      {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        discord_id: userSession?.id,
      },
      userSession?.accessToken
    )
      .then((res) => {
        if (!isMounted) return;
        const nowMs = Date.now();
        const future = (res.events || [])
          .filter((ev) => {
            const t = new Date(ev.scheduled_at).getTime();
            return !isNaN(t) && t >= nowMs - 2 * 3600 * 1000 && !ev.is_concluded;
          })
          .slice(0, 6);
        setUpcomingEvents(future);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setEventsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userSession?.id, userSession?.accessToken]);

  const displayedEvents =
    upcomingEvents.length > 0
      ? upcomingEvents
      : !eventsLoading
      ? upcomingCalendarEvents.slice(0, 6)
      : [];

  const { maxListCount, listContainerClass } = getWidgetListLayout(colSpan);
  const eventsSlice = displayedEvents.slice(0, maxListCount);

  return (
    <>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CalendarBlank className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                Upcoming Sorties &amp; Training
              </h3>
              <p className="text-[11px] font-mono text-stone-400">
                Scheduled taskforce events
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Full Calendar</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {eventsSlice.length > 0 ? (
          <div className={listContainerClass}>
            {eventsSlice.map((ev) => {
              const evDate = new Date(ev.scheduled_at);
              const dateStr = !isNaN(evDate.getTime())
                ? evDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })
                : 'TBD';

              return (
                <div
                  key={ev.uid || `${ev.type}-${ev.id}`}
                  onClick={() => {
                    setSelectedCalendarEventUid(ev.uid || `${ev.type}-${ev.id}`);
                    setActiveTab('calendar');
                  }}
                  className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border shrink-0 ${
                          ev.type === 'campaign'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {ev.category_badge || (ev.type === 'campaign' ? 'OP' : 'TRG')}
                      </span>
                      <span className="font-bold text-xs text-stone-100 group-hover:text-amber-400 transition truncate">
                        {ev.name || ev.title}
                      </span>
                    </div>

                    {ev.is_attending ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" /> Attending
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-stone-400 shrink-0">
                        👥 {ev.attendees?.length || 0}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                    <span className="truncate">
                      {ev.subtitle || ev.theatre || 'Global Task Force'}
                    </span>
                    <span className="text-amber-300/90 font-semibold shrink-0">
                      {dateStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : eventsLoading ? (
          <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
            Loading upcoming sorties...
          </div>
        ) : (
          <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
            No upcoming sorties scheduled right now.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
        <span>Synchronized with Discord briefing boards</span>
        <button
          onClick={() => setActiveTab('calendar')}
          className="text-amber-400 hover:text-amber-300 font-bold"
        >
          Sign Up &rarr;
        </button>
      </div>
    </>
  );
};
