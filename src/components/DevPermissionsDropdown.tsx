import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  CaretDown,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { CampaignMapPermissions, UserTier } from '../types';
import { DEV_MAP_PERMISSION_GROUPS, DEV_PERMISSION_PRESETS } from '../utils/devPermissions';

const TIER_OPTIONS: Array<{ value: 'default' | UserTier; label: string }> = [
  { value: 'default', label: 'Live' },
  { value: 'guest', label: 'Guest' },
  { value: 'community', label: 'Community' },
  { value: 'core', label: 'CORE' },
];

export const DevPermissionsDropdown: React.FC = () => {
  if (!import.meta.env.DEV) {
    return null;
  }

  const {
    liveEffectiveTier,
    effectiveTier,
    devPermissionOverrides,
    setDevPermissionOverrides,
    resetDevPermissionOverrides,
    liveMapPermissions,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activePreset = DEV_PERMISSION_PRESETS.find((p) => p.id === devPermissionOverrides.presetId);
  const triggerLabel = !devPermissionOverrides.enabled
    ? 'DEV: LIVE'
    : `DEV: ${activePreset ? activePreset.label : 'Custom'}`;

  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'default') {
      resetDevPermissionOverrides();
      return;
    }
    const preset = DEV_PERMISSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDevPermissionOverrides({
      enabled: true,
      presetId: preset.id,
      tierOverride: preset.tierOverride,
      mapPermissions: { ...preset.mapPermissions },
      forceRecordsReadOnly: preset.forceRecordsReadOnly,
    });
  };

  const handleSelectTier = (nextTier: 'default' | UserTier) => {
    const hasOtherOverrides =
      Object.keys(devPermissionOverrides.mapPermissions).length > 0 ||
      devPermissionOverrides.forceRecordsReadOnly;

    if (nextTier === 'default' && !hasOtherOverrides) {
      resetDevPermissionOverrides();
      return;
    }
    setDevPermissionOverrides({
      ...devPermissionOverrides,
      enabled: true,
      presetId: 'custom',
      tierOverride: nextTier,
    });
  };

  const handleToggleMapPerm = (key: keyof CampaignMapPermissions, currentEffectiveVal: boolean) => {
    setDevPermissionOverrides({
      ...devPermissionOverrides,
      enabled: true,
      presetId: 'custom',
      mapPermissions: {
        ...devPermissionOverrides.mapPermissions,
        [key]: !currentEffectiveVal,
      },
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        title="Dev Permission Switcher (Development Mode Only)"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`h-8 px-2.5 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          devPermissionOverrides.enabled
            ? 'bg-violet-500/20 hover:bg-violet-500/30 border-violet-500/70 text-violet-200 shadow-lg shadow-violet-950/40'
            : 'bg-stone-900/90 hover:bg-stone-800 border-stone-700/90 text-stone-300 hover:text-stone-100'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            devPermissionOverrides.enabled ? 'bg-violet-400 animate-pulse' : 'bg-emerald-400'
          }`}
        />
        <span className="truncate max-w-[160px]">{triggerLabel}</span>
        <CaretDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Dev Permission Switcher"
          className="absolute right-0 top-full mt-2 w-[400px] max-w-[92vw] max-h-[82vh] flex flex-col rounded-2xl border border-stone-700/90 bg-stone-950/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-stone-800 bg-stone-900/90 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <SlidersHorizontal className="w-4 h-4 text-violet-400 shrink-0" weight="duotone" />
              <span className="text-xs font-display font-bold text-stone-100 truncate">
                Dev Permission Switcher
              </span>
              <span className="px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/35 text-[9px] font-mono font-bold text-violet-300 uppercase shrink-0">
                DEV ONLY
              </span>
            </div>

            <button
              type="button"
              onClick={resetDevPermissionOverrides}
              disabled={!devPermissionOverrides.enabled}
              className="px-2 py-1 rounded-lg bg-stone-950 hover:bg-emerald-500/15 border border-stone-700 hover:border-emerald-500/50 text-[10px] font-mono font-bold text-emerald-300 disabled:opacity-40 flex items-center gap-1 transition-colors shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowCounterClockwise className="w-3 h-3" />
              <span>Default (Live)</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-3.5 space-y-4 overflow-y-auto flex-1">
            {/* Role Presets */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                Role Presets
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEV_PERMISSION_PRESETS.map((preset) => {
                  const isActive =
                    preset.id === 'default'
                      ? !devPermissionOverrides.enabled
                      : devPermissionOverrides.enabled &&
                        devPermissionOverrides.presetId === preset.id;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      title={preset.description}
                      className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? preset.id === 'default'
                            ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                            : 'bg-violet-500/20 border-violet-500/70 text-violet-200'
                          : 'bg-stone-900/70 border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100'
                      }`}
                    >
                      <div className="text-[11px] font-mono font-bold truncate">{preset.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* App Membership Tier */}
            <div className="space-y-2 pt-2 border-t border-stone-800/80">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-bold uppercase tracking-wider text-stone-400">
                  App Membership Tier
                </span>
                <span className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                  Live: <strong className="text-emerald-300 uppercase">{liveEffectiveTier}</strong>
                  {effectiveTier !== liveEffectiveTier && (
                    <span className="text-violet-300 ml-1.5">
                      → <strong className="uppercase">{effectiveTier}</strong>
                    </span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
                {TIER_OPTIONS.map((opt) => {
                  const activeTierVal = devPermissionOverrides.enabled
                    ? devPermissionOverrides.tierOverride
                    : 'default';
                  const isActive = activeTierVal === opt.value;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectTier(opt.value)}
                      className={`py-1 px-2 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? opt.value === 'default'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-violet-500/25 text-violet-200 border border-violet-500/60'
                          : 'text-stone-400 hover:text-stone-200 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Record Ownership Simulation */}
            <div className="space-y-2 pt-2 border-t border-stone-800/80">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                Record Ownership
              </div>
              <button
                type="button"
                onClick={() =>
                  setDevPermissionOverrides({
                    ...devPermissionOverrides,
                    enabled: true,
                    presetId: 'custom',
                    forceRecordsReadOnly: !devPermissionOverrides.forceRecordsReadOnly,
                  })
                }
                className="w-full p-2.5 rounded-xl bg-stone-900/70 hover:bg-stone-900 border border-stone-800 flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-left min-w-0">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" weight="duotone" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-200 truncate">
                      Simulate Others&apos; Records Read-Only
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 truncate">
                      Forces can_edit = false on plans &amp; markings
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
                    devPermissionOverrides.enabled && devPermissionOverrides.forceRecordsReadOnly
                      ? 'bg-violet-500/25 border-violet-500/70 text-violet-200'
                      : 'bg-stone-950 border-stone-700 text-stone-400'
                  }`}
                >
                  {devPermissionOverrides.enabled && devPermissionOverrides.forceRecordsReadOnly
                    ? 'ON'
                    : 'OFF'}
                </span>
              </button>
            </div>

            {/* Campaign Map Permissions */}
            <div className="space-y-3 pt-2 border-t border-stone-800/80">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" weight="duotone" />
                  <span>Campaign Map Permissions</span>
                </span>
                {!liveMapPermissions && (
                  <span className="text-stone-500 italic">Open Map for live values</span>
                )}
              </div>

              {DEV_MAP_PERMISSION_GROUPS.map((group) => (
                <div key={group.groupLabel} className="space-y-1.5">
                  <div className="text-[10px] font-mono font-semibold text-stone-500 uppercase">
                    {group.groupLabel}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const liveVal = liveMapPermissions
                        ? Boolean(liveMapPermissions[item.key])
                        : undefined;
                      const overrideVal = devPermissionOverrides.enabled
                        ? devPermissionOverrides.mapPermissions[item.key]
                        : undefined;
                      const effectiveVal =
                        overrideVal !== undefined ? Boolean(overrideVal) : Boolean(liveVal);
                      const isOverridden =
                        overrideVal !== undefined &&
                        (liveVal === undefined || overrideVal !== liveVal);

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleToggleMapPerm(item.key, effectiveVal)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-stone-200 truncate">
                              {item.label}
                            </span>
                            {isOverridden && (
                              <span className="px-1 py-0.2 rounded bg-violet-500/20 border border-violet-500/50 text-[9px] font-mono font-bold text-violet-300 shrink-0">
                                OVR
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {liveVal !== undefined && (
                              <span className="text-[9px] font-mono text-stone-500">
                                Live:{liveVal ? 'ON' : 'OFF'}
                              </span>
                            )}
                            <span
                              className={`w-10 text-center py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                effectiveVal
                                  ? isOverridden
                                    ? 'bg-violet-500/25 border-violet-500/70 text-violet-200'
                                    : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                  : isOverridden
                                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                                    : 'bg-stone-950 border-stone-800 text-stone-500'
                              }`}
                            >
                              {effectiveVal ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3.5 py-2 border-t border-stone-800 bg-stone-900/80 text-[10px] font-mono text-stone-400 leading-snug shrink-0">
            Frontend overrides preview UI gating only; API writes still authorize against your server
            account.
          </div>
        </div>
      )}
    </div>
  );
};
