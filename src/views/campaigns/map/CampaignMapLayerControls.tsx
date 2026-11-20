import React, { useMemo, useState } from 'react';
import {
  AirplaneTakeoff,
  AirplaneTilt,
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  Check,
  Clock,
  Compass,
  CrosshairSimple,
  GlobeHemisphereWest,
  MagnifyingGlass,
  MapTrifold,
  Mountains,
  Package,
  Path,
  PencilSimple,
  Polygon,
  ShieldCheck,
  Stack,
  Target,
  Truck,
  WarningDiamond,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { CampaignMapMission, CampaignMapPolygonGroup } from '../../../types';

export interface PortalLayerStates {
  airbasesBlue: boolean;
  airbasesRed: boolean;
  airbasesNeutral: boolean;
  airbaseProceduresDeparture: boolean;
  airbaseProceduresArrival: boolean;
  airbaseProceduresApproach: boolean;
  airbaseProceduresPattern: boolean;
  tacticalMarkings: boolean;
  navaids: boolean;
  bullseye: boolean;
  frontline: boolean;
  supportAssets: boolean;
  threats: boolean;
  missions: boolean;
  flightPlans: boolean;
  isr: boolean;
  logistics: boolean;
}

export const DEFAULT_PORTAL_LAYER_STATES: PortalLayerStates = {
  airbasesBlue: true,
  airbasesRed: true,
  airbasesNeutral: false,
  airbaseProceduresDeparture: false,
  airbaseProceduresArrival: false,
  airbaseProceduresApproach: false,
  airbaseProceduresPattern: false,
  tacticalMarkings: true,
  navaids: false,
  bullseye: true,
  frontline: true,
  supportAssets: true,
  threats: true,
  missions: true,
  flightPlans: true,
  isr: false,
  logistics: true,
};

interface CampaignMapLayerControlsProps {
  missions: CampaignMapMission[];
  polygonGroups: CampaignMapPolygonGroup[];
  polygonGroupStates: Record<string, boolean>;
  onToggleSinglePolygonGroup: (id: string) => void;
  onToggleAllPolygonGroups: (enabled: boolean) => void;
  selectedMissionId: number | null;
  selectedSortieId: number | null;
  onSelectSortie: (sortieId: number | null, missionId: number | null) => void;
  tileNames: string[];
  activeTileName: string;
  onSelectTile: (name: string) => void;
  layerStates: PortalLayerStates;
  onToggleLayer: (key: keyof PortalLayerStates) => void;
  onToggleAllProcedures: (enabled: boolean) => void;
  isTraining: boolean;
  onManualRefresh: () => void;
  isLoading: boolean;
}

/**
 * Replicates `partials/map-canvas.blade.php` top-right controls:
 * 1) Sorties 2-Column Master-Detail Popover (`w-[560px]`)
 * 2) Tiles Popover (`DCS Tiles v2`, `DCS Terrain Map`, `Carto Dark`, `Carto Voyager`)
 * 3) Categorized Layers Accordion Popover (`Airbases`, `Airfield Procedures`, `Terrain`, `Mission`, `Areas of Operations`, `Logistics`)
 */
export const CampaignMapLayerControls: React.FC<CampaignMapLayerControlsProps> = ({
  missions,
  polygonGroups,
  polygonGroupStates,
  onToggleSinglePolygonGroup,
  onToggleAllPolygonGroups,
  selectedMissionId,
  selectedSortieId,
  onSelectSortie,
  tileNames,
  activeTileName,
  onSelectTile,
  layerStates,
  onToggleLayer,
  onToggleAllProcedures,
  isTraining,
  onManualRefresh,
  isLoading,
}) => {
  const [openMenu, setOpenMenu] = useState<'none' | 'sorties' | 'tiles' | 'layers'>('none');
  const [sortieSearch, setSortieSearch] = useState('');
  const [hoveredMissionId, setHoveredMissionId] = useState<number | null>(
    missions[0]?.id ?? null
  );

  // Accordion section states matching portal defaults
  const [openAirbases, setOpenAirbases] = useState(false);
  const [openProcedures, setOpenProcedures] = useState(false);
  const [openTerrain, setOpenTerrain] = useState(true);
  const [openMission, setOpenMission] = useState(true);
  const [openAreas, setOpenAreas] = useState(true);
  const [openLogistics, setOpenLogistics] = useState(true);

  const activeSortie = useMemo(() => {
    if (!selectedSortieId) return null;
    for (const m of missions) {
      const s = (m.sorties || []).find((item) => item.id === selectedSortieId);
      if (s) return { ...s, mission_name: m.name };
    }
    return null;
  }, [missions, selectedSortieId]);

  const filteredMissions = useMemo(() => {
    const q = sortieSearch.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.tasking_label || '').toLowerCase().includes(q) ||
        (m.sorties || []).some((s) => s.name.toLowerCase().includes(q))
    );
  }, [missions, sortieSearch]);

  const focusedMission = useMemo(() => {
    const targetId = hoveredMissionId ?? selectedMissionId ?? filteredMissions[0]?.id ?? null;
    return filteredMissions.find((m) => m.id === targetId) || filteredMissions[0] || null;
  }, [filteredMissions, hoveredMissionId, selectedMissionId]);

  const allProceduresEnabled =
    layerStates.airbaseProceduresDeparture ||
    layerStates.airbaseProceduresArrival ||
    layerStates.airbaseProceduresApproach ||
    layerStates.airbaseProceduresPattern;

  const allPolygonEnabled =
    polygonGroups.length === 0 ||
    polygonGroups.some((pg, idx) => polygonGroupStates[pg.group_name || pg.name || `ao_${idx}`] !== false);

  return (
    <div className="flex items-center gap-2 relative">
      {/* SORTIES 2-COLUMN POPOVER */}
      {!isTraining && (
        <div className="relative">
          {!activeSortie ? (
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'sorties' ? 'none' : 'sorties'))}
              className={`px-3 py-1.5 bg-stone-900/90 hover:bg-stone-800 border rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                openMenu === 'sorties'
                  ? 'border-amber-500 text-amber-400 bg-stone-800'
                  : 'border-stone-700/80 text-stone-200'
              }`}
            >
              <Target className="w-4 h-4 text-amber-400" weight="duotone" />
              <span>Sorties</span>
              <CaretDown
                className={`w-3 h-3 text-stone-400 transition-transform ${
                  openMenu === 'sorties' ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>
          ) : (
            <div className="inline-flex items-center h-8.5 pl-2.5 pr-1 text-xs font-semibold rounded-lg bg-sky-950/85 border border-sky-500/80 text-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.3)] backdrop-blur-md gap-2">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'sorties' ? 'none' : 'sorties'))}
                className="flex items-center gap-1.5 hover:text-white max-w-[220px] truncate cursor-pointer"
              >
                <Target className="w-4 h-4 text-sky-400 shrink-0" weight="duotone" />
                <span className="truncate">
                  <b className="text-white">{activeSortie.mission_name}</b>
                  <span className="text-sky-300"> • </span>
                  <span>{activeSortie.name}</span>
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-900/90 text-sky-300 border border-sky-700 shrink-0">
                  {activeSortie.flight_plans_count} plans
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelectSortie(null, null)}
                title="Clear Sortie View"
                className="p-1 rounded-md text-stone-400 hover:text-rose-400 hover:bg-stone-800/80 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {openMenu === 'sorties' && (
            <div className="w-[560px] max-w-[90vw] bg-stone-900/95 border border-stone-700/90 rounded-xl shadow-2xl backdrop-blur-md z-[1200] overflow-hidden flex flex-col text-stone-200 divide-y divide-stone-800 absolute right-0 top-full mt-2">
              <div className="p-2.5 bg-stone-950/60 flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlass className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={sortieSearch}
                    onChange={(e) => setSortieSearch(e.target.value)}
                    placeholder="Search missions or sorties..."
                    className="w-full h-8 pl-8 pr-3 text-xs bg-stone-900 text-stone-200 border border-stone-700/80 rounded-lg focus:outline-none focus:border-amber-500 placeholder:text-stone-500"
                  />
                </div>
                {(selectedSortieId || selectedMissionId) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSortie(null, null);
                      setOpenMenu('none');
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-md flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Clear Map Overlay</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-12 h-[360px] max-h-[60vh]">
                <div className="col-span-5 border-r border-stone-800 p-2 flex flex-col min-h-0 bg-stone-950/30">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold flex justify-between mb-1">
                    <span>Missions</span>
                    <span>{filteredMissions.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                    {filteredMissions.length === 0 ? (
                      <div className="p-3 text-xs text-stone-400 italic text-center">
                        No missions found
                      </div>
                    ) : (
                      filteredMissions.map((m) => (
                        <div
                          key={m.id}
                          onMouseEnter={() => setHoveredMissionId(m.id)}
                          onClick={() => setHoveredMissionId(m.id)}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                            focusedMission?.id === m.id
                              ? 'bg-stone-800/90 text-white border border-stone-700/80'
                              : 'hover:bg-stone-800/50 text-stone-300 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: m.color_hex || m.color || '#ef4444' }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{m.name}</div>
                              <div className="text-[10px] text-stone-400 truncate">
                                {m.tasking_label || 'Mission'}
                              </div>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-900 text-stone-400 shrink-0">
                            {(m.sorties || []).length}s
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="col-span-7 p-2.5 flex flex-col min-h-0">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold flex justify-between mb-1.5">
                    <span className="truncate">{focusedMission?.name || 'Sorties'}</span>
                    <span>{(focusedMission?.sorties || []).length} sorties</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {!focusedMission || (focusedMission.sorties || []).length === 0 ? (
                      <div className="py-8 text-center text-xs text-stone-400 italic">
                        No sorties created for this mission yet
                      </div>
                    ) : (
                      (focusedMission.sorties || []).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            onSelectSortie(s.id, focusedMission.id);
                            setOpenMenu('none');
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between group cursor-pointer transition ${
                            selectedSortieId === s.id
                              ? 'bg-sky-950/50 border-sky-500 text-white'
                              : 'bg-stone-900/70 border-stone-800 hover:bg-stone-800 text-stone-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate">{s.name}</span>
                              {selectedSortieId === s.id && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/50 uppercase">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-mono">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {s.scheduled_at_human || s.scheduled_at || 'Unscheduled'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                s.flight_plans_count > 0
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'bg-stone-800 text-stone-400'
                              }`}
                            >
                              {s.flight_plans_count} {s.flight_plans_count === 1 ? 'plan' : 'plans'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-amber-400" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="pt-2 mt-2 border-t border-stone-800 text-[10px] text-stone-400 font-mono">
                    Click a sortie to show its flight plans on map
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TILES MENU */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'tiles' ? 'none' : 'tiles'))}
          className="px-3 py-1.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold text-stone-200 flex items-center gap-2 cursor-pointer"
        >
          <MapTrifold className="w-4 h-4 text-amber-400" weight="duotone" />
          <span>Tiles</span>
          <CaretDown
            className={`w-3 h-3 text-stone-400 transition-transform ${
              openMenu === 'tiles' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openMenu === 'tiles' && (
          <div className="w-56 bg-stone-900/95 border border-stone-700/80 rounded-xl shadow-2xl backdrop-blur-md p-2 space-y-1 z-[1200] absolute right-0 top-full mt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 py-1 border-b border-stone-800 flex items-center justify-between">
              <span>Base Maps</span>
              <GlobeHemisphereWest className="w-3.5 h-3.5 text-stone-500" />
            </p>
            <div className="space-y-1 pt-1">
              {tileNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onSelectTile(name);
                    setOpenMenu('none');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer text-left ${
                    activeTileName === name
                      ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                      : 'hover:bg-stone-800 text-stone-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GlobeHemisphereWest
                      className={`w-4 h-4 ${
                        activeTileName === name ? 'text-amber-400' : 'text-stone-400'
                      }`}
                    />
                    <span>{name}</span>
                  </span>
                  {activeTileName === name && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CATEGORIZED LAYERS ACCORDION MENU */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'layers' ? 'none' : 'layers'))}
          className="px-3 py-1.5 bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold text-stone-200 flex items-center gap-2 cursor-pointer"
        >
          <Stack className="w-4 h-4 text-amber-400" weight="duotone" />
          <span>Layers</span>
          <CaretDown
            className={`w-3 h-3 text-stone-400 transition-transform ${
              openMenu === 'layers' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openMenu === 'layers' && (
          <div className="w-64 bg-stone-900/95 border border-stone-700/80 rounded-xl shadow-2xl backdrop-blur-md p-2.5 space-y-2 z-[1200] absolute right-0 top-full mt-2 text-xs text-stone-200 max-h-[75vh] overflow-y-auto">
            {/* 1. AIRBASES */}
            <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
              <button
                type="button"
                onClick={() => setOpenAirbases((v) => !v)}
                className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <AirplaneTakeoff className="w-4 h-4 text-sky-400" weight="duotone" />
                  <span>Airbases</span>
                </span>
                <CaretDown className={`w-3 h-3 text-stone-400 ${openAirbases ? 'rotate-180' : ''}`} />
              </button>
              {openAirbases && (
                <div className="p-1.5 space-y-1">
                  {(
                    [
                      ['airbasesBlue', 'Blue', 'text-sky-400'],
                      ['airbasesRed', 'Red', 'text-red-500'],
                      ['airbasesNeutral', 'Neutral', 'text-stone-400'],
                    ] as const
                  ).map(([key, label, colCls]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-stone-300">
                        <AirplaneTakeoff className={`w-4 h-4 ${colCls}`} weight="duotone" />
                        <span>{label}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={layerStates[key]}
                        onChange={() => onToggleLayer(key)}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 2. AIRFIELD PROCEDURES */}
            <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
              <button
                type="button"
                onClick={() => setOpenProcedures((v) => !v)}
                className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Path className="w-4 h-4 text-cyan-400" weight="duotone" />
                  <span>Airfield Procedures</span>
                </span>
                <CaretDown
                  className={`w-3 h-3 text-stone-400 ${openProcedures ? 'rotate-180' : ''}`}
                />
              </button>
              {openProcedures && (
                <div className="p-1.5 space-y-1">
                  <label className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer border-b border-stone-800/70 pb-1.5 mb-1">
                    <span className="flex items-center gap-2 text-stone-200 font-semibold">
                      <Stack className="w-4 h-4 text-cyan-400" weight="duotone" />
                      <span>All Procedures</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={allProceduresEnabled}
                      onChange={() => onToggleAllProcedures(!allProceduresEnabled)}
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                  {(
                    [
                      ['airbaseProceduresDeparture', 'Departures (SID)', 'bg-sky-400'],
                      ['airbaseProceduresArrival', 'Arrivals (STAR)', 'bg-cyan-400'],
                      ['airbaseProceduresApproach', 'Approaches (IAP)', 'bg-emerald-400'],
                      ['airbaseProceduresPattern', 'Overhead Patterns', 'bg-purple-400'],
                    ] as const
                  ).map(([key, label, dotCls]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-stone-300">
                        <span className={`w-2.5 h-2.5 rotate-45 rounded-[1px] ${dotCls} inline-block`} />
                        <span>{label}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={layerStates[key]}
                        onChange={() => onToggleLayer(key)}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 3. TERRAIN */}
            <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
              <button
                type="button"
                onClick={() => setOpenTerrain((v) => !v)}
                className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Mountains className="w-4 h-4 text-emerald-400" weight="duotone" />
                  <span>Terrain</span>
                </span>
                <CaretDown className={`w-3 h-3 text-stone-400 ${openTerrain ? 'rotate-180' : ''}`} />
              </button>
              {openTerrain && (
                <div className="p-1.5 space-y-1">
                  <label className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer">
                    <span className="flex items-center gap-2 text-stone-300">
                      <PencilSimple className="w-4 h-4 text-amber-400" weight="duotone" />
                      <span>Tactical Markings</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={layerStates.tacticalMarkings}
                      onChange={() => onToggleLayer('tacticalMarkings')}
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer">
                    <span className="flex items-center gap-2 text-stone-300">
                      <Compass className="w-4 h-4 text-amber-400" weight="duotone" />
                      <span>Navigation Aids</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={layerStates.navaids}
                      onChange={() => onToggleLayer('navaids')}
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* 4. MISSION */}
            <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
              <button
                type="button"
                onClick={() => setOpenMission((v) => !v)}
                className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-amber-400" weight="duotone" />
                  <span>Mission</span>
                </span>
                <CaretDown className={`w-3 h-3 text-stone-400 ${openMission ? 'rotate-180' : ''}`} />
              </button>
              {openMission && (
                <div className="p-1.5 space-y-1">
                  {(
                    [
                      ['bullseye', 'Bullseye', <CrosshairSimple key="b" className="w-4 h-4 text-red-500" />],
                      ['frontline', 'Front Line', <Path key="f" className="w-4 h-4 text-red-400" />],
                      ['supportAssets', 'Support Assets', <ShieldCheck key="s" className="w-4 h-4 text-indigo-400" />],
                      ['threats', 'Threats', <WarningDiamond key="t" className="w-4 h-4 text-rose-500" />],
                      ['missions', 'Missions', <AirplaneTilt key="m" className="w-4 h-4 text-amber-400" />],
                      ['flightPlans', 'Flight Plans', <Path key="p" className="w-4 h-4 text-sky-400" />],
                    ] as Array<[keyof PortalLayerStates, string, React.ReactNode]>
                  ).map(([key, label, icon]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-stone-300">
                        {icon}
                        <span>{label}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={layerStates[key]}
                        onChange={() => onToggleLayer(key)}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 5. AREAS OF OPERATIONS */}
            {polygonGroups.length > 0 && (
              <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
                <button
                  type="button"
                  onClick={() => setOpenAreas((v) => !v)}
                  className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Polygon className="w-4 h-4 text-amber-400" weight="duotone" />
                    <span>Areas of Operations</span>
                    <span className="text-[10px] text-stone-400 font-normal">
                      ({polygonGroups.length})
                    </span>
                  </span>
                  <CaretDown className={`w-3 h-3 text-stone-400 ${openAreas ? 'rotate-180' : ''}`} />
                </button>
                {openAreas && (
                  <div className="p-1.5 space-y-1">
                    <label className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer border-b border-stone-800/60 pb-1.5 mb-1">
                      <span className="text-stone-300 font-medium">All Areas</span>
                      <input
                        type="checkbox"
                        checked={allPolygonEnabled}
                        onChange={() => onToggleAllPolygonGroups(!allPolygonEnabled)}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                    </label>
                    {polygonGroups.map((pg, idx) => {
                      const id = pg.group_name || pg.name || `ao_${idx}`;
                      const checked = polygonGroupStates[id] !== false;
                      return (
                        <label
                          key={id}
                          className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer"
                        >
                          <span className="flex items-center gap-2 text-stone-300 min-w-0 pr-2">
                            <span
                              className="w-3 h-3 rounded-sm border shrink-0"
                              style={{
                                backgroundColor: pg.fill_color || pg.color || '#3388ff',
                                borderColor: pg.color || '#3388ff',
                              }}
                            />
                            <span className="truncate font-medium text-stone-200">
                              {pg.label || pg.name || id}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleSinglePolygonGroup(id)}
                            className="accent-amber-500 rounded cursor-pointer shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 6. LOGISTICS */}
            <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900/60">
              <button
                type="button"
                onClick={() => setOpenLogistics((v) => !v)}
                className="w-full px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 font-bold flex items-center justify-between border-b border-stone-800 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" weight="duotone" />
                  <span>Logistics</span>
                </span>
                <CaretDown
                  className={`w-3 h-3 text-stone-400 ${openLogistics ? 'rotate-180' : ''}`}
                />
              </button>
              {openLogistics && (
                <div className="p-1.5">
                  <label className="flex items-center justify-between p-1.5 hover:bg-stone-800/60 rounded cursor-pointer">
                    <span className="flex items-center gap-2 text-stone-300">
                      <Truck className="w-4 h-4 text-amber-400" weight="duotone" />
                      <span>Logistics Missions</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={layerStates.logistics}
                      onChange={() => onToggleLayer('logistics')}
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Refresh */}
      <button
        type="button"
        onClick={onManualRefresh}
        disabled={isLoading}
        title="Refresh Map Data"
        className="p-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 text-stone-300 hover:text-amber-300 shadow-xl backdrop-blur-md cursor-pointer"
      >
        <ArrowsClockwise className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
