import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsClockwise,
  Camera,
  CaretLeft,
  CaretRight,
  Check,
  CloudCheck,
  DotsSixVertical,
  EyeSlash,
  ListChecks,
  Plus,
  SlidersHorizontal,
  SquaresFour,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { GTFO_GRADE_META } from '../data/portalData';
import { fetchHeroImages, HeroImageItem } from '../services/heroService';
import { HOME_WIDGET_CATALOG } from '../services/homeLayoutService';
import { HomeWidgetColSpan, HomeWidgetId, HomeWidgetItem } from '../types';
import { getWidgetIcon, HomeWidgetRenderer } from './widgets';

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

export const HomeView: React.FC = () => {
  const {
    memberProfile,
    setActiveTab,
    checklistSummary,
    userSession,
    homeLayout,
    updateHomeLayout,
    resetHomeLayout,
    isSyncingHomeLayout,
  } = useApp();

  // Hero gallery images
  const [heroImages, setHeroImages] = useState<HeroImageItem[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

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

  const currentGradeMeta = GTFO_GRADE_META[memberProfile.grade] || GTFO_GRADE_META.G1;

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

  return (
    <div className="space-y-8 pb-10 w-full max-w-[2400px] mx-auto">
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
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-100 leading-tight drop-shadow-md">
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
              <div className="text-xs text-amber-400/90 font-medium">
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
              <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] uppercase font-bold tracking-wider">
                <Camera className="w-3.5 h-3.5" />
                Spotlight
              </span>
              {currentHero.caption && (
                <>
                  <span className="text-stone-600 hidden md:inline">•</span>
                  <span className="text-stone-400 hidden md:inline text-xs max-w-xs truncate">
                    {currentHero.caption}
                  </span>
                </>
              )}
              <span className="text-stone-600">•</span>
              <span className="text-stone-400 text-xs">
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
                <span className="font-display font-bold text-stone-100 text-base">
                  Member Readiness: Action Required
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wide border border-amber-500/30 tabular-nums">
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
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 group-hover:translate-x-0.5"
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
            <span className="font-display text-sm font-bold uppercase tracking-wider text-stone-400">
              Operations Brief
            </span>
            <span className="px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-[11px] text-stone-400 tabular-nums">
              {enabledWidgets.length} active widget{enabledWidgets.length === 1 ? '' : 's'}
            </span>
            {isSyncingHomeLayout && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
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
                  className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomizing(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-colors"
                >
                  <Check weight="bold" className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsCustomizing(true)}
                className="px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-all"
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
                <h2 className="font-display font-bold text-base text-stone-100">
                  Customize Home Widgets
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Toggle widgets on or off, drag cards or use arrows to reorder, and adjust column widths.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-400 shrink-0 self-start sm:self-center">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
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
                          <span className="font-display font-bold text-sm text-stone-100 truncate">
                            {entry.title}
                          </span>
                        </div>
                        {isEnabled && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-[11px] font-mono text-amber-300 shrink-0">
                            {widthLabel} width
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        {entry.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleWidget(entry.id)}
                      className={`w-full py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
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
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Customize Widgets</span>
                </button>
                <button
                  type="button"
                  onClick={resetHomeLayout}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5"
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
                      <div className="flex items-center gap-1.5 text-xs text-amber-300">
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
                          className="flex items-center bg-stone-950 rounded-lg border border-stone-800 p-0.5 text-[11px] font-mono"
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
                    <HomeWidgetRenderer widget={widget} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isCustomizing && draggedWidgetId && dragPointer && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-stone-950/95 border border-amber-400/70 shadow-2xl shadow-black/60 backdrop-blur-md text-xs text-stone-100"
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
