import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowsLeftRight,
  Broadcast,
  MagnifyingGlass,
  Path,
  PencilSimple,
  Ruler,
  Warning,
} from '@phosphor-icons/react';
import { CampaignMapFlightPlanBrief, CampaignMapPermissions } from '../../../types';

export type MapToolKey =
  | 'flight'
  | 'threats'
  | 'support'
  | 'markings'
  | 'isr'
  | 'measure'
  | 'converter';

interface CampaignMapToolbarProps {
  allPlans: CampaignMapFlightPlanBrief[];
  permissions: CampaignMapPermissions;
  openWindows: Record<MapToolKey, boolean>;
  onToggleWindow: (tool: MapToolKey) => void;
  onSelectSearchPlan: (planId: number) => void;
}

/**
 * Replicates `partials/map-toolbar.blade.php` with expandable left-attached flight plan search
 * input, autocomplete dropdown, and portal permission-gated tool buttons.
 */
export const CampaignMapToolbar: React.FC<CampaignMapToolbarProps> = ({
  allPlans,
  permissions,
  openWindows,
  onToggleWindow,
  onSelectSearchPlan,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return allPlans.slice(0, 8);
    }
    return allPlans
      .filter(
        (p) =>
          (p.identifier && p.identifier.toLowerCase().includes(q)) ||
          (p.callsign && p.callsign.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.creator_name && p.creator_name.toLowerCase().includes(q)) ||
          (p.airframe_name && p.airframe_name.toLowerCase().includes(q)) ||
          (p.airframe_abbr && p.airframe_abbr.toLowerCase().includes(q)) ||
          (p.mission_name && p.mission_name.toLowerCase().includes(q)) ||
          String(p.id).includes(q)
      )
      .slice(0, 10);
  }, [allPlans, searchQuery]);

  const handlePick = (planId: number) => {
    onSelectSearchPlan(planId);
    setSearchQuery('');
    setSearchFocused(false);
    inputRef.current?.blur();
  };

  const isExpanded = searchFocused || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Expandable Search Box Attached to Flight Planner */}
      <div className="relative flex items-stretch">
        <div className="relative flex items-center h-9">
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            title="Search Flight Plans"
            className="absolute inset-y-0 left-0 w-9 flex items-center justify-center text-stone-400 hover:text-amber-300 cursor-pointer z-10"
          >
            <MagnifyingGlass className="w-4 h-4" weight="duotone" />
          </button>
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                setSearchFocused(false);
                inputRef.current?.blur();
              } else if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault();
                handlePick(searchResults[0].flight_plan_id || searchResults[0].id);
              }
            }}
            placeholder={isExpanded ? 'Search plans (FP-XXXXX, callsign, pilot)...' : ''}
            className={`h-9 ${
              isExpanded ? 'w-60 pr-2.5' : 'w-9 pr-0 cursor-pointer'
            } pl-9 text-xs bg-stone-900/90 text-stone-200 border border-r-0 border-stone-700 rounded-l-lg focus:outline-none focus:border-stone-500 transition-all duration-200 placeholder:text-stone-500 backdrop-blur-md`}
          />
        </div>

        <button
          type="button"
          onClick={() => onToggleWindow('flight')}
          title="Flight Planner (Alt + F)"
          className={`h-9 px-3 rounded-r-lg rounded-l-none border border-l-0 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
            openWindows.flight
              ? 'bg-sky-600/25 border-sky-500/80 text-sky-200'
              : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
          }`}
        >
          <Path className="w-4 h-4 text-sky-400" weight="duotone" />
          <span>Flight Planner</span>
        </button>

        {searchFocused && (
          <div className="absolute top-full left-0 mt-1 w-84 max-h-72 overflow-y-auto bg-stone-900 border border-stone-700 rounded-lg shadow-2xl z-[1200] p-1 divide-y divide-stone-800">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span>
                {searchQuery.trim()
                  ? `Matching Flight Plans (${searchResults.length})`
                  : `Campaign Flight Plans (${allPlans.length})`}
              </span>
            </div>
            {searchResults.length === 0 ? (
              <div className="p-3 text-xs text-stone-400 italic text-center">
                {allPlans.length === 0
                  ? 'No flight plans in this campaign yet.'
                  : `No flight plans match '${searchQuery}'`}
              </div>
            ) : (
              searchResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePick(p.flight_plan_id || p.id);
                  }}
                  className="w-full text-left p-2 hover:bg-stone-800 rounded transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-stone-950 text-stone-300 border border-stone-700">
                        {p.identifier}
                      </span>
                      <span className="text-xs font-bold text-stone-200 group-hover:text-white truncate">
                        {p.callsign || p.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 truncate">
                      {[p.creator_name && `By ${p.creator_name}`, p.airframe_name, p.mission_name]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Threats */}
      {permissions.canManageThreats && (
        <button
          type="button"
          onClick={() => onToggleWindow('threats')}
          title="Threat Planner"
          className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
            openWindows.threats
              ? 'bg-red-600/25 border-red-500/80 text-red-200'
              : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
          }`}
        >
          <Warning className="w-4 h-4 text-red-400" />
          <span>Threats</span>
        </button>
      )}

      {/* Support Assets */}
      {permissions.canManageSupportAssets && (
        <button
          type="button"
          onClick={() => onToggleWindow('support')}
          title="Support Assets Planner"
          className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
            openWindows.support
              ? 'bg-sky-600/25 border-sky-500/80 text-sky-200'
              : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
          }`}
        >
          <Broadcast className="w-4 h-4 text-sky-400" weight="duotone" />
          <span>Support Assets</span>
        </button>
      )}

      {/* Markings */}
      <button
        type="button"
        onClick={() => onToggleWindow('markings')}
        title="Tactical Markings"
        className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
          openWindows.markings
            ? 'bg-sky-600/25 border-sky-500/80 text-sky-200'
            : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
        }`}
      >
        <PencilSimple className="w-4 h-4 text-amber-400" weight="duotone" />
        <span>Markings</span>
      </button>

      {/* Ruler / Measure */}
      <button
        type="button"
        onClick={() => onToggleWindow('measure')}
        title="Ruler & Bearing Tool (Alt + M)"
        className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
          openWindows.measure
            ? 'bg-amber-600/25 border-amber-500/80 text-amber-200'
            : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
        }`}
      >
        <Ruler className="w-4 h-4 text-amber-400" weight="duotone" />
        <span>Ruler</span>
      </button>

      {/* Coordinate Converter */}
      <button
        type="button"
        onClick={() => onToggleWindow('converter')}
        title="Coordinate Converter (Alt + C)"
        className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition cursor-pointer ${
          openWindows.converter
            ? 'bg-sky-600/25 border-sky-500/80 text-sky-200'
            : 'bg-stone-900/90 border-stone-700 text-stone-200 hover:bg-stone-800'
        }`}
      >
        <ArrowsLeftRight className="w-4 h-4 text-stone-300" weight="duotone" />
        <span>Converter</span>
      </button>
    </div>
  );
};
