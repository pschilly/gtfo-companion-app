import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AirplaneTilt,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  Camera,
  CaretLeft,
  CaretRight,
  Certificate,
  Check,
  CloudCheck,
  Compass,
  DotsSixVertical,
  EyeSlash,
  GraduationCap,
  ListChecks,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  SquaresFour,
  User,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { GTFO_GRADE_META } from '../data/portalData';
import { fetchCalendarEvents } from '../services/calendarService';
import { fetchHeroImages, HeroImageItem } from '../services/heroService';
import { HOME_WIDGET_CATALOG } from '../services/homeLayoutService';
import {
  CalendarEventItem,
  HomeWidgetColSpan,
  HomeWidgetId,
  HomeWidgetItem,
} from '../types';

const COL_SPAN_CLASS: Record<HomeWidgetColSpan, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

const COL_SPAN_OPTIONS: { span: HomeWidgetColSpan; label: string }[] = [
  { span: 4, label: '1/3' },
  { span: 6, label: '1/2' },
  { span: 8, label: '2/3' },
  { span: 12, label: 'Full' },
];

function getWidgetIcon(id: HomeWidgetId) {
  switch (id) {
    case 'upcoming_sorties':
      return <CalendarBlank className="w-4 h-4 text-amber-400" />;
    case 'filed_flight_plans':
      return <Compass className="w-4 h-4 text-sky-400" />;
    case 'my_flight_plans':
      return <User className="w-4 h-4 text-amber-400" />;
    case 'dossier_summary':
      return <SquaresFour className="w-4 h-4 text-amber-400" />;
    case 'tracked_qualifications':
      return <GraduationCap className="w-4 h-4 text-emerald-400" />;
    case 'qualified_airframes':
      return <AirplaneTilt className="w-4 h-4 text-sky-400" />;
  }
}

