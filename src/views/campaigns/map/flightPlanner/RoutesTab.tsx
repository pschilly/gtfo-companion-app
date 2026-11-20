import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  AirplaneLanding,
  CaretDown,
  CaretUp,
  Clock,
  DotsSixVertical,
  MagnifyingGlass,
  MapPin,
  MapPinArea,
  Path,
  Plus,
} from '@phosphor-icons/react';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  CampaignMapProcedure,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../../types';
import { parseAnyCoordinate } from '../geodesy';
import {
  autoParseCoordinateOrLocation,
  calculateRouteStats,
  getAvailableSequences,
  getMaxSequences,
  getSequenceColor,
  isAdditionalPoint,
  isDivertPoint,
  isF14Airframe,
  isF16Airframe,
  isFixPoint,
  isSequenceTrackPoint,
  isTargetPoint,
} from './helpers';

interface RoutesTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  unit: 'nm' | 'km';
  activeSequence: number;
  setActiveSequence: (seq: number) => void;
  userCreatedSequences: number[];
  onAddSequence: () => void;
  onDeleteSequence: (seq: number) => void;
  sequenceColors: Record<number, string>;
  onSetSequenceColor: (seq: number, color: string) => void;
  onAddPointFromCoords: (lat: number, lng: number, name?: string) => void;
  onApplyProcedure: (
    proc: CampaignMapProcedure,
    mode: 'auto' | 'prepend' | 'append',
    targetSeq?: number
  ) => void;
  onPanToPoint: (globalIdx: number) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onReorderWaypoints: (seq: number, fromSeqIdx: number, toSeqIdx: number) => void;
  onDeletePoint: (globalIdx: number) => void;
  onSetWaypointSequence: (globalIdx: number, seq: number) => void;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

type SearchSuggestion =
  | {
      type: 'airfield';
      name: string;
      code: string;
      lat: number;
      lng: number;
    }
  | {
      type: 'navaid';
      ident: string;
      mgrs: string;
      lat: number;
      lng: number;
    }
  | {
      type: 'procedure';
      name: string;
      airbase_name: string;
      proc_type: string;
      runway?: string | null;
      color: string;
      procedure: CampaignMapProcedure;
    };

