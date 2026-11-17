import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarBlank,
  Camera,
  CaretLeft,
  CaretRight,
  Compass,
  ListChecks,
  ShieldCheck,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { GTFO_GRADE_META } from '../data/portalData';
import { fetchCalendarEvents } from '../services/calendarService';
import { fetchHeroImages, HeroImageItem } from '../services/heroService';
import { CalendarEventItem } from '../types';

export const HomeView: React.FC = () => {
  const {
    memberProfile,
    setActiveTab,
    checklistSummary,
    filedFlightPlans,
    upcomingCalendarEvents,
    setSelectedCalendarEventUid,
    setSelectedFlightPlanId,
    userSession,
  } = useApp();

  // Hero gallery images
  const [heroImages, setHeroImages] = useState<HeroImageItem[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

  // Upcoming calendar events
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

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
          .slice(0, 4);
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
      ? upcomingCalendarEvents.slice(0, 4)
      : [];

  const currentHero = heroImages.length > 0 ? heroImages[activeSlide] : null;

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
              <div className="text-sm sm:text-base font-bold text-stone-100">{memberProfile.gradeTitle}</div>
              <div className="text-[11px] text-amber-400/90 font-mono font-medium">
                {memberProfile.rosterTier ? `${memberProfile.rosterTier} Roster` : 'Taskforce Member'}
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
              {/* <span className="text-stone-600">•</span>
              <span className="font-semibold text-stone-200">{currentHero.title}</span> */}
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
                Shot by <strong className="text-amber-300 font-semibold">{currentHero.credit}</strong>
              </span>
              {/* {currentHero.theatre && (
                <span className="px-2 py-0.5 rounded-full bg-stone-900/90 text-stone-300 font-mono text-[10px] border border-stone-700/60">
                  {currentHero.theatre}
                </span>
              )} */}
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
                        activeSlide === idx ? 'w-5 bg-amber-400' : 'w-1.5 bg-stone-600 hover:bg-stone-400'
                      }`}
                      title={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setActiveSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length)
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
                  {checklistSummary.pendingCount} Item{checklistSummary.pendingCount === 1 ? '' : 's'} Pending
                </span>
              </div>
              <p className="text-xs text-stone-300">
                You have {checklistSummary.pendingCount} incomplete onboarding step{checklistSummary.pendingCount === 1 ? '' : 's'}. Review required flight mods, liveries, DCS callsign tag, and bot linkage.
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

      {/* OPERATIONS & RECENT PLANS OVERVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UPCOMING SORTIES & TRAINING EVENTS */}
        <div className="p-5 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl flex flex-col justify-between">
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
                  <p className="text-[11px] font-mono text-stone-400">Scheduled taskforce events</p>
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

            <div className="mt-4 space-y-2.5">
              {displayedEvents.length > 0 ? (
                displayedEvents.map((ev) => {
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
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              ev.type === 'campaign'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {ev.category_badge || (ev.type === 'campaign' ? 'OP' : 'TRG')}
                          </span>
                          <span className="font-bold text-xs text-stone-100 group-hover:text-amber-400 transition truncate max-w-[200px] sm:max-w-[280px]">
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
                        <span className="truncate">{ev.subtitle || ev.theatre || 'Global Task Force'}</span>
                        <span className="text-amber-300/90 font-semibold shrink-0">{dateStr}</span>
                      </div>
                    </div>
                  );
                })
              ) : eventsLoading ? (
                <div className="py-8 text-center text-xs font-mono text-stone-500">
                  Loading upcoming sorties...
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-stone-500">
                  No upcoming sorties scheduled right now.
                </div>
              )}
            </div>
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
        </div>

        {/* RECENTLY FILED FLIGHT PLANS */}
        <div className="p-5 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl flex flex-col justify-between">
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
                  <p className="text-[11px] font-mono text-stone-400">Active ATC route clearances</p>
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

            <div className="mt-4 space-y-2.5">
              {filedFlightPlans.length > 0 ? (
                filedFlightPlans.slice(0, 4).map((plan) => {
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
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            {plan.identifier || `FP-${plan.id}`}
                          </span>
                          <span className="font-mono font-bold text-xs text-stone-100 group-hover:text-sky-400 transition">
                            {callsign}
                          </span>
                          {afLabel && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-800 text-stone-300">
                              {afLabel}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-stone-400 shrink-0">
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
                })
              ) : (
                <div className="py-8 text-center text-xs font-mono text-stone-500">
                  No filed flight plans on active frequency.
                </div>
              )}
            </div>
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
        </div>
      </div>
    </div>
  );
};