export const HomeView: React.FC = () => {
  const {
    memberProfile,
    setActiveTab,
    checklistSummary,
    filedFlightPlans,
    memberFlightPlans,
    upcomingCalendarEvents,
    setSelectedCalendarEventUid,
    setSelectedFlightPlanId,
    userSession,
    qualificationsCatalog,
    settings,
    homeLayout,
    updateHomeLayout,
    resetHomeLayout,
    isSyncingHomeLayout,
  } = useApp();

  // Hero gallery images
  const [heroImages, setHeroImages] = useState<HeroImageItem[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  // Upcoming calendar events
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Home customization state
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<HomeWidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<HomeWidgetId | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{
    widgetId: HomeWidgetId;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const dragOverWidgetIdRef = useRef<HomeWidgetId | null>(null);
  const handleDropWidgetRef = useRef<(fromId: HomeWidgetId, targetId: HomeWidgetId) => void>(
    () => {}
  );

  useEffect(() => {
    let isMounted = true;
    fetchHeroImages(STATIC_CONFIG.portalBaseUrl, userSession?.accessToken)
      .then((imgs) => {
        if (isMounted && imgs.length > 0) {
          setHeroImages(imgs);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [userSession?.accessToken]);

  // Auto-advance hero slides every 7 seconds if multiple
  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroImages.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  // Load upcoming calendar events
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

  const currentGradeMeta = GTFO_GRADE_META[memberProfile.grade] || GTFO_GRADE_META.G1;

  const displayedEvents =
    upcomingEvents.length > 0
      ? upcomingEvents
      : !eventsLoading
      ? upcomingCalendarEvents.slice(0, 6)
      : [];

  const currentHero = heroImages.length > 0 ? heroImages[activeSlide] : null;

  // Ordered widgets from preferences
  const orderedWidgets = useMemo(() => {
    return [...homeLayout.widgets].sort((a, b) => a.order - b.order);
  }, [homeLayout.widgets]);

  const enabledWidgets = useMemo(() => {
    return orderedWidgets.filter((w) => w.enabled);
  }, [orderedWidgets]);

  const catalogById = useMemo(() => {
    return new Map(HOME_WIDGET_CATALOG.map((c) => [c.id, c]));
  }, []);

  // Derived data for additional widgets
  const xpProgressPercent = useMemo(() => {
    if (!memberProfile.nextGrade) return 100;
    if (typeof memberProfile.gradePercentage === 'number' && memberProfile.gradePercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.gradePercentage));
    }
    if (typeof memberProfile.tierPercentage === 'number' && memberProfile.tierPercentage > 0) {
      return Math.min(100, Math.max(4, memberProfile.tierPercentage));
    }
    const nextCeiling = memberProfile.nextGrade.xpRequired || 1;
    return Math.min(100, Math.max(4, ((memberProfile.xp || 0) / nextCeiling) * 100));
  }, [memberProfile]);

  const trackedCourses = useMemo(() => {
    const ids = new Set(settings.trackedQualificationIds || []);
    return qualificationsCatalog.filter((c) => ids.has(c.id));
  }, [qualificationsCatalog, settings.trackedQualificationIds]);

  const issuedCertCount = useMemo(() => {
    return (memberProfile.certificates || []).filter((c) => c.isIssued).length;
  }, [memberProfile.certificates]);

  // Layout mutation helpers
  const handleToggleWidget = (id: HomeWidgetId) => {
    const nextWidgets: HomeWidgetItem[] = orderedWidgets.map((w) =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    );
    updateHomeLayout(nextWidgets);
  };

  const handleSetColSpan = (id: HomeWidgetId, colSpan: HomeWidgetColSpan) => {
    const nextWidgets: HomeWidgetItem[] = orderedWidgets.map((w) =>
      w.id === id ? { ...w, colSpan } : w
    );
    updateHomeLayout(nextWidgets);
  };

  const handleMoveWidget = (id: HomeWidgetId, direction: -1 | 1) => {
    const enabled = [...enabledWidgets];
    const currentIdx = enabled.findIndex((w) => w.id === id);
    if (currentIdx === -1) return;
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= enabled.length) return;

    const [moved] = enabled.splice(currentIdx, 1);
    enabled.splice(targetIdx, 0, moved);

    const disabled = orderedWidgets.filter((w) => !w.enabled);
    updateHomeLayout([...enabled, ...disabled]);
  };

  const handleDropWidget = (fromId: HomeWidgetId, targetId: HomeWidgetId) => {
    if (!fromId || fromId === targetId) {
      dragOverWidgetIdRef.current = null;
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDragPointer(null);
      return;
    }

    const enabled = [...enabledWidgets];
    const fromIdx = enabled.findIndex((w) => w.id === fromId);
    const toIdx = enabled.findIndex((w) => w.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      dragOverWidgetIdRef.current = null;
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDragPointer(null);
      return;
    }

    const [moved] = enabled.splice(fromIdx, 1);
    enabled.splice(toIdx, 0, moved);

    const disabled = orderedWidgets.filter((w) => !w.enabled);
    updateHomeLayout([...enabled, ...disabled]);
    dragOverWidgetIdRef.current = null;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
    setDragPointer(null);
  };

  handleDropWidgetRef.current = handleDropWidget;

  useEffect(() => {
    const clearDragState = () => {
      dragStartRef.current = null;
      dragOverWidgetIdRef.current = null;
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      setDragPointer(null);
    };

    if (!isCustomizing) {
      clearDragState();
      return;
    }

    const resolveWidgetIdAtPoint = (clientX: number, clientY: number): HomeWidgetId | null => {
      const target = document.elementFromPoint(clientX, clientY);
      const card = target?.closest('[data-home-widget-id]') as HTMLElement | null;
      const widgetId = card?.getAttribute('data-home-widget-id');
      return widgetId ? (widgetId as HomeWidgetId) : null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStartRef.current;
      if (!state) return;

      if (!state.active) {
        if (Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 4) {
          return;
        }
        state.active = true;
        setDraggedWidgetId(state.widgetId);
        window.getSelection()?.removeAllRanges();
      }

      setDragPointer({ x: e.clientX, y: e.clientY });

      const mainEl = document.querySelector('main');
      if (mainEl) {
        const rect = mainEl.getBoundingClientRect();
        const edgeThreshold = 72;
        if (e.clientY < rect.top + edgeThreshold) {
          mainEl.scrollTop -= 12;
        } else if (e.clientY > rect.bottom - edgeThreshold) {
          mainEl.scrollTop += 12;
        }
      }

      const hoveredId = resolveWidgetIdAtPoint(e.clientX, e.clientY);
      const nextOverId = hoveredId && hoveredId !== state.widgetId ? hoveredId : null;
      if (dragOverWidgetIdRef.current !== nextOverId) {
        dragOverWidgetIdRef.current = nextOverId;
        setDragOverWidgetId(nextOverId);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const state = dragStartRef.current;
      if (!state) return;

      if (state.active) {
        const pointTargetId = resolveWidgetIdAtPoint(e.clientX, e.clientY);
        const targetId =
          (pointTargetId && pointTargetId !== state.widgetId ? pointTargetId : null) ??
          dragOverWidgetIdRef.current;
        if (targetId && targetId !== state.widgetId) {
          dragStartRef.current = null;
          handleDropWidgetRef.current(state.widgetId, targetId);
          return;
        }
        clearDragState();
        return;
      }

      dragStartRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDragState();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', clearDragState);
    window.addEventListener('blur', clearDragState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', clearDragState);
      window.removeEventListener('blur', clearDragState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCustomizing]);

  const handleWidgetPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    widgetId: HomeWidgetId
  ) => {
    if (!isCustomizing || e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [data-no-widget-drag]')) {
      return;
    }

    if (target?.closest('[data-widget-drag-handle]')) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      dragStartRef.current = {
        widgetId,
        startX: e.clientX,
        startY: e.clientY,
        active: true,
      };
      setDraggedWidgetId(widgetId);
      setDragPointer({ x: e.clientX, y: e.clientY });
      return;
    }

    dragStartRef.current = {
      widgetId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  };

  const renderWidgetBody = (widget: HomeWidgetItem) => {
    const isWide = widget.colSpan === 12;
    const maxListCount = isWide ? 6 : 4;
    const listContainerClass = isWide
      ? 'mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5'
      : 'mt-4 space-y-2.5';

    switch (widget.id) {
      case 'upcoming_sorties': {
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
      }

      case 'filed_flight_plans': {
        const plansSlice = filedFlightPlans.slice(0, maxListCount);
        return (
          <>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                      Recently Filed Flight Plans
                    </h3>
                    <p className="text-[11px] font-mono text-stone-400">
                      Active ATC route clearances
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('atc')}
                  className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
                >
                  <span>View ATC</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {plansSlice.length > 0 ? (
                <div className={listContainerClass}>
                  {plansSlice.map((plan) => {
                    const dep = plan.departure_airfield || 'DEP';
                    const arr = plan.destination_airfield || 'ARR';
                    const callsign = plan.callsign || plan.name || 'Flight';
                    const afLabel = plan.airframe?.abbreviation || plan.airframe?.name;
                    const pilotName = plan.creator?.callsign || plan.creator?.name || 'Pilot';
                    const missionLabel = plan.mission?.name || plan.sortie?.name || 'Operation';

                    return (
                      <div
                        key={plan.id}
                        onClick={() => {
                          setSelectedFlightPlanId(plan.id || plan.identifier);
                          setActiveTab('atc');
                        }}
                        className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-sky-500/40 transition-all cursor-pointer group flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0">
                              {plan.identifier || `FP-${plan.id}`}
                            </span>
                            <span className="font-mono font-bold text-xs text-stone-100 group-hover:text-sky-400 transition truncate">
                              {callsign}
                            </span>
                            {afLabel && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-800 text-stone-300 shrink-0">
                                {afLabel}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-stone-400 shrink-0 truncate max-w-[120px]">
                            {missionLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                          <div className="flex items-center gap-1.5 text-stone-200">
                            <span className="font-bold">{dep}</span>
                            <ArrowRight className="w-3 h-3 text-stone-500" />
                            <span className="font-bold">{arr}</span>
                          </div>
                          <span className="text-stone-400 truncate max-w-[140px]">
                            Pilot: <strong className="text-stone-200">{pilotName}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
                  No filed flight plans on active frequency.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>DTC &amp; Kneeboard downloads ready</span>
              <button
                onClick={() => setActiveTab('atc')}
                className="text-sky-400 hover:text-sky-300 font-bold"
              >
                Open Air Traffic &rarr;
              </button>
            </div>
          </>
        );
      }

      case 'my_flight_plans': {
        const myPlansSlice = memberFlightPlans.slice(0, maxListCount);
        return (
          <>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                      My Flight Plans
                    </h3>
                    <p className="text-[11px] font-mono text-stone-400">
                      Authored &amp; mission-assigned routes
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('atc')}
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <span>All My Plans</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {myPlansSlice.length > 0 ? (
                <div className={listContainerClass}>
                  {myPlansSlice.map((plan) => {
                    const dep = plan.departure_airfield || 'DEP';
                    const arr = plan.destination_airfield || 'ARR';
                    const callsign =
                      plan.callsign && plan.name && plan.callsign !== plan.name
                        ? `${plan.callsign} (${plan.name})`
                        : plan.callsign || plan.name || 'Flight';
                    const afLabel = plan.airframe?.abbreviation || plan.airframe?.name;
                    const wpts = plan.route_summary?.waypoint_count || 0;

                    return (
                      <div
                        key={plan.id || plan.identifier}
                        onClick={() => {
                          setSelectedFlightPlanId(plan.id || plan.identifier);
                          setActiveTab('atc');
                        }}
                        className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                              {plan.identifier || `FP-${plan.id}`}
                            </span>
                            <span className="font-mono font-bold text-xs text-stone-100 group-hover:text-amber-400 transition truncate">
                              {callsign}
                            </span>
                            {afLabel && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-800 text-stone-300 shrink-0">
                                {afLabel}
                              </span>
                            )}
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${
                              plan.is_filed
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-stone-900 text-stone-400 border-stone-700'
                            }`}
                          >
                            {plan.is_filed ? 'FILED' : 'DRAFT'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                          <div className="flex items-center gap-1.5 text-stone-200">
                            <span className="font-bold">{dep}</span>
                            <ArrowRight className="w-3 h-3 text-stone-500" />
                            <span className="font-bold">{arr}</span>
                          </div>
                          <span className="text-stone-400 shrink-0">
                            {wpts} wpts
                            {plan.is_dtc_compatible ? ' • DTC' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
                  No personal or mission-assigned flight plans found.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>{memberFlightPlans.length} total plan(s) assigned</span>
              <button
                onClick={() => setActiveTab('atc')}
                className="text-amber-400 hover:text-amber-300 font-bold"
              >
                Open ATC Workbench &rarr;
              </button>
            </div>
          </>
        );
      }

      case 'dossier_summary': {
        const sq = memberProfile.squadronAssignment;
        const certsCount = memberProfile.certificates?.length || 0;
        const awardsCount = memberProfile.awardsCount ?? memberProfile.awards?.length ?? 0;
        const attendanceRate = memberProfile.serviceRecordStats?.rateFormatted || 'N/A';

        return (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <SquaresFour className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                      Pilot Dossier &amp; Progression
                    </h3>
                    <p className="text-[11px] font-mono text-stone-400">
                      Rank, XP progress &amp; squadron billet
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <span>Full Dossier</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div
                className={
                  isWide ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch' : 'space-y-4'
                }
              >
                {/* Rank & XP Progression */}
                <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={memberProfile.gradeIconUrl || currentGradeMeta.iconUrl}
                        alt={memberProfile.gradeTitle}
                        className="w-11 h-11 object-contain shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-100 truncate">
                          {memberProfile.gradeTitle}
                        </div>
                        <div className="text-[11px] font-mono text-amber-400/90">
                          {memberProfile.xp.toLocaleString()} XP
                          {memberProfile.nextGrade
                            ? ` / ${memberProfile.nextGrade.xpRequired.toLocaleString()} XP`
                            : ' (Max Grade)'}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                      {memberProfile.grade}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                        style={{ width: `${xpProgressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
                      <span>
                        {memberProfile.nextGrade
                          ? `Next: ${memberProfile.nextGrade.grade}`
                          : 'Senior Grade Reached'}
                      </span>
                      <span>{xpProgressPercent.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Squadron & Service Metrics */}
                <div className="flex flex-col justify-between gap-2.5">
                  <div className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 flex items-center gap-3">
                    {sq?.emblemUrl ? (
                      <img
                        src={sq.emblemUrl}
                        alt={sq.name}
                        className="w-10 h-10 object-contain shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 shrink-0">
                        <AirplaneTilt className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-100 truncate">
                        {sq ? `${sq.code} — ${sq.name}` : 'Unassigned Billet'}
                      </div>
                      <div className="text-[11px] font-mono text-stone-400 truncate">
                        {sq ? `${sq.nickname} • ${sq.role}` : memberProfile.position}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                      <div className="text-[9px] font-mono uppercase text-stone-500">Served</div>
                      <div className="text-xs font-mono font-bold text-stone-200 mt-0.5">
                        {memberProfile.timeServedLabel || '—'}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                      <div className="text-[9px] font-mono uppercase text-stone-500">Certs</div>
                      <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                        {certsCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                      <div className="text-[9px] font-mono uppercase text-stone-500">Awards</div>
                      <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                        {awardsCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-950/60 border border-stone-800/80 text-center">
                      <div className="text-[9px] font-mono uppercase text-stone-500">Attend</div>
                      <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                        {attendanceRate}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>{memberProfile.rosterTier} Roster Member</span>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="text-amber-400 hover:text-amber-300 font-bold"
              >
                Open Dossier &rarr;
              </button>
            </div>
          </>
        );
      }

      case 'tracked_qualifications': {
        const trackedSlice = trackedCourses.slice(0, maxListCount);
        const completedCheckpoints = settings.completedQualificationCheckpoints || {};

        return (
          <>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                      Training Queue &amp; Certifications
                    </h3>
                    <p className="text-[11px] font-mono text-stone-400">
                      Tracked LMS courses &amp; earned quals
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('qualifications_zone')}
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                >
                  <span>Quals Zone</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {trackedSlice.length > 0 ? (
                <div className={listContainerClass}>
                  {trackedSlice.map((course) => {
                    const totalReq = course.requirements?.length || 0;
                    const doneReq = (course.requirements || []).reduce((acc, _, idx) => {
                      return completedCheckpoints[`${course.id}_${idx}`] ? acc + 1 : acc;
                    }, 0);
                    const pct = totalReq > 0 ? Math.round((doneReq / totalReq) * 100) : 0;

                    return (
                      <div
                        key={course.id}
                        onClick={() => setActiveTab('qualifications_zone')}
                        className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-emerald-500/40 transition-all cursor-pointer group space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                              {course.code}
                            </span>
                            <span className="font-bold text-xs text-stone-100 group-hover:text-emerald-300 transition truncate">
                              {course.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-400 shrink-0">
                            {doneReq}/{totalReq} checks
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold shrink-0">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 py-7 px-4 text-center space-y-2">
                  <Certificate className="w-7 h-7 text-stone-600 mx-auto" />
                  <p className="text-xs font-mono text-stone-400">
                    No courses currently tracked in your training queue.
                  </p>
                  <button
                    onClick={() => setActiveTab('qualifications_zone')}
                    className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <span>Browse Qualifications Zone</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>{issuedCertCount} issued certification(s)</span>
              <button
                onClick={() => setActiveTab('qualifications')}
                className="text-emerald-400 hover:text-emerald-300 font-bold"
              >
                My Certifications &rarr;
              </button>
            </div>
          </>
        );
      }

      case 'qualified_airframes': {
        const airframesSlice = (memberProfile.qualifiedAirframes || []).slice(
          0,
          isWide ? 6 : 4
        );

        return (
          <>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <AirplaneTilt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm sm:text-base">
                      Qualified Airframes
                    </h3>
                    <p className="text-[11px] font-mono text-stone-400">
                      Cleared fleet &amp; flight roles
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('airframes')}
                  className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
                >
                  <span>View Fleet</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {airframesSlice.length > 0 ? (
                <div className={listContainerClass}>
                  {airframesSlice.map((af) => (
                    <div
                      key={af.id || af.name}
                      onClick={() => setActiveTab('airframes')}
                      className="p-3 rounded-2xl bg-stone-950/60 border border-stone-800/80 hover:border-sky-500/40 transition-all cursor-pointer group flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {af.imageUrl ? (
                          <img
                            src={af.imageUrl}
                            alt={af.name}
                            className="w-10 h-10 rounded-xl object-cover bg-stone-900 border border-stone-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-sky-400 shrink-0">
                            <AirplaneTilt className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-stone-100 group-hover:text-sky-400 transition truncate">
                              {af.name}
                            </span>
                            {af.isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-stone-400 truncate">
                            {af.roleLabel || af.role || 'Pilot'}
                            {af.squadron ? ` • ${af.squadron}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {af.isInstructor && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            IP
                          </span>
                        )}
                        {af.isCrew && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-stone-800 text-stone-300">
                            CREW
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 py-8 text-center text-xs font-mono text-stone-500">
                  No qualified airframes recorded yet.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
              <span>
                {(memberProfile.qualifiedAirframes || []).length} qualified platform(s)
              </span>
              <button
                onClick={() => setActiveTab('airframes')}
                className="text-sky-400 hover:text-sky-300 font-bold"
              >
                Inspect Type Ratings &rarr;
              </button>
            </div>
          </>
        );
      }
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-7xl mx-auto">
      {/* WELCOME BACK & HERO SPOTLIGHT BANNER */}
      <div className="relative rounded-3xl overflow-hidden border border-stone-800 bg-stone-950 shadow-2xl min-h-[320px] sm:min-h-[360px] flex flex-col justify-between group">
        {/* Background Hero Image (if available) with smooth transition */}
        {currentHero ? (
          <>
            <img
              key={currentHero.id}
              src={currentHero.image_url}
              alt={currentHero.title}
              className="absolute inset-0 w-full h-full object-cover object-center transition-all duration-700 ease-out"
            />
            {/* Gradients ensuring perfect text contrast & cinematic depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/40 via-stone-950/70 to-stone-950/30 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-stone-950/70 pointer-events-none" />
          </>
        ) : (
          <>
            {/* Ambient glows when no hero image is present */}
            <div className="absolute -top-32 -left-28 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-28 w-[450px] h-[450px] rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
          </>
        )}

        {/* Top Section: Always shows "Welcome back" & Member Profile Grade */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-stone-100 tracking-tight leading-tight drop-shadow-md">
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                {memberProfile.callsign || 'Pilot'}
              </span>
            </h1>
          </div>

          {/* Member Grade Insignia Badge */}
          <div className="flex items-center gap-3.5 bg-stone-950/70 border border-stone-800/80 rounded-2xl px-4 py-2.5 shrink-0 backdrop-blur-md self-start lg:self-center shadow-lg">
            <img
              src={memberProfile.gradeIconUrl || currentGradeMeta.iconUrl}
              alt={memberProfile.gradeTitle}
              className="size-14 sm:size-16 object-contain drop-shadow-xl"
            />
            <div>
              <div className="text-sm sm:text-base font-bold text-stone-100">
                {memberProfile.gradeTitle}
              </div>
              <div className="text-[11px] text-amber-400/90 font-mono font-medium">
                {memberProfile.rosterTier
                  ? `${memberProfile.rosterTier} Roster`
                  : 'Taskforce Member'}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Discreet, tasteful Hero Photo Credit Bar (if hero image present) */}
        {currentHero && (
          <div className="relative z-10 p-4 sm:p-6 pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 bg-stone-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-800/80 shadow-lg text-xs">
              <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                <Camera className="w-3.5 h-3.5" />
                Spotlight
              </span>
              {currentHero.caption && (
                <>
                  <span className="text-stone-600 hidden md:inline">•</span>
                  <span className="text-stone-400 hidden md:inline text-[11px] max-w-xs truncate">
                    {currentHero.caption}
                  </span>
                </>
              )}
              <span className="text-stone-600">•</span>
              <span className="text-stone-400 text-[11px]">
                Shot by{' '}
                <strong className="text-amber-300 font-semibold">{currentHero.credit}</strong>
              </span>
            </div>

            {/* Slide Navigation Dots & Arrows (if multiple hero images) */}
            {heroImages.length > 1 && (
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <div className="flex items-center gap-1 bg-stone-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-stone-800/80 shadow-lg">
                  {heroImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        activeSlide === idx
                          ? 'w-5 bg-amber-400'
                          : 'w-1.5 bg-stone-600 hover:bg-stone-400'
                      }`}
                      title={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setActiveSlide(
                        (prev) => (prev - 1 + heroImages.length) % heroImages.length
                      )
                    }
                    className="w-7 h-7 rounded-full bg-stone-950/80 hover:bg-stone-900 text-stone-300 border border-stone-800/80 flex items-center justify-center transition backdrop-blur-md shadow-lg"
                    title="Previous Slide"
                  >
                    <CaretLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSlide((prev) => (prev + 1) % heroImages.length)}
                    className="w-7 h-7 rounded-full bg-stone-950/80 hover:bg-stone-900 text-stone-300 border border-stone-800/80 flex items-center justify-center transition backdrop-blur-md shadow-lg"
                    title="Next Slide"
                  >
                    <CaretRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PENDING ONBOARDING ACTION NOTIFICATION (If incomplete) */}
      {!checklistSummary.allComplete && (
        <div
          onClick={() => setActiveTab('checklist')}
          className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-stone-900/95 to-stone-900/90 border border-amber-500/40 shadow-xl hover:border-amber-400 cursor-pointer transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-md shadow-amber-500/10">
              <ListChecks className="w-5 h-5 text-amber-400" />
            </div>

            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-bold text-stone-100 text-sm sm:text-base">
                  Member Readiness: Action Required
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                  {checklistSummary.pendingCount} Item
                  {checklistSummary.pendingCount === 1 ? '' : 's'} Pending
                </span>
              </div>
              <p className="text-xs text-stone-300">
                You have {checklistSummary.pendingCount} incomplete onboarding step
                {checklistSummary.pendingCount === 1 ? '' : 's'}. Review required flight mods,
                liveries, DCS callsign tag, and bot linkage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('checklist');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 group-hover:translate-x-0.5"
            >
              <span>View Checklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* HOME PAGE CUSTOMIZATION BAR & DRAWER */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-stone-400">
              Operations Brief
            </span>
            <span className="px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-400">
              {enabledWidgets.length} active widget{enabledWidgets.length === 1 ? '' : 's'}
            </span>
            {isSyncingHomeLayout && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                <ArrowsClockwise className="w-3 h-3 animate-spin" />
                <span>Syncing layout...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isCustomizing ? (
              <>
                <button
                  type="button"
                  onClick={resetHomeLayout}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizing(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
                >
                  <Check weight="bold" className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Customize Home</span>
              </button>
            )}
          </div>
        </div>

        {/* Customize Home Drawer */}
        {isCustomizing && (
          <div className="p-5 rounded-3xl bg-stone-900/95 border border-amber-500/30 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-800">
              <div>
                <h2 className="font-display font-bold text-sm sm:text-base text-stone-100">
                  Customize Home Widgets
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Toggle widgets on or off, drag cards or use arrows to reorder, and adjust column widths.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-400 shrink-0 self-start sm:self-center">
                {isSyncingHomeLayout ? (
                  <>
                    <ArrowsClockwise className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span className="text-amber-300">Syncing to profile...</span>
                  </>
                ) : (
                  <>
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved to profile &amp; local cache</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {HOME_WIDGET_CATALOG.map((entry) => {
                const stateItem = orderedWidgets.find((w) => w.id === entry.id);
                const isEnabled = stateItem?.enabled ?? entry.defaultEnabled;
                const colSpan = stateItem?.colSpan ?? entry.defaultColSpan;
                const widthLabel =
                  COL_SPAN_OPTIONS.find((opt) => opt.span === colSpan)?.label || '1/2';

                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isEnabled
                        ? 'bg-stone-950/90 border-amber-500/40'
                        : 'bg-stone-950/50 border-stone-800/80'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0">
                            {getWidgetIcon(entry.id)}
                          </div>
                          <span className="font-display font-bold text-xs text-stone-100 truncate">
                            {entry.title}
                          </span>
                        </div>
                        {isEnabled && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-amber-300 shrink-0">
                            {widthLabel} width
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed">
                        {entry.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleWidget(entry.id)}
                      className={`w-full py-1.5 px-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isEnabled
                          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                          : 'bg-stone-900 hover:bg-amber-500/15 border-stone-700 hover:border-amber-500/40 text-stone-300 hover:text-amber-300'
                      }`}
                    >
                      {isEnabled ? (
                        <>
                          <Check weight="bold" className="w-3.5 h-3.5" />
                          <span>Active on Home</span>
                        </>
                      ) : (
                        <>
                          <Plus weight="bold" className="w-3.5 h-3.5" />
                          <span>Add to Home</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CUSTOMIZABLE 12-COLUMN WIDGET GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {enabledWidgets.length === 0 ? (
            <div className="lg:col-span-12 p-10 rounded-3xl bg-stone-900/80 border border-dashed border-stone-700 text-center space-y-3">
              <SquaresFour className="w-10 h-10 text-stone-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display font-bold text-stone-200 text-base">
                  No widgets enabled on your Home page
                </h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">
                  Enable widgets from the customization drawer or reset back to the default layout.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomizing(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Customize Widgets</span>
                </button>
                <button
                  type="button"
                  onClick={resetHomeLayout}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs flex items-center gap-1.5"
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
              </div>
            </div>
          ) : (
            enabledWidgets.map((widget, idx) => {
              const meta = catalogById.get(widget.id);
              const isDragTarget =
                isCustomizing && dragOverWidgetId === widget.id && draggedWidgetId !== widget.id;

              return (
                <div
                  key={widget.id}
                  data-home-widget-id={widget.id}
                  onDragStart={(e) => {
                    if (isCustomizing) e.preventDefault();
                  }}
                  onPointerDown={(e) => handleWidgetPointerDown(e, widget.id)}
                  className={`${COL_SPAN_CLASS[widget.colSpan]} p-5 rounded-3xl bg-stone-900/90 border shadow-xl flex flex-col justify-between transition-all ${
                    isCustomizing ? 'select-none cursor-grab active:cursor-grabbing' : ''
                  } ${
                    isDragTarget
                      ? 'border-amber-400 ring-2 ring-amber-400/60 scale-[1.01]'
                      : isCustomizing
                      ? 'border-amber-500/30 ring-1 ring-amber-500/15'
                      : 'border-stone-800'
                  } ${draggedWidgetId === widget.id ? 'opacity-60' : ''}`}
                >
                  {isCustomizing && (
                    <div className="mb-4 pb-2.5 border-b border-stone-800/90 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300">
                        <span
                          data-widget-drag-handle="true"
                          className="p-1 rounded bg-stone-950 border border-stone-800 cursor-grab active:cursor-grabbing text-stone-400 hover:text-amber-300"
                          title="Drag to reorder"
                        >
                          <DotsSixVertical className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-semibold truncate max-w-[140px]">
                          {meta?.title || widget.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Move Left / Right */}
                        <div className="flex items-center bg-stone-950 rounded-lg border border-stone-800 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveWidget(widget.id, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
                            title="Move earlier"
                            aria-label="Move earlier"
                          >
                            <CaretLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveWidget(widget.id, 1)}
                            disabled={idx === enabledWidgets.length - 1}
                            className="p-1 rounded text-stone-400 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
                            title="Move later"
                            aria-label="Move later"
                          >
                            <CaretRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Column Width Selector */}
                        <div
                          className="flex items-center bg-stone-950 rounded-lg border border-stone-800 p-0.5 text-[10px] font-mono"
                          title="Adjust widget width"
                        >
                          {COL_SPAN_OPTIONS.map((opt) => (
                            <button
                              key={opt.span}
                              type="button"
                              onClick={() => handleSetColSpan(widget.id, opt.span)}
                              className={`px-1.5 py-0.5 rounded transition-colors ${
                                widget.colSpan === opt.span
                                  ? 'bg-amber-500 text-stone-950 font-bold'
                                  : 'text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Hide Widget */}
                        <button
                          type="button"
                          onClick={() => handleToggleWidget(widget.id)}
                          className="p-1.5 rounded-lg bg-stone-950 hover:bg-rose-950/40 border border-stone-800 hover:border-rose-500/40 text-stone-400 hover:text-rose-300 transition-colors"
                          title="Hide widget from Home"
                          aria-label="Hide widget from Home"
                        >
                          <EyeSlash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={draggedWidgetId ? 'pointer-events-none select-none' : ''}>
                    {renderWidgetBody(widget)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isCustomizing && draggedWidgetId && dragPointer && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-950/95 border border-amber-400/70 shadow-2xl shadow-black/60 backdrop-blur-md text-xs font-mono text-stone-100"
          style={{
            left: dragPointer.x + 14,
            top: dragPointer.y + 14,
          }}
        >
          {getWidgetIcon(draggedWidgetId)}
          <span className="font-semibold text-amber-300">
            {catalogById.get(draggedWidgetId)?.title || draggedWidgetId}
          </span>
          {dragOverWidgetId && dragOverWidgetId !== draggedWidgetId && (
            <span className="text-stone-400">
              &rarr; {catalogById.get(dragOverWidgetId)?.title || dragOverWidgetId}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