export const RoutesTab: React.FC<RoutesTabProps> = ({
  plan,
  mapData,
  selectedAirframe,
  canEdit,
  unit,
  activeSequence,
  setActiveSequence,
  userCreatedSequences,
  onAddSequence,
  onDeleteSequence,
  sequenceColors,
  onSetSequenceColor,
  onAddPointFromCoords,
  onApplyProcedure,
  onPanToPoint,
  onCenterMap,
  onReorderWaypoints,
  onDeletePoint,
  onSetWaypointSequence,
  onMutatePlan,
  onNotify,
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  const [showProceduresModal, setShowProceduresModal] = useState(false);
  const [procedureSearch, setProcedureSearch] = useState('');
  const procWrapRef = useRef<HTMLDivElement | null>(null);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const isF14 = isF14Airframe(plan, selectedAirframe);
  const isF16 = isF16Airframe(plan, selectedAirframe);
  const maxSeqs = getMaxSequences(isF14);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (procWrapRef.current && !procWrapRef.current.contains(e.target as Node)) {
        setShowProceduresModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, []);

  const points = plan.route_points || [];
  const sequencesList = useMemo(
    () => getAvailableSequences(points, userCreatedSequences),
    [points, userCreatedSequences]
  );

  const sequenceSummaries = useMemo(
    () =>
      sequencesList.map((s) => {
        const sPts = points.filter((p) => !isTargetPoint(p) && !isDivertPoint(p) && (Number(p.sequence || 1) === s));
        const dep =
          sPts.find((p) => String(p.type || '').toUpperCase() === 'DEP')?.name ||
          (String(sPts[0]?.type || '').toUpperCase() === 'DEP' ? sPts[0]?.name : null);
        const arr =
          sPts.find((p) => String(p.type || '').toUpperCase() === 'ARR')?.name ||
          (String(sPts[sPts.length - 1]?.type || '').toUpperCase() === 'ARR'
            ? sPts[sPts.length - 1]?.name
            : null);
        return {
          number: s,
          count: sPts.length,
          departure: dep || null,
          destination: arr || null,
          color: getSequenceColor(s, plan.color, sequenceColors),
        };
      }),
    [sequencesList, points, plan.color, sequenceColors]
  );

  const currentSeqWaypoints = useMemo(() => {
    return points
      .map((wp, globalIdx) => ({ wp, globalIdx }))
      .filter(({ wp }) => !isTargetPoint(wp) && !isDivertPoint(wp) && (Number(wp.sequence || 1) === activeSequence));
  }, [points, activeSequence]);

  const nonDivertWpCount = useMemo(
    () => points.filter((p) => !isTargetPoint(p) && !isDivertPoint(p)).length,
    [points]
  );

  const stats = useMemo(
    () => calculateRouteStats(points, unit, activeSequence),
    [points, unit, activeSequence]
  );

  const isCoordQuery = useMemo(() => {
    const q = query.trim();
    if (!q) return false;
    return Boolean(parseAnyCoordinate(q));
  }, [query]);

  const suggestions: SearchSuggestion[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || isCoordQuery) return [];
    const results: SearchSuggestion[] = [];

    const matchedBases = (mapData.airbases || [])
      .filter((a) => {
        const name = (a.name || '').toLowerCase();
        const code = (a.code || a.icao || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      })
      .slice(0, 5)
      .map((a) => ({
        type: 'airfield' as const,
        name: a.name,
        code: a.code || a.icao || '',
        lat: Number(a.lat),
        lng: Number(a.lng),
      }));
    results.push(...matchedBases);

    const matchedProcs: SearchSuggestion[] = [];
    (mapData.airbases || []).forEach((a) => {
      (a.procedures || []).forEach((p) => {
        const pName = (p.name || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        const rwy = (p.runway || '').toLowerCase();
        const pType = (p.type_label || p.type || '').toLowerCase();
        if (
          pName.includes(q) ||
          (aName.includes(q) &&
            (pType.includes(q) ||
              q.includes('proc') ||
              q.includes('sid') ||
              q.includes('star') ||
              q.includes('arr') ||
              q.includes('dep'))) ||
          (rwy && rwy.includes(q))
        ) {
          matchedProcs.push({
            type: 'procedure',
            name: p.name,
            airbase_name: a.name,
            proc_type: p.type_label || p.type || 'Procedure',
            runway: p.runway,
            color: p.color || '#38bdf8',
            procedure: p,
          });
        }
      });
    });
    results.push(...matchedProcs.slice(0, 4));

    const matchedNavaids = (mapData.navaids || [])
      .filter((n) => (n.ident || n.name || '').toLowerCase().includes(q))
      .slice(0, 5)
      .map((n) => ({
        type: 'navaid' as const,
        ident: n.ident || n.name || 'NAVAID',
        mgrs: n.mgrs || '',
        lat: Number(n.coordinates?.lat ?? n.lat ?? 0),
        lng: Number(n.coordinates?.lon ?? n.coordinates?.lng ?? n.lng ?? 0),
      }))
      .filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lng));
    results.push(...matchedNavaids);

    return results.slice(0, 10);
  }, [query, isCoordQuery, mapData.airbases, mapData.navaids]);

  const selectSuggestion = (item: SearchSuggestion) => {
    if (!canEdit) return;
    if (item.type === 'airfield') {
      const label = item.code ? `${item.name} (${item.code})` : item.name;
      onAddPointFromCoords(item.lat, item.lng, label);
    } else if (item.type === 'navaid') {
      onAddPointFromCoords(item.lat, item.lng, item.ident);
    } else if (item.type === 'procedure') {
      onApplyProcedure(item.procedure, 'auto', activeSequence);
    }
    setQuery('');
    setShowSuggestions(false);
  };

  const handleSearchEnter = () => {
    const q = query.trim();
    if (!q || !canEdit) return;
    if (!isCoordQuery && showSuggestions && suggestions.length > 0) {
      const idx = Math.max(0, Math.min(selectedIndex, suggestions.length - 1));
      selectSuggestion(suggestions[idx]);
      return;
    }
    const res = autoParseCoordinateOrLocation(q, mapData.airbases || [], mapData.navaids || []);
    if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng)) {
      onAddPointFromCoords(res.lat, res.lng, res.name);
      setQuery('');
      setShowSuggestions(false);
    } else {
      onNotify(
        'warning',
        'Could not find Airfield, NAVAID, or parse coordinate format.'
      );
    }
  };

  const availableProcedures = useMemo(() => {
    const currSummary = sequenceSummaries.find((s) => s.number === activeSequence);
    const depName = (currSummary?.departure || plan.departure_airfield || '').toLowerCase().trim();
    const destName = (currSummary?.destination || plan.destination_airfield || '').toLowerCase().trim();
    const results: Array<
      CampaignMapProcedure & {
        airbase_name: string;
        is_relevant: boolean;
        match_role: string | null;
      }
    > = [];

    (mapData.airbases || []).forEach((ab) => {
      if (!ab.procedures || ab.procedures.length === 0) return;
      const isDep = Boolean(depName && ab.name.toLowerCase().trim() === depName);
      const isDest = Boolean(destName && ab.name.toLowerCase().trim() === destName);
      ab.procedures.forEach((p) => {
        results.push({
          ...p,
          airbase_name: ab.name,
          is_relevant: isDep || isDest,
          match_role: isDep ? 'Departure Airfield' : isDest ? 'Destination Airfield' : null,
        });
      });
    });

    const sorted = results.sort((a, b) => (b.is_relevant ? 1 : 0) - (a.is_relevant ? 1 : 0));
    const q = procedureSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.airbase_name || '').toLowerCase().includes(q) ||
        (p.type || '').toLowerCase().includes(q) ||
        (p.runway || '').toLowerCase().includes(q)
    );
  }, [mapData.airbases, sequenceSummaries, activeSequence, plan.departure_airfield, plan.destination_airfield, procedureSearch]);

  const overhead = plan.overhead_pattern as Record<string, any> | null | undefined;
  const hasOverheadInitialInRoute = useMemo(() => {
    if (!overhead) return false;
    return points.some((p) => (p.name || '').toUpperCase().trim().includes('INITIAL'));
  }, [overhead, points]);

  const handleAddOverheadInitial = () => {
    if (!overhead || !canEdit) return;
    const wps: any[] = Array.isArray(overhead.waypoints) ? overhead.waypoints : [];
    const initWp =
      wps.find((w) => (w.name || '').toUpperCase() === 'INITIAL') || wps[0];
    if (!initWp || !Number.isFinite(Number(initWp.lat)) || !Number.isFinite(Number(initWp.lng))) {
      onNotify('warning', 'Overhead pattern has no valid INITIAL fix');
      return;
    }
    const newPt: FlightPlanRoutePoint = {
      index: points.length,
      name: initWp.name || 'INITIAL',
      type: 'FIX',
      is_fix: true,
      lat: Number(initWp.lat),
      lng: Number(initWp.lng),
      alt: Number(initWp.alt || overhead.altitude_ft || 1500),
      speed: Number(initWp.speed || overhead.speed_kts || 300),
      sequence: activeSequence,
      remarks: `${overhead.name || 'Overhead'} Initial`,
    };
    onMutatePlan((prev) => {
      const cur = [...(prev.route_points || [])];
      const seqPts = cur.filter((p) => isSequenceTrackPoint(p, activeSequence));
      const arrPt = seqPts.find((p) => String(p.type || '').toUpperCase() === 'ARR');
      if (arrPt) {
        const arrGlobalIdx = cur.indexOf(arrPt);
        cur.splice(arrGlobalIdx, 0, newPt);
      } else if (seqPts.length > 0) {
        const lastIdx = cur.indexOf(seqPts[seqPts.length - 1]);
        cur.splice(lastIdx + 1, 0, newPt);
      } else {
        cur.push(newPt);
      }
      return { ...prev, route_points: cur.map((p, i) => ({ ...p, index: i })) };
    });
  };

  return (
    <div className="space-y-3">
      {/* Search / Quick Add Waypoint Bar */}
      <div ref={searchWrapRef} className="relative">
        <div className="flex items-center rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 focus-within:border-amber-400">
          <MagnifyingGlass className="size-4 text-stone-400 mr-2 shrink-0" weight="duotone" />
          <input
            type="text"
            disabled={!canEdit}
            value={query}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchEnter();
              } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setSelectedIndex((selectedIndex + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setSelectedIndex((selectedIndex - 1 + suggestions.length) % suggestions.length);
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search Airfield, NAVAID, or paste coordinates (LLDM, DMS, MGRS)..."
            className="w-full bg-transparent text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 z-50 mt-1 bg-stone-950 border border-stone-700 rounded-md shadow-2xl max-h-60 overflow-y-auto divide-y divide-stone-800">
            {suggestions.map((item, idx) => (
              <div
                key={`${item.type}-${idx}`}
                onClick={() => selectSuggestion(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                  selectedIndex === idx
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-stone-200 hover:bg-stone-800'
                }`}
              >
                {item.type === 'airfield' && (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-amber-400">✈️</span>
                      <span className="font-bold text-stone-100 truncate">{item.name}</span>
                    </div>
                    {item.code && (
                      <span className="ml-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">
                        {item.code}
                      </span>
                    )}
                  </div>
                )}
                {item.type === 'navaid' && (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">▲</span>
                      <span className="font-bold font-mono text-amber-300">{item.ident}</span>
                    </div>
                    {item.mgrs && (
                      <span className="font-mono text-[10px] text-stone-400">{item.mgrs}</span>
                    )}
                  </div>
                )}
                {item.type === 'procedure' && (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rotate-45 rounded-[1px] border border-stone-200 shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-bold text-cyan-300 truncate">{item.name}</span>
                      <span className="text-[10px] text-stone-400 truncate">
                        {item.airbase_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {item.proc_type}
                      </span>
                      {item.runway && (
                        <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                          RWY {item.runway}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Card Route Stats Bar */}
      <div className="grid grid-cols-3 gap-2 py-1">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/90 border border-stone-800">
          <div className="p-1.5 rounded bg-slate-800 text-slate-300">
            <MapPin className="size-4" weight="duotone" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 uppercase font-bold block">Waypoints</span>
            <span className="text-xs font-mono font-bold text-white">{stats.count}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/90 border border-stone-800">
          <div className="p-1.5 rounded bg-sky-950 text-sky-400">
            <Path className="size-4" weight="duotone" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 uppercase font-bold block">Distance</span>
            <span className="text-xs font-mono font-bold text-white">{stats.distDisplay}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-stone-900/90 border border-stone-800">
          <div className="p-1.5 rounded bg-amber-950 text-amber-400">
            <Clock className="size-4" weight="duotone" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 uppercase font-bold block">Est. Time</span>
            <span className="text-xs font-mono font-bold text-white">{stats.timeDisplay}</span>
          </div>
        </div>
      </div>

      {/* Sequence Selector & Color Controls */}
      <div className="flex items-center justify-between bg-stone-900/90 p-1.5 rounded-lg border border-stone-800 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {sequenceSummaries.map((seq) => (
            <div
              key={seq.number}
              style={{ borderColor: seq.color }}
              className={`flex items-center rounded-md border text-xs transition-all overflow-hidden ${
                activeSequence === seq.number
                  ? 'bg-stone-950 text-white shadow-sm ring-1 ring-amber-400/50'
                  : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:bg-stone-800/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSequence(seq.number)}
                className="px-2 py-1 font-bold flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <span>
                  {isF14 ? 'Plan ' : 'Seq '}
                  {seq.number}
                </span>
                <span className="font-mono text-[10px] text-stone-400">({seq.count})</span>
              </button>

              {canEdit && (
                <div
                  className="px-1.5 py-0.5 border-l border-stone-800 flex items-center bg-stone-950/40"
                  title="Change Sequence Color"
                >
                  <input
                    type="color"
                    value={seq.color}
                    onChange={(e) => onSetSequenceColor(seq.number, e.target.value)}
                    className="w-4 h-4 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                </div>
              )}

              {seq.number > 1 && canEdit && (
                <button
                  type="button"
                  onClick={() => onDeleteSequence(seq.number)}
                  className="px-1.5 py-0.5 text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border-l border-stone-800 font-bold text-sm cursor-pointer"
                  title={`Delete ${isF14 ? 'Plan' : 'Sequence'} ${seq.number}`}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && sequencesList.length < maxSeqs && (
          <button
            type="button"
            onClick={onAddSequence}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="size-3" weight="bold" />
            <span>{isF14 ? 'Add Plan' : 'Add Seq'}</span>
          </button>
        )}
      </div>

      {/* Recovery / Overhead Pattern Card */}
      <div className="rounded-lg bg-stone-900/90 border border-purple-900/40 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded bg-purple-950 text-purple-400 border border-purple-800/60 shrink-0">
              <AirplaneLanding className="size-3.5" weight="duotone" />
            </span>
            <div>
              <div className="text-[11px] font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Recovery Pattern</span>
                {overhead && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Assigned
                  </span>
                )}
              </div>
              <div className="text-[10px] text-stone-400">Overhead visual circuit parameters</div>
            </div>
          </div>

          {overhead ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const wps: any[] = Array.isArray(overhead.waypoints) ? overhead.waypoints : [];
                  const p0 =
                    wps.find((w) => (w.name || '').toUpperCase() === 'INITIAL') || wps[0];
                  if (p0 && Number.isFinite(Number(p0.lat)) && Number.isFinite(Number(p0.lng))) {
                    onCenterMap(Number(p0.lat), Number(p0.lng), 13);
                  }
                }}
                className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-medium border border-stone-700 transition-colors cursor-pointer"
              >
                Pan
              </button>
              {canEdit && !hasOverheadInitialInRoute && (
                <button
                  type="button"
                  onClick={handleAddOverheadInitial}
                  className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition-colors cursor-pointer"
                >
                  + INITIAL Fix
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onMutatePlan((p) => ({ ...p, overhead_pattern: null }))}
                  className="px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[10px] font-bold border border-red-800/50 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowProceduresModal(true);
                setProcedureSearch('overhead');
              }}
              className="px-2 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/70 text-purple-300 text-[10px] font-bold border border-purple-800/50 cursor-pointer"
            >
              Browse Overhead Patterns
            </button>
          )}
        </div>

        {overhead && (
          <div className="px-2 py-1 rounded bg-stone-950/70 border border-stone-800 text-[11px] flex items-center justify-between text-stone-300">
            <span className="font-bold text-purple-300 truncate">{overhead.name}</span>
            <span className="font-mono text-[10px] text-stone-400">
              {overhead.altitude_ft ? `${overhead.altitude_ft} ft` : '1,500 ft'} ·{' '}
              {overhead.speed_kts ? `${overhead.speed_kts} kts` : '300 kts'} ·{' '}
              {String(overhead.turn_direction || 'LEFT').toUpperCase()} BREAK
            </span>
          </div>
        )}
      </div>

      {/* Waypoint Placement Guide */}
      <div className="px-2.5 py-1.5 rounded bg-stone-950/70 border border-stone-800 text-[11px] text-stone-300 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono font-bold text-[10px] border border-stone-700 shadow-sm">
            CTRL + CLICK
          </kbd>
          <span>on the map to place / split a waypoint</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-stone-400">
          <span className="flex items-center gap-1 text-amber-400/90 font-medium">
            <DotsSixVertical className="size-3 inline" weight="bold" /> Drag to reorder
          </span>
          <span>•</span>
          <span>Alt+Click pin to delete</span>
        </div>
      </div>

      {/* Airfield Procedures Quick Insert */}
      <div ref={procWrapRef} className="space-y-1">
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-stone-900/80 border border-stone-800">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-300">
            <span className="text-amber-400 font-bold">SID/STAR:</span>
            <span className="text-stone-400">Load Airfield Procedures</span>
          </div>
          <button
            type="button"
            onClick={() => setShowProceduresModal((v) => !v)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Path className="size-3" weight="duotone" />
            <span>Procedures</span>
          </button>
        </div>

        {showProceduresModal && (
          <div className="p-2.5 rounded-lg bg-stone-950 border border-stone-700 shadow-2xl space-y-2 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-stone-200 uppercase tracking-wider">
                Select Procedure
              </span>
              <input
                type="text"
                value={procedureSearch}
                onChange={(e) => setProcedureSearch(e.target.value)}
                placeholder="Filter SID / STAR / IAP..."
                className="w-40 bg-stone-900 border border-stone-700 rounded px-2 py-0.5 text-[10px] text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {availableProcedures.length === 0 ? (
                <div className="text-stone-500 text-[10px] italic p-2 text-center">
                  No airfield procedures found matching filter.
                </div>
              ) : (
                availableProcedures.map((p) => (
                  <div
                    key={p.id}
                    className="p-1.5 rounded bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.color || '#3b82f6' }}
                        />
                        <span className="font-bold text-stone-200 truncate">{p.name}</span>
                        <span
                          className={`text-[9px] uppercase px-1 py-0.2 rounded font-mono font-bold border ${
                            p.type === 'departure'
                              ? 'bg-blue-950 text-blue-300 border-blue-800'
                              : p.type === 'arrival'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : p.type === 'approach'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : 'bg-purple-950 text-purple-300 border-purple-800'
                          }`}
                        >
                          {p.type}
                        </span>
                        {p.match_role && (
                          <span className="text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded">
                            {p.match_role}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-stone-400 mt-0.5 flex items-center gap-2">
                        <span>{p.airbase_name}</span>
                        {p.runway && (
                          <span>
                            • RWY <span className="font-mono text-stone-200">{p.runway}</span>
                          </span>
                        )}
                        <span>
                          •{' '}
                          <span className="font-mono text-stone-200">
                            {(p.waypoints || []).length}
                          </span>{' '}
                          fixes
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyProcedure(p, 'auto', activeSequence);
                          setShowProceduresModal(false);
                        }}
                        className={`px-2 py-1 rounded font-bold text-[10px] transition-colors shadow-sm cursor-pointer shrink-0 ${
                          p.type === 'overhead_pattern'
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                        }`}
                      >
                        {p.type === 'overhead_pattern' ? '+ Assign Pattern' : '+ Apply'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* F-16 NAV PTS Banner */}
      {isF16 && (
        <div className="px-2.5 py-1.5 rounded bg-stone-950/80 border border-stone-800 text-[11px] text-stone-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sky-400 font-bold">NAV PTS:</span>
            <span className="text-stone-400">Steerpoints 1–25:</span>
            <span
              className={`font-mono font-bold ${
                nonDivertWpCount > 25 ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              {nonDivertWpCount} / 25
            </span>
          </div>
          <span className="text-[10px] text-stone-400">
            Routes 1, 2, or 3 (mutually exclusive)
          </span>
        </div>
      )}

      {/* Waypoint List Table */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {currentSeqWaypoints.length === 0 ? (
          <div className="text-center p-4 text-stone-500 italic text-xs bg-stone-900/50 rounded-lg border border-stone-800">
            No waypoints in {isF14 ? 'Plan ' : 'Sequence '}
            {activeSequence}. Ctrl+Click the map to place waypoints.
          </div>
        ) : (
          currentSeqWaypoints.map(({ wp, globalIdx }, idx) => {
            const seqColor = getSequenceColor(
              Number(wp.sequence || 1),
              plan.color,
              sequenceColors
            );
            const fix = isFixPoint(wp);
            const additional = isAdditionalPoint(wp);
            const typeUp = String(wp.type || '').toUpperCase();

            return (
              <div
                key={`seq-${activeSequence}-wp-${globalIdx}`}
                draggable={canEdit}
                onDragStart={(e) => {
                  if (!canEdit) return;
                  if ((e.target as HTMLElement).closest('button, select, input, a')) {
                    e.preventDefault();
                    return;
                  }
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                onDragOver={(e) => {
                  if (draggedIdx === null || draggedIdx === idx) return;
                  e.preventDefault();
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) setDragOverIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draggedIdx;
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                  if (from === null || from === idx) return;
                  onReorderWaypoints(activeSequence, from, idx);
                }}
                className={`flex items-center justify-between p-2 rounded-lg bg-stone-900/90 border text-xs gap-2 transition-all duration-150 relative select-none group/row ${
                  canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                } ${
                  dragOverIdx === idx
                    ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400 scale-[1.01]'
                    : 'border-stone-800 hover:border-stone-700'
                } ${draggedIdx === idx ? 'opacity-30 scale-[0.98]' : ''}`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {canEdit && (
                    <div
                      className="text-stone-500 hover:text-amber-400 py-0.5 pr-0.5 shrink-0 flex items-center justify-center"
                      title="Click & drag to reorder waypoint"
                    >
                      <DotsSixVertical
                        className="size-3.5 opacity-50 group-hover/row:opacity-100 group-hover/row:text-amber-400 transition-opacity shrink-0"
                        weight="bold"
                      />
                    </div>
                  )}

                  {fix ? (
                    <span
                      style={{ backgroundColor: seqColor }}
                      className="w-4 h-4 rotate-45 rounded-[2px] text-white font-bold text-[9px] flex items-center justify-center shrink-0 border border-white/70 shadow-sm mr-0.5"
                      title={`Nav Fix: ${wp.name}`}
                    >
                      <span className="-rotate-45 block leading-none font-mono">{idx + 1}</span>
                    </span>
                  ) : (
                    <span
                      style={{ backgroundColor: seqColor }}
                      className="w-5 h-5 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 border border-white/40 shadow-sm"
                    >
                      {idx + 1}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onPanToPoint(globalIdx);
                        }}
                        className="font-bold text-stone-100 truncate cursor-pointer hover:text-amber-400"
                        title={wp.name || `WP${idx + 1}`}
                      >
                        {wp.name || (idx === 0 ? 'DEP' : `WP${idx + 1}`)}
                      </span>
                      {typeUp === 'DEP' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-700">
                          DEP
                        </span>
                      )}
                      {typeUp === 'ARR' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                          ARR
                        </span>
                      )}
                      {fix && typeUp !== 'DEP' && typeUp !== 'ARR' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                          FIX
                        </span>
                      )}
                      {additional && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700">
                          ADDITIONAL
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-stone-400 mt-0.5 flex gap-2">
                      <span>
                        {wp.alt
                          ? unit === 'km'
                            ? `${Math.round(Number(wp.alt) * 0.3048)} m`
                            : `${Math.round(Number(wp.alt))} ft`
                          : '—'}
                      </span>
                      <span>•</span>
                      <span>
                        {wp.speed
                          ? unit === 'km'
                            ? `${Math.round(Number(wp.speed) * 1.852)} kph`
                            : `${Math.round(Number(wp.speed))} kts`
                          : '—'}
                      </span>
                      {wp.tot && (
                        <span>
                          • TOT: <span className="text-amber-300">{wp.tot}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canEdit && (
                    <div className="flex items-center gap-0.5 mr-0.5 bg-stone-950/70 p-0.5 rounded border border-stone-800/80">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderWaypoints(activeSequence, idx, idx - 1);
                        }}
                        className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-20 text-stone-400 hover:text-amber-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Move up in route sequence"
                      >
                        <CaretUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= currentSeqWaypoints.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderWaypoints(activeSequence, idx, idx + 1);
                        }}
                        className="p-0.5 rounded hover:bg-stone-800 disabled:opacity-20 text-stone-400 hover:text-amber-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        title="Move down in route sequence"
                      >
                        <CaretDown className="size-3" />
                      </button>
                    </div>
                  )}

                  {isF16 && canEdit && (
                    <div
                      className="flex items-center gap-0.5 mr-1 bg-stone-950 p-0.5 rounded border border-stone-800"
                      title="Assign Steerpoint Route (1, 2, or 3)"
                    >
                      {([1, 2, 3] as const).map((rNum) => (
                        <button
                          key={rNum}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetWaypointSequence(globalIdx, rNum);
                          }}
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer ${
                            Number(wp.sequence || 1) === rNum
                              ? 'bg-amber-500 text-stone-950 shadow-sm'
                              : 'text-stone-400 hover:text-stone-200'
                          }`}
                          title={`Route ${rNum} (R${rNum})`}
                        >
                          R{rNum}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPanToPoint(globalIdx);
                    }}
                    className="p-1 rounded hover:bg-stone-800 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                    title="View on map"
                  >
                    <MapPinArea className="size-4" weight="duotone" />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePoint(globalIdx);
                      }}
                      className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-red-400 transition-colors font-bold text-sm cursor-pointer"
                      title="Remove waypoint"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
