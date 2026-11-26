import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ArrowsClockwise,
  ArrowsLeftRight,
  CaretDown,
  CheckCircle,
  Crosshair,
  FloppyDisk,
  Info,
  Lightning,
  MagnifyingGlass,
  Star,
  Trash,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  deleteLoadoutPreset,
  saveLoadoutPreset,
} from '../../../../services/campaignMapService';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapLoadoutPreset,
  CampaignMapPayload,
  CampaignMapWarehouseInventory,
  FlightPlanDetail,
} from '../../../../types';
import {
  compileLoadoutSummary,
  getAirframeKey,
  getAirframeLoadoutImageUrl,
  getOutOfStockWarnings,
  getPylonSvgPaths,
  getStationOptions,
  getStationsListFromConfig,
  mirrorWingStations,
  resolveStoreStock,
  sanitizeF16Stations,
} from './helpers';

interface LoadoutTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  warehouse: CampaignMapWarehouseInventory | null;
  loadingWarehouse: boolean;
  onRefreshWarehouse: () => void;
  onLoadoutPresetsChange: (presets: CampaignMapLoadoutPreset[]) => void;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const LoadoutTab: React.FC<LoadoutTabProps> = ({
  plan,
  mapData,
  selectedAirframe,
  canEdit,
  apiBaseUrl,
  discordId,
  token,
  warehouse,
  loadingWarehouse,
  onRefreshWarehouse,
  onLoadoutPresetsChange,
  onMutatePlan,
  onNotify,
}) => {
  const [hoveredStation, setHoveredStation] = useState<string | number | null>(null);
  const [focusedStation, setFocusedStation] = useState<string | number | null>(null);
  const [openDropdownSta, setOpenDropdownSta] = useState<string | null>(null);
  const [stationSearch, setStationSearch] = useState<Record<string, string>>({});
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  const [showLoadPresetModal, setShowLoadPresetModal] = useState(false);
  const [loadPresetSearch, setLoadPresetSearch] = useState('');
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setOpenDropdownSta(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const afKey = useMemo(
    () => getAirframeKey(selectedAirframe || plan.airframe),
    [selectedAirframe, plan.airframe]
  );

  const loadoutCfg = useMemo(
    () => (selectedAirframe?.loadout_config || {}) as Record<string, any>,
    [selectedAirframe]
  );

  const stationsList = useMemo(() => getStationsListFromConfig(loadoutCfg), [loadoutCfg]);

  const stationsMap = useMemo(() => {
    const raw =
      plan.station_loadout || (plan.metadata?.stations as Record<string, string>) || {};
    return sanitizeF16Stations(afKey, raw);
  }, [plan.station_loadout, plan.metadata?.stations, afKey]);

  const loadoutImageUrl = useMemo(
    () => getAirframeLoadoutImageUrl(loadoutCfg, afKey, apiBaseUrl),
    [loadoutCfg, afKey, apiBaseUrl]
  );

  const pylonNormal = useMemo(
    () => getPylonSvgPaths(stationsList, hoveredStation, focusedStation, false),
    [stationsList, hoveredStation, focusedStation]
  );
  const pylonHighlight = useMemo(
    () => getPylonSvgPaths(stationsList, hoveredStation, focusedStation, true),
    [stationsList, hoveredStation, focusedStation]
  );

  const outOfStockWarnings = useMemo(
    () =>
      getOutOfStockWarnings(
        stationsMap,
        loadoutCfg,
        warehouse,
        loadingWarehouse,
        plan.departure_airfield
      ),
    [stationsMap, loadoutCfg, warehouse, loadingWarehouse, plan.departure_airfield]
  );

  const systemPresets = useMemo(() => {
    const raw = loadoutCfg?.presets;
    if (!raw) return [];
    const list = Array.isArray(raw)
      ? raw
      : Object.entries(raw).map(([k, v]: [string, any]) => ({ id: k, ...v }));
    return list.map((p: any, idx: number) => ({
      id: String(p.id || p.key || `sys_${idx}`),
      name: String(p.name || `Preset ${idx + 1}`),
      description: String(p.description || ''),
      stations: (typeof p.stations === 'string' ? JSON.parse(p.stations) : p.stations) || {},
    }));
  }, [loadoutCfg]);

  const userPresets = useMemo(() => {
    return (mapData.loadoutPresets || [])
      .filter((p) => {
        if (afKey && p.airframe_key && p.airframe_key.toLowerCase() === afKey.toLowerCase()) {
          return true;
        }
        if (plan.airframe_id && p.airframe_id && Number(p.airframe_id) === Number(plan.airframe_id)) {
          return true;
        }
        return !p.airframe_key && !p.airframe_id;
      })
      .map((p) => {
        let st = p.stations || {};
        if (typeof st === 'string') {
          try {
            st = JSON.parse(st);
          } catch {
            st = {};
          }
        }
        return { ...p, stations: st };
      });
  }, [mapData.loadoutPresets, afKey, plan.airframe_id]);

  const gunOptions: string[] = useMemo(() => {
    if (!loadoutCfg?.gun) return [];
    return loadoutCfg.gun.options || loadoutCfg.gun.ammo_types || [];
  }, [loadoutCfg]);

  const cmOptions: string[] = useMemo(() => {
    if (!loadoutCfg?.countermeasures) return [];
    return (
      loadoutCfg.countermeasures.options || [
        '60 Chaff / 30 Flare (Standard 2:1 Mix)',
        '90 Chaff / 0 Flare',
        '0 Chaff / 90 Flare',
      ]
    );
  }, [loadoutCfg]);

  const getSelectedOptionName = (staNum: string | number): string => {
    const val = stationsMap[String(staNum)];
    if (!val || val === '<CLEAN>' || val === 'CLEAN') return '';
    const opts = getStationOptions(loadoutCfg, staNum);
    const found = opts.find((o) => o.clsid === val || o.id === val || String(o.id) === String(val));
    return found ? String(found.name) : String(val);
  };

  const applyStationsAndCompile = (nextStations: Record<string, string>) => {
    const cleaned = sanitizeF16Stations(afKey, nextStations);
    const summary = compileLoadoutSummary(cleaned, loadoutCfg);
    onMutatePlan((p) => ({
      ...p,
      station_loadout: cleaned,
      loadout: summary,
      formatted_loadout: summary,
    }));
  };

  const handleMirrorWings = () => {
    const res = mirrorWingStations(afKey, stationsList, stationsMap);
    if (!res.ok) {
      onNotify('warning', res.message);
      return;
    }
    applyStationsAndCompile(res.stations);
  };

  const handleClearAll = () => {
    const next: Record<string, string> = {};
    stationsList.forEach((s) => {
      next[String(s.number)] = '<CLEAN>';
    });
    applyStationsAndCompile(next);
  };

  const handleSaveCustomPreset = async () => {
    if (!newPresetName.trim()) {
      onNotify('warning', 'Please enter a preset name');
      return;
    }
    setIsSavingPreset(true);
    try {
      const next = await saveLoadoutPreset(
        apiBaseUrl,
        {
          airframe_key: afKey || 'GENERIC',
          airframe_id: plan.airframe_id,
          name: newPresetName.trim(),
          description: newPresetDesc.trim() || undefined,
          stations: stationsMap,
          gun: plan.gun_loadout,
          countermeasures: plan.countermeasures_loadout,
        },
        { discordId, token }
      );
      onLoadoutPresetsChange(next);
      setShowSavePresetModal(false);
      setNewPresetName('');
      setNewPresetDesc('');
      onNotify('success', 'Saved custom loadout preset.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save preset.');
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleDeleteCustomPreset = async (id: number, name: string) => {
    if (!window.confirm(`Delete custom preset '${name}'?`)) return;
    try {
      const next = await deleteLoadoutPreset(apiBaseUrl, id, { discordId, token });
      onLoadoutPresetsChange(next);
      onNotify('success', `Deleted preset '${name}'`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete preset.');
    }
  };

  const filteredUserPresets = userPresets.filter(
    (p) =>
      !loadPresetSearch ||
      `${p.name} ${p.description || ''}`.toLowerCase().includes(loadPresetSearch.toLowerCase())
  );
  const filteredSystemPresets = systemPresets.filter(
    (p) =>
      !loadPresetSearch ||
      `${p.name} ${p.description || ''}`.toLowerCase().includes(loadPresetSearch.toLowerCase())
  );

  return (
    <div className="space-y-3" ref={dropdownContainerRef}>
      {/* Top Controls & Presets */}
      <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5 min-w-0">
            <Crosshair className="size-4 text-amber-400 shrink-0" weight="duotone" />
            <span className="truncate font-semibold tracking-wide">
              {loadoutCfg?.name || selectedAirframe?.name || 'Aircraft Loadout'}
            </span>
          </span>

          {canEdit && (
            <div className="flex items-center gap-1.5 shrink-0">
              {stationsList.length >= 7 && (
                <button
                  type="button"
                  onClick={handleMirrorWings}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Mirror Left Wing stores to Right Wing"
                >
                  <ArrowsLeftRight className="size-3.5 text-sky-400" weight="duotone" />
                  <span>Mirror Wings</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                title="Reset all stations to Clean / Empty"
              >
                <Trash className="size-3.5 text-stone-400" weight="duotone" />
                <span>Clean All</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800/80">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              setLoadPresetSearch('');
              setShowLoadPresetModal(true);
            }}
            className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Lightning className="size-3.5 text-amber-400" weight="duotone" />
            <span>Load Preset...</span>
            <span className="text-[11px] text-stone-400 font-mono tabular-nums">
              ({systemPresets.length + userPresets.length})
            </span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setNewPresetName('');
                setNewPresetDesc('');
                setShowSavePresetModal(true);
              }}
              className="px-3 py-1.5 rounded bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-700/60 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FloppyDisk className="size-3.5 text-amber-400" weight="duotone" />
              <span>Save Current as Preset</span>
            </button>
          )}
        </div>
      </div>

      {/* Aircraft Visual Silhouette Schematic & Pylon Strip */}
      <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-2 overflow-hidden">
        <div className="relative w-full max-w-[580px] mx-auto aspect-[4/1] flex items-center justify-center">
          <img
            src={loadoutImageUrl}
            alt="Aircraft Loadout"
            className="w-full h-full object-contain select-none pointer-events-none opacity-85"
            style={{ filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.15))' }}
            draggable={false}
          />
          <svg
            viewBox="0 0 1000 250"
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
            preserveAspectRatio="none"
          >
            <path
              d={pylonNormal.lines}
              fill="none"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <path d={pylonHighlight.lines} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
            <path d={pylonNormal.dots} fill="#f59e0b" stroke="#000000" strokeWidth="1" />
            <path d={pylonHighlight.dots} fill="#fef08a" stroke="#f59e0b" strokeWidth="1.5" />
          </svg>
        </div>

        <div
          className="grid gap-1 select-none"
          style={{
            gridTemplateColumns: `repeat(${stationsList.length || 7}, minmax(0, 1fr))`,
          }}
        >
          {stationsList.map((sta) => {
            const staNum = String(sta.number);
            const val = stationsMap[staNum];
            const isClean = !val || val === '<CLEAN>' || val === 'CLEAN';
            const stock = resolveStoreStock(
              val,
              staNum,
              loadoutCfg,
              warehouse,
              loadingWarehouse,
              plan.departure_airfield
            );
            const active =
              String(focusedStation) === staNum || String(hoveredStation) === staNum;

            return (
              <button
                key={`pylon-${staNum}`}
                type="button"
                onClick={() => {
                  setFocusedStation(staNum);
                  document
                    .getElementById(`loadout-sta-row-${staNum}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                onMouseEnter={() => setHoveredStation(staNum)}
                onMouseLeave={() => setHoveredStation(null)}
                title={`STA ${staNum} (${sta.short_name || sta.name}): ${val || 'Clean'}`}
                className={`flex flex-col items-center justify-between p-1 rounded border text-center transition-all cursor-pointer group min-h-[48px] ${
                  active
                    ? 'bg-amber-950/40 border-amber-400 ring-1 ring-amber-400 shadow-sm'
                    : !stock.available && !stock.is_unlimited
                      ? 'bg-amber-950/20 border-amber-600/70 hover:border-amber-400'
                      : !isClean
                        ? 'bg-stone-900 border-stone-700 hover:border-stone-500'
                        : 'bg-stone-900/50 border-stone-800 hover:border-stone-700'
                }`}
              >
                <span
                  className={`text-[11px] font-mono font-bold px-1 rounded ${
                    active
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-950 text-stone-400 group-hover:text-stone-200'
                  }`}
                >
                  {staNum}
                </span>

                <div className="py-0.5 w-full truncate">
                  {isClean ? (
                    <span className="text-[11px] text-stone-600 italic">Empty</span>
                  ) : (
                    <span
                      className={`text-[11px] font-bold truncate block ${
                        !stock.available && !stock.is_unlimited
                          ? 'text-amber-400'
                          : 'text-stone-200'
                      }`}
                    >
                      {getSelectedOptionName(staNum) || val}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  {!isClean ? (
                    <span
                      className={`size-1.5 rounded-full ${
                        !stock.available && !stock.is_unlimited
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-emerald-400'
                      }`}
                    />
                  ) : (
                    <span className="size-1.5 rounded-full bg-stone-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Departure Warehouse Status */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3 py-1.5 rounded bg-stone-950/80 border border-stone-800 text-xs">
          <div className="flex items-center gap-2">
            {plan.departure_airfield ? (
              <div className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${
                    warehouse?.is_unlimited ? 'bg-sky-400' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-stone-400">Departure Base:</span>
                <span className="font-bold text-white font-mono">{plan.departure_airfield}</span>
                <span className="text-[11px] text-stone-500">
                  {warehouse?.is_unlimited ? '(Unlimited Stock)' : '(Warehouse Monitored)'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-stone-400">
                <Info className="size-3.5 text-sky-400" weight="duotone" />
                <span>Select a Departure Airfield to check live warehouse munitions availability.</span>
              </div>
            )}
          </div>
          {plan.departure_airfield && !warehouse?.is_unlimited && (
            <button
              type="button"
              onClick={onRefreshWarehouse}
              className="text-xs text-amber-400 hover:text-amber-300 underline flex items-center gap-0.5 cursor-pointer"
            >
              <ArrowsClockwise
                className={`size-3 ${loadingWarehouse ? 'animate-spin' : ''}`}
                weight="duotone"
              />
              <span>Refresh Stock</span>
            </button>
          )}
        </div>

        {outOfStockWarnings.length > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Warning className="size-4" weight="duotone" />
              <span>
                Advisory: Depleted Ordnance at Departure Airfield ({plan.departure_airfield})
              </span>
            </div>
            <p className="text-xs text-amber-300/90 leading-tight">
              The following selected munitions are currently out of stock at your indicated
              departure airbase.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {outOfStockWarnings.map((w) => (
                <span
                  key={`${w.station}-${w.weapon}`}
                  className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/50 text-[11px] font-mono text-amber-200"
                >
                  {w.station}: {w.weapon}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stations List */}
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {stationsList.map((sta) => {
          const staNum = String(sta.number);
          const selectedVal = stationsMap[staNum];
          const isClean = !selectedVal || selectedVal === '<CLEAN>' || selectedVal === 'CLEAN';
          const stock = resolveStoreStock(
            selectedVal,
            staNum,
            loadoutCfg,
            warehouse,
            loadingWarehouse,
            plan.departure_airfield
          );
          const isOpenDropdown = openDropdownSta === staNum;
          const searchQ = (stationSearch[staNum] || '').trim().toLowerCase();
          const allOptions = getStationOptions(loadoutCfg, staNum);
          const filteredOpts = searchQ
            ? allOptions.filter((item) => {
                const n = String(item.name || '').toLowerCase();
                const c = String(item.clsid || item.id || '').toLowerCase();
                const ent = String(item.dcs_entity || '').toLowerCase();
                return n.includes(searchQ) || c.includes(searchQ) || ent.includes(searchQ);
              })
            : allOptions;

          return (
            <div
              key={`row-${staNum}`}
              id={`loadout-sta-row-${staNum}`}
              className={`grid grid-cols-12 gap-2 p-2 rounded-lg bg-stone-900/80 border items-center transition-all scroll-mt-2 ${
                String(focusedStation) === staNum
                  ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-950/20'
                  : !stock.available && !stock.is_unlimited
                    ? 'border-amber-500/60 bg-amber-950/15'
                    : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="col-span-4 flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-stone-950 font-mono font-bold text-amber-400 text-[11px] border border-stone-800">
                    STA {staNum}
                  </span>
                  <span className="font-bold text-stone-200 text-xs truncate">{sta.name}</span>
                </div>
                <div className="text-[11px] text-stone-500 capitalize pl-0.5 mt-0.5">
                  {sta.type} ({sta.side})
                </div>
              </div>

              <div className="col-span-8 flex flex-col gap-1">
                <div className="relative">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      const nextOpen = isOpenDropdown ? null : staNum;
                      setOpenDropdownSta(nextOpen);
                      setFocusedStation(staNum);
                      setStationSearch((prev) => ({ ...prev, [staNum]: '' }));
                    }}
                    className={`w-full rounded border bg-stone-950 text-xs py-1.5 px-2 text-left flex items-center justify-between gap-1 min-h-[32px] transition-colors cursor-pointer disabled:opacity-60 ${
                      isOpenDropdown
                        ? 'border-amber-400 ring-1 ring-amber-400'
                        : 'border-stone-700 hover:border-stone-600'
                    }`}
                  >
                    <span
                      className={`truncate ${
                        !isClean ? 'text-stone-100 font-medium' : 'text-stone-500 italic'
                      }`}
                    >
                      {getSelectedOptionName(staNum) || '-- Empty / Clean --'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isClean && canEdit && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            applyStationsAndCompile({ ...stationsMap, [staNum]: '<CLEAN>' });
                            setOpenDropdownSta(null);
                          }}
                          className="text-stone-500 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
                          title="Clear station"
                        >
                          <XCircle className="size-3.5" weight="duotone" />
                        </span>
                      )}
                      <CaretDown className="size-3 text-stone-500" weight="duotone" />
                    </div>
                  </button>

                  {isOpenDropdown && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 shadow-2xl shadow-black/80 overflow-hidden">
                      <div className="p-1.5 border-b border-stone-800 bg-stone-900/90 flex items-center gap-1.5">
                        <MagnifyingGlass className="size-3.5 text-stone-400 shrink-0 ml-1" />
                        <input
                          type="text"
                          autoFocus
                          value={stationSearch[staNum] || ''}
                          onChange={(e) =>
                            setStationSearch((prev) => ({ ...prev, [staNum]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setOpenDropdownSta(null);
                          }}
                          placeholder="Type to filter ordnance..."
                          className="w-full bg-transparent border-0 p-0 text-xs text-stone-100 placeholder-stone-500 focus:outline-none"
                        />
                        {stationSearch[staNum] && (
                          <button
                            type="button"
                            onClick={() =>
                              setStationSearch((prev) => ({ ...prev, [staNum]: '' }))
                            }
                            className="text-stone-500 hover:text-stone-300 p-0.5"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            applyStationsAndCompile({ ...stationsMap, [staNum]: '<CLEAN>' });
                            setOpenDropdownSta(null);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-stone-800 transition-colors border-b border-stone-800/80 flex items-center justify-between gap-1 cursor-pointer ${
                            isClean ? 'text-amber-400 font-semibold bg-stone-900' : 'text-stone-400 italic'
                          }`}
                        >
                          <span>-- Empty / Clean --</span>
                          {isClean && <span className="text-amber-400">✓</span>}
                        </button>

                        {filteredOpts.map((item) => {
                          const code = String(item.clsid || item.id);
                          const isSel = String(selectedVal) === code;
                          return (
                            <button
                              key={`${staNum}-${code}`}
                              type="button"
                              onClick={() => {
                                applyStationsAndCompile({ ...stationsMap, [staNum]: code });
                                setOpenDropdownSta(null);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-stone-800 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                isSel ? 'text-amber-300 font-semibold bg-amber-950/40' : 'text-stone-200'
                              }`}
                            >
                              <span className="truncate">{item.name}</span>
                              {isSel && (
                                <CheckCircle className="size-3.5 text-amber-400 shrink-0" weight="duotone" />
                              )}
                            </button>
                          );
                        })}

                        {filteredOpts.length === 0 && (
                          <div className="px-2.5 py-3 text-xs text-stone-500 text-center italic">
                            No items matching &ldquo;{stationSearch[staNum]}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Stock Pill */}
                <div className="flex items-center justify-between px-1 text-[11px]">
                  {!isClean ? (
                    stock.is_unlimited ? (
                      <span className="text-stone-400">Stock: Unlimited</span>
                    ) : stock.available ? (
                      <span className="text-emerald-400 tabular-nums font-semibold">
                        ✓ {stock.quantity} in stock at {plan.departure_airfield}
                      </span>
                    ) : (
                      <span className="text-amber-400 tabular-nums font-bold">
                        ⚠️ 0 in stock at {plan.departure_airfield} (Depleted)
                      </span>
                    )
                  ) : (
                    <span className="text-stone-500">Station Clean</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Gun & Countermeasures */}
        {(loadoutCfg?.gun || loadoutCfg?.countermeasures) && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800">
            {loadoutCfg?.gun && (
              <div className="p-2 rounded bg-stone-900/60 border border-stone-800 space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase block truncate">
                  {loadoutCfg.gun.name || 'Internal Gun'}
                </label>
                {gunOptions.length > 0 ? (
                  <select
                    disabled={!canEdit}
                    value={plan.gun_loadout || loadoutCfg.gun.default || gunOptions[0] || ''}
                    onChange={(e) =>
                      onMutatePlan((p) => ({ ...p, gun_loadout: e.target.value }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-1.5 focus:border-amber-400 focus:outline-none truncate"
                  >
                    {gunOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={plan.gun_loadout || ''}
                    onChange={(e) =>
                      onMutatePlan((p) => ({ ...p, gun_loadout: e.target.value }))
                    }
                    placeholder="e.g. 578 rds 20mm M61A2"
                    className="w-full rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-1.5 focus:border-amber-400 focus:outline-none"
                  />
                )}
              </div>
            )}

            {loadoutCfg?.countermeasures && (
              <div className="p-2 rounded bg-stone-900/60 border border-stone-800 space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase block truncate">
                  {loadoutCfg.countermeasures.name || 'Countermeasures'}
                </label>
                <select
                  disabled={!canEdit}
                  value={
                    plan.countermeasures_loadout ||
                    loadoutCfg.countermeasures.default ||
                    cmOptions[0] ||
                    ''
                  }
                  onChange={(e) =>
                    onMutatePlan((p) => ({ ...p, countermeasures_loadout: e.target.value }))
                  }
                  className="w-full rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-1.5 focus:border-amber-400 focus:outline-none truncate"
                >
                  {cmOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-Compiled Loadout Summary */}
      <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-stone-300">Compiled Loadout Text (Brief &amp; PDF)</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => applyStationsAndCompile(stationsMap)}
              className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              Recompile from Stations
            </button>
          )}
        </div>
        <input
          type="text"
          disabled={!canEdit}
          value={typeof plan.loadout === 'string' ? plan.loadout : plan.formatted_loadout || ''}
          onChange={(e) =>
            onMutatePlan((p) => ({
              ...p,
              loadout: e.target.value,
              formatted_loadout: e.target.value,
            }))
          }
          placeholder="e.g. 2x AIM-9X, 4x AIM-120C, 2x GBU-12, 1x ATFLIR, 3x 330gal Tank"
          className="w-full rounded border border-stone-700 bg-stone-900 text-amber-300 font-mono text-xs py-1.5 px-2 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* Save Custom Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FloppyDisk className="size-5 text-amber-400" weight="duotone" />
                <h3 className="text-sm font-bold text-stone-100">Save Custom Loadout Preset</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-400 font-medium mb-1">
                  Preset Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSaveCustomPreset();
                    }
                  }}
                  placeholder="e.g. My Heavy CAS, JTAC Laser Strike"
                  className="w-full rounded bg-stone-950 border border-stone-700 text-stone-100 text-xs px-3 py-2 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-stone-400 font-medium mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Brief description of mission role or stores..."
                  className="w-full rounded bg-stone-950 border border-stone-700 text-stone-100 text-xs px-3 py-1.5 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPreset || !newPresetName.trim()}
                onClick={() => void handleSaveCustomPreset()}
                className="px-3.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-950 font-bold text-xs cursor-pointer"
              >
                {isSavingPreset ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Preset Browser Modal */}
      {showLoadPresetModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-stone-900 border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between p-3.5 border-b border-stone-800 bg-stone-950/80 shrink-0">
              <div className="flex items-center gap-2">
                <Lightning className="w-4 h-4 text-amber-400 shrink-0" weight="duotone" />
                <div>
                  <h3 className="text-xs font-bold text-stone-100 uppercase tracking-wide">
                    Load Aircraft Preset
                  </h3>
                  <p className="text-xs text-stone-400">
                    {loadoutCfg?.name || 'Standard Configurations'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLoadPresetModal(false)}
                className="text-stone-400 hover:text-stone-200 p-1 rounded hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" weight="bold" />
              </button>
            </div>

            <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
              {systemPresets.length + userPresets.length > 4 && (
                <div className="relative flex items-center">
                  <MagnifyingGlass className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={loadPresetSearch}
                    onChange={(e) => setLoadPresetSearch(e.target.value)}
                    placeholder="Filter presets by name or weapon..."
                    className="w-full rounded-lg bg-stone-950 border border-stone-700 text-stone-100 text-xs pl-9 pr-8 py-2 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              )}

              {userPresets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                    <Star className="w-3.5 h-3.5 text-amber-400" weight="fill" />
                    <span>My Custom Presets</span>
                  </div>
                  <div className="space-y-1.5">
                    {filteredUserPresets.map((preset) => (
                      <div
                        key={`usr-${preset.id}`}
                        className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-stone-100 text-xs truncate block">
                            {preset.name}
                          </span>
                          {preset.description && (
                            <p className="text-xs text-stone-400 truncate mt-0.5">
                              {preset.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              applyStationsAndCompile({ ...(preset.stations || {}) });
                              setShowLoadPresetModal(false);
                            }}
                            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCustomPreset(preset.id, preset.name)}
                            className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-stone-900 cursor-pointer"
                            title="Delete custom preset"
                          >
                            <Trash className="w-3.5 h-3.5" weight="duotone" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {systemPresets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    <Lightning className="w-3.5 h-3.5 text-amber-400" weight="duotone" />
                    <span>Standard Presets</span>
                  </div>
                  <div className="space-y-1.5">
                    {filteredSystemPresets.map((preset) => (
                      <div
                        key={`sys-${preset.id}`}
                        className="p-2.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-stone-100 text-xs block truncate">
                            {preset.name}
                          </span>
                          {preset.description && (
                            <p className="text-xs text-stone-400 leading-tight mt-0.5">
                              {preset.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            applyStationsAndCompile({ ...(preset.stations || {}) });
                            setShowLoadPresetModal(false);
                          }}
                          className="px-2.5 py-1 rounded bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 text-xs font-semibold shrink-0 border border-stone-700 hover:border-amber-400 cursor-pointer"
                        >
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {systemPresets.length === 0 && userPresets.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-500 italic">
                  No preset configurations available for this airframe.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-stone-800 bg-stone-950/80 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowLoadPresetModal(false)}
                className="px-3.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
