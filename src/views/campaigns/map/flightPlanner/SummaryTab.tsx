import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AirplaneLanding,
  CaretDown,
  Crosshair,
  MagnifyingGlass,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  FlightPlanDetail,
} from '../../../../types';
import { PlannerTabId, computeAutoFlightRules } from './helpers';

interface SummaryTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onSwitchTab: (tab: PlannerTabId) => void;
  onAirframeSelectChange?: (airframeId: number | null) => void;
  onColorChange?: (color: string) => void;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({
  plan,
  mapData,
  canEdit,
  onMutatePlan,
  onSwitchTab,
  onAirframeSelectChange,
  onColorChange,
}) => {
  const [sortieDropdownOpen, setSortieDropdownOpen] = useState(false);
  const [sortieSearch, setSortieSearch] = useState('');
  const sortieRef = useRef<HTMLDivElement | null>(null);
  const sortieSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!sortieDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (sortieRef.current && !sortieRef.current.contains(e.target as Node)) {
        setSortieDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [sortieDropdownOpen]);

  const flattenedSorties = useMemo(() => {
    const list: Array<{
      id: number;
      missionId: number;
      missionName: string;
      label: string;
      searchText: string;
    }> = [];
    (mapData.missions || []).forEach((m) => {
      (m.sorties || []).forEach((s) => {
        const label =
          (s.name || `Sortie ${s.sortie_number}`) +
          (s.scheduled_at ? ` (${s.scheduled_at})` : '');
        list.push({
          id: s.id,
          missionId: m.id,
          missionName: m.name,
          label,
          searchText: `${m.name} ${label}`.toLowerCase(),
        });
      });
    });
    return list;
  }, [mapData.missions]);

  const filteredSortieGroups = useMemo(() => {
    const q = sortieSearch.trim().toLowerCase();
    const filtered = q
      ? flattenedSorties.filter((s) => s.searchText.includes(q))
      : flattenedSorties;
    const groups: Record<string, typeof flattenedSorties> = {};
    filtered.forEach((s) => {
      if (!groups[s.missionName]) groups[s.missionName] = [];
      groups[s.missionName].push(s);
    });
    return groups;
  }, [flattenedSorties, sortieSearch]);

  const selectedSortieLabel = useMemo(() => {
    if (!plan.sortie_id) return '— Standalone Plan (No Sortie) —';
    const found = flattenedSorties.find((s) => Number(s.id) === Number(plan.sortie_id));
    if (found) return `${found.missionName} • ${found.label}`;
    return `Sortie #${plan.sortie_id}`;
  }, [plan.sortie_id, flattenedSorties]);

  const autoRules = useMemo(() => computeAutoFlightRules(plan, mapData), [plan, mapData]);
  const isIfrRules = autoRules === 'IFR' || autoRules === 'LIFR';

  const handleSelectSortie = (sortieId: number | null, missionId?: number) => {
    onMutatePlan((p) => ({
      ...p,
      sortie_id: sortieId,
      mission_id: sortieId ? missionId ?? p.mission_id : null,
    }));
    setSortieDropdownOpen(false);
    setSortieSearch('');
  };

  const diverts = Array.isArray(plan.diverts) ? plan.diverts : [];
  const overhead = plan.overhead_pattern as Record<string, any> | null | undefined;
  const stationLoadoutDisplay =
    typeof plan.loadout === 'string'
      ? plan.loadout
      : plan.formatted_loadout || '';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Callsign / Name */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-stone-400 uppercase">
              Callsign / Flight Plan Name
            </label>
            {plan.identifier && (
              <span
                className="text-[11px] font-mono font-bold text-amber-400 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded"
                title="FP ID is permanent and cannot be changed"
              >
                <span className="text-stone-500">FP ID:</span> {plan.identifier}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {plan.identifier && (
              <span
                className="shrink-0 px-2 py-1.5 rounded border border-stone-800 bg-stone-950 text-amber-400 font-mono text-xs font-bold select-all"
                title="FP ID is permanent"
              >
                {plan.identifier}
              </span>
            )}
            <input
              type="text"
              disabled={!canEdit}
              value={plan.callsign || plan.name || ''}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  callsign: e.target.value,
                  name: e.target.value,
                }))
              }
              placeholder="Optional custom name / callsign (e.g. CHEVY 1-1)"
              className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-100 text-xs py-1.5 px-2.5 font-bold focus:border-amber-400 focus:outline-none disabled:opacity-60"
            />
          </div>
          <p className="text-xs text-stone-400 mt-1">
            FP ID is permanent. You can append or customize the flight plan callsign/name.
          </p>
        </div>

        {/* Airframe */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Airframe
          </label>
          <select
            disabled={!canEdit}
            value={plan.airframe_id ?? ''}
            onChange={(e) => {
              const afId = e.target.value ? Number(e.target.value) : null;
              if (onAirframeSelectChange) {
                onAirframeSelectChange(afId);
              } else {
                const af = mapData.airframesCatalog.find((a) => a.id === afId) || null;
                onMutatePlan((p) => ({
                  ...p,
                  airframe_id: afId,
                  airframe: af
                    ? {
                        id: af.id,
                        name: af.name,
                        abbreviation: af.abbreviation,
                        dcs_entity: af.dcs_entity,
                        is_dtc_compatible: af.is_dtc_compatible,
                      }
                    : null,
                  is_dtc_compatible: Boolean(af?.is_dtc_compatible),
                  is_f18: af?.is_f18,
                  is_f16: af?.is_f16,
                  is_f14: af?.is_f14,
                  is_f14_bu: af?.is_f14_bu,
                  is_jf17: af?.is_jf17,
                  has_cmds: af?.has_cmds,
                  has_mids: af?.has_mids,
                }));
              }
            }}
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          >
            <option value="">— Select Airframe —</option>
            {mapData.airframesCatalog.map((af) => (
              <option key={af.id} value={af.id}>
                {af.abbreviation} — {af.name} {af.is_qualified ? '★' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Faction / Side */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Faction / Side
          </label>
          {mapData.permissions.canManageBothCoalitions ? (
            <select
              disabled={!canEdit}
              value={plan.is_opfor ? 'true' : 'false'}
              onChange={(e) => {
                const isRed = e.target.value === 'true';
                let nextColor = plan.color || '#3b82f6';
                if (isRed && (nextColor === '#3b82f6' || !plan.color)) {
                  nextColor = '#ef4444';
                } else if (!isRed && (nextColor === '#ef4444' || !plan.color)) {
                  nextColor = '#3b82f6';
                }
                onMutatePlan((p) => ({
                  ...p,
                  is_opfor: isRed,
                  color: nextColor,
                }));
                onColorChange?.(nextColor);
              }}
              className={`w-full rounded-md border border-stone-700 bg-stone-900 text-xs py-1.5 px-2 font-semibold focus:border-amber-400 focus:outline-none disabled:opacity-60 ${
                plan.is_opfor ? 'text-red-400' : 'text-sky-400'
              }`}
            >
              <option value="false">🔵 BLUFOR (Friendly)</option>
              <option value="true">🔴 OPFOR (Adversary)</option>
            </select>
          ) : (
            <div className="w-full rounded-md border border-stone-700 bg-stone-950 px-2.5 py-1.5 flex items-center justify-between text-xs min-h-[34px]">
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${plan.is_opfor ? 'bg-red-500' : 'bg-sky-500'}`}
                />
                <span
                  className={`font-bold text-xs ${
                    plan.is_opfor ? 'text-red-400' : 'text-sky-400'
                  }`}
                >
                  {plan.is_opfor ? 'OPFOR' : 'BLUFOR'}
                </span>
              </div>
              <span className="text-[11px] text-stone-500 italic">
                {plan.is_opfor ? 'Adversary' : 'Friendly'}
              </span>
            </div>
          )}
        </div>

        {/* Sortie (Searchable Mission-Grouped Dropdown) */}
        <div className="relative" ref={sortieRef}>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Sortie
          </label>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              const next = !sortieDropdownOpen;
              setSortieDropdownOpen(next);
              setSortieSearch('');
              if (next) {
                window.setTimeout(() => sortieSearchInputRef.current?.focus(), 40);
              }
            }}
            className={`w-full rounded-md border bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 text-left flex items-center justify-between gap-1 transition-colors cursor-pointer min-h-[34px] disabled:opacity-60 ${
              sortieDropdownOpen
                ? 'border-amber-400 ring-1 ring-amber-400'
                : 'border-stone-700 hover:border-stone-600'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <Crosshair className="size-3.5 text-amber-400 shrink-0" weight="duotone" />
              <span
                className={`truncate ${
                  plan.sortie_id ? 'text-stone-100 font-semibold' : 'text-stone-400 italic'
                }`}
              >
                {selectedSortieLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {plan.sortie_id && canEdit && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectSortie(null);
                  }}
                  className="text-stone-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                  title="Clear sortie"
                >
                  <XCircle className="size-3.5" weight="duotone" />
                </span>
              )}
              <CaretDown
                className={`size-3 transition-transform duration-150 ${
                  sortieDropdownOpen ? 'rotate-180 text-amber-400' : 'text-stone-500'
                }`}
                weight="duotone"
              />
            </div>
          </button>

          {sortieDropdownOpen && (
            <div className="absolute z-50 mt-1 w-full min-w-[280px] max-w-[360px] rounded-lg border border-stone-700 bg-stone-950 shadow-2xl shadow-black/80 overflow-hidden">
              <div className="p-2 border-b border-stone-800 bg-stone-900/90 flex items-center gap-1.5">
                <MagnifyingGlass className="size-3.5 text-stone-400 shrink-0 ml-1" />
                <input
                  ref={sortieSearchInputRef}
                  type="text"
                  value={sortieSearch}
                  onChange={(e) => setSortieSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSortieDropdownOpen(false);
                  }}
                  placeholder="Search mission or sortie..."
                  className="w-full bg-transparent border-0 p-0 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                />
                {sortieSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setSortieSearch('');
                      sortieSearchInputRef.current?.focus();
                    }}
                    className="text-stone-500 hover:text-stone-300 p-0.5 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-stone-800/40">
                <button
                  type="button"
                  onClick={() => handleSelectSortie(null)}
                  className={`w-full text-left px-2.5 py-2 text-xs hover:bg-stone-800 transition-colors flex items-center justify-between gap-1 cursor-pointer ${
                    !plan.sortie_id ? 'text-amber-400 font-semibold bg-stone-900/80' : 'text-stone-400 italic'
                  }`}
                >
                  <span>— Standalone Plan (No Sortie) —</span>
                  {!plan.sortie_id && <span className="text-amber-400">✓</span>}
                </button>

                {Object.keys(filteredSortieGroups).length === 0 && sortieSearch && (
                  <div className="p-3 text-center text-xs text-stone-500 italic">
                    No missions or sorties match &ldquo;{sortieSearch}&rdquo;
                  </div>
                )}

                {Object.entries(filteredSortieGroups).map(([missionName, sorties]) => (
                  <div key={missionName} className="py-1">
                    <div className="px-2.5 py-1 text-[11px] uppercase tracking-wider text-amber-500/90 font-bold bg-stone-900/40 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      <span>{missionName}</span>
                    </div>
                    {sorties.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSortie(s.id, s.missionId)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-stone-800 transition-colors flex items-center justify-between gap-1 cursor-pointer ${
                          Number(plan.sortie_id) === s.id
                            ? 'text-sky-300 font-bold bg-sky-950/40'
                            : 'text-stone-300'
                        }`}
                      >
                        <span className="truncate pl-1">{s.label}</span>
                        {Number(plan.sortie_id) === s.id && (
                          <span className="text-sky-400 shrink-0 font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tasking */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Tasking
          </label>
          <select
            disabled={!canEdit}
            value={plan.tasking_id ?? ''}
            onChange={(e) =>
              onMutatePlan((p) => ({
                ...p,
                tasking_id: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          >
            <option value="">— Select Tasking —</option>
            {mapData.taskings.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Flight Rules (Automated) */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1 flex items-center justify-between">
            <span>Flight Rules</span>
            <span className="text-[11px] text-amber-400 font-semibold">AUTO</span>
          </label>
          <div
            className="w-full rounded-md border border-stone-700 bg-stone-950 px-2.5 py-1.5 flex items-center justify-between text-xs cursor-help min-h-[34px]"
            title={`Automatically determined from weather (METAR) and mission time: ${
              isIfrRules
                ? 'IFR (Instrument Rules)'
                : autoRules === 'MVFR'
                  ? 'MVFR (Marginal VFR)'
                  : 'VFR (Visual Rules)'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${
                  isIfrRules ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`font-bold font-mono text-xs ${
                  isIfrRules ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {autoRules}
              </span>
            </div>
            <span className="text-[11px] text-stone-400 truncate ml-1 font-sans">
              {isIfrRules
                ? 'Instrument Rules'
                : autoRules === 'MVFR'
                  ? 'Marginal VFR'
                  : 'Visual Rules'}
            </span>
          </div>
        </div>

        {/* Coordinate Format */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Coordinate Format
          </label>
          <select
            disabled={!canEdit}
            value={plan.coordinate_format || 'LATLON'}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, coordinate_format: e.target.value }))
            }
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          >
            <option value="LATLON">Lat / Lon (Decimal)</option>
            <option value="DDM">DDM (Deg Dec Min)</option>
            <option value="DMS">DMS (Deg Min Sec)</option>
            <option value="MGRS">MGRS</option>
          </select>
        </div>

        {/* Launch Time */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Launch Time
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={plan.launch_time || ''}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, launch_time: e.target.value || null }))
            }
            placeholder="e.g. 14:30 Z"
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Overlay Color */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Overlay Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled={!canEdit}
              value={plan.color || '#3b82f6'}
              onChange={(e) => {
                const c = e.target.value;
                onMutatePlan((p) => ({ ...p, color: c }));
                onColorChange?.(c);
              }}
              className="h-8 w-12 rounded cursor-pointer border border-stone-700 bg-stone-900 p-0.5 shrink-0 disabled:opacity-60"
            />
            <span className="font-mono text-stone-400 text-xs">{plan.color || '#3b82f6'}</span>
          </div>
        </div>

        {/* Home Plate (Departure) */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Home Plate (Launch Base)
          </label>
          <input
            type="text"
            list="fp-summary-airbases"
            disabled={!canEdit}
            value={plan.departure_airfield || ''}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, departure_airfield: e.target.value || null }))
            }
            placeholder="e.g. UGKO (Kutaisi)"
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Final Recovery (Destination) */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Final Recovery (Destination)
          </label>
          <input
            type="text"
            list="fp-summary-airbases"
            disabled={!canEdit}
            value={plan.destination_airfield || ''}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, destination_airfield: e.target.value || null }))
            }
            placeholder="e.g. UGSB (Batumi)"
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
        </div>

        <datalist id="fp-summary-airbases">
          {(mapData.airbases || []).map((ab) => (
            <option key={`${ab.name}-${ab.lat}`} value={ab.name} />
          ))}
        </datalist>

        {/* Recovery Overhead Pattern Indicator */}
        {overhead && (
          <div className="col-span-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/60 text-purple-200 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded bg-purple-900/80 text-purple-300 shrink-0">
                <AirplaneLanding className="size-3.5" weight="duotone" />
              </span>
              <div className="truncate">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-stone-300">Recovery Pattern:</span>
                  <span className="text-purple-300 truncate">{overhead.name}</span>
                  {overhead.runway && (
                    <span className="text-stone-400 font-mono text-[11px]">
                      (RWY {overhead.runway})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-stone-400">
                  <span>{overhead.altitude_ft ? `${overhead.altitude_ft} ft` : '1,500 ft'}</span>
                  <span> • </span>
                  <span>{overhead.speed_kts ? `${overhead.speed_kts} kts` : '300 kts'}</span>
                  <span> • </span>
                  <span className="uppercase">{overhead.turn_direction || 'left'} BREAK</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab('routes')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold shrink-0 ml-2 px-2 py-1 rounded bg-stone-900/80 hover:bg-stone-800 border border-stone-700 transition-colors cursor-pointer"
            >
              View in Routes &rarr;
            </button>
          </div>
        )}

        {/* Fuel Amount */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Total Fuel (lbs / %)
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={plan.fuel_amount || ''}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, fuel_amount: e.target.value || null }))
            }
            placeholder="e.g. 10,800 lbs (100%)"
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Planned Loadout */}
        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
            Planned Loadout
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={stationLoadoutDisplay}
            onChange={(e) =>
              onMutatePlan((p) => ({ ...p, loadout: e.target.value, formatted_loadout: e.target.value }))
            }
            placeholder="e.g. 2x AIM-120C, 2x GBU-38, 1x TGM"
            className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1.5 px-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
          />
        </div>
      </div>

      {/* Divert Airfields */}
      <div className="pt-2 border-t border-stone-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-bold text-amber-400 uppercase">
            Divert Airfields ({diverts.length})
          </label>
          {canEdit && (
            <select
              value=""
              onChange={(e) => {
                const name = e.target.value;
                if (!name) return;
                const ab = (mapData.airbases || []).find((a) => a.name === name);
                if (!ab) return;
                onMutatePlan((p) => {
                  const cur = Array.isArray(p.diverts) ? [...p.diverts] : [];
                  if (
                    cur.some(
                      (d) =>
                        (typeof d === 'string' ? d : d?.name || '').toLowerCase() ===
                        ab.name.toLowerCase()
                    )
                  ) {
                    return p;
                  }
                  return {
                    ...p,
                    diverts: [
                      ...cur,
                      {
                        name: ab.name,
                        icao: ab.icao || ab.code || undefined,
                      },
                    ],
                  };
                });
              }}
              className="bg-stone-950 border border-stone-700 rounded px-2 py-0.5 text-xs text-stone-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="">+ Add Divert Airfield...</option>
              {(mapData.airbases || []).map((ab) => (
                <option key={`divopt-${ab.name}-${ab.lat}`} value={ab.name}>
                  {ab.name} {ab.icao || ab.code ? `(${ab.icao || ab.code})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {diverts.map((div, dIdx) => {
            const label = typeof div === 'string' ? div : div?.name || 'Divert';
            const code = typeof div === 'object' && div ? (div as any).code || div.icao : '';
            const tacan = typeof div === 'object' && div ? (div as any).tacan : '';
            return (
              <div
                key={`${label}-${dIdx}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-900 border border-stone-700 text-xs"
              >
                <span className="text-amber-400 font-bold">{label}</span>
                {code && <span className="font-mono text-[11px] text-stone-400">({code})</span>}
                {tacan && (
                  <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                    {tacan}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      onMutatePlan((p) => ({
                        ...p,
                        diverts: (Array.isArray(p.diverts) ? p.diverts : []).filter(
                          (_, i) => i !== dIdx
                        ),
                      }))
                    }
                    className="text-stone-400 hover:text-red-400 ml-1 font-bold cursor-pointer"
                    title="Remove Divert"
                  >
                    &times;
                  </button>
                )}
              </div>
            );
          })}
          {diverts.length === 0 && (
            <span className="text-stone-500 italic text-xs">
              No divert airfields selected. Click airbases on the map to add them as diverts.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
