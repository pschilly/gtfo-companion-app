import React, { useMemo, useState } from 'react';
import { Crosshair, Plus, Target, Trash } from '@phosphor-icons/react';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../../types';
import { formatCoordinateDdm, toMgrs } from '../geodesy';
import {
  autoParseCoordinateOrLocation,
  isF14Airframe,
  isTargetPoint,
} from './helpers';

interface TargetsTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  onAddTargetPoint: (
    coords: { lat: number; lng: number },
    customData?: Partial<FlightPlanRoutePoint>
  ) => void;
  onUpdateTarget: (globalIndex: number, patch: Partial<FlightPlanRoutePoint>) => void;
  onDeleteTarget: (globalIndex: number) => void;
  onPanToTarget: (globalIndex: number) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const TargetsTab: React.FC<TargetsTabProps> = ({
  plan,
  mapData,
  selectedAirframe,
  canEdit,
  onAddTargetPoint,
  onUpdateTarget,
  onDeleteTarget,
  onPanToTarget,
  onNotify,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState('');

  const isF14 = isF14Airframe(plan, selectedAirframe);

  const targetPoints = useMemo(
    () =>
      (plan.route_points || [])
        .map((wp, globalIndex) => ({ wp, globalIndex }))
        .filter(({ wp }) => isTargetPoint(wp)),
    [plan.route_points]
  );

  const handleQuickAdd = () => {
    const q = quickInput.trim();
    if (!q || !canEdit) return;
    setQuickError('');
    const parsed = autoParseCoordinateOrLocation(
      q,
      mapData.airbases || [],
      mapData.navaids || []
    );
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) {
      setQuickError(
        'Unrecognized coordinates. Supports MGRS (e.g. 37T DJ 12345 67890), DDM, DMS, Lat/Lon, or Airfield/NAVAID.'
      );
      return;
    }
    onAddTargetPoint(
      { lat: parsed.lat, lng: parsed.lng },
      parsed.name ? { name: parsed.name } : undefined
    );
    setQuickInput('');
    setQuickError('');
  };

  return (
    <div className="space-y-3">
      {/* Header Bar & Quick Add */}
      <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-red-950/80 text-red-400 border border-red-800/60">
              <Target className="size-4" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-200">Designated Target Points</h3>
              <p className="text-xs text-stone-400">
                Ground strike coordinates &amp; JDAM guidance data
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/40">
            {targetPoints.length} {targetPoints.length === 1 ? 'Target' : 'Targets'}
          </span>
        </div>

        <div className="p-2 rounded bg-stone-950/60 border border-stone-800 text-xs text-stone-300 flex items-start gap-2">
          <span className="text-amber-400 font-bold shrink-0 mt-0.5">💡</span>
          <div>
            <span className="font-semibold text-stone-200">How to designate targets:</span>
            <span className="text-stone-400">
              {' '}
              Right-click anywhere on the campaign map and select{' '}
              <strong className="text-red-400">Add Target</strong>, or enter coordinates below.
              Ground elevation is automatically queried from terrain elevation data.
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="p-2.5 rounded-lg bg-stone-950/80 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-red-500" />
                Quick Add Target by Coordinates
              </label>
              <span className="text-[11px] text-stone-500">
                MGRS • DDM • DMS • Lat/Lon
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAdd();
                    }
                  }}
                  placeholder="Paste coords (e.g. 37T DJ 12345 67890 or 42.123, 43.456)"
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-100 font-mono placeholder:text-stone-500 focus:border-red-500 focus:outline-none pr-6"
                />
                {quickInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickInput('');
                      setQuickError('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs cursor-pointer"
                    title="Clear"
                  >
                    &times;
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleQuickAdd}
                className="px-3 py-1.5 rounded bg-red-900/90 hover:bg-red-800 text-red-100 border border-red-700/80 text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              >
                <Plus className="size-3.5" weight="bold" />
                <span>Add Target</span>
              </button>
            </div>
            {quickError && (
              <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                {quickError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {targetPoints.length === 0 ? (
        <div className="p-6 rounded-lg bg-stone-900/60 border border-stone-800 text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-red-950/40 border border-red-900/50 text-red-400">
              <Target className="size-8" weight="duotone" />
            </div>
          </div>
          <h4 className="text-xs font-bold text-stone-300">No Target Points Designated</h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Right-click anywhere on the map or enter coordinates above to add target points for
            strike missions, JDAM drop planning, and air-to-ground tasking.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {targetPoints.map(({ wp, globalIndex }, tIdx) => {
            const dropAlt =
              wp.drop_alt !== undefined && wp.drop_alt !== null && wp.drop_alt !== ''
                ? wp.drop_alt
                : 30000;
            const elevVal =
              wp.elev !== undefined && wp.elev !== null && wp.elev !== '' && wp.elev !== dropAlt
                ? wp.elev
                : wp.alt && wp.alt !== dropAlt
                  ? wp.alt
                  : '';
            const mgrs = wp.mgrs || toMgrs(wp.lat, wp.lng, 5);
            const lldm = wp.lldm || wp.ddm || formatCoordinateDdm(wp.lat, wp.lng);

            return (
              <div
                key={`tgt-${globalIndex}`}
                className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800 hover:border-red-900/60 transition-colors space-y-2"
              >
                {/* Top Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-mono text-[11px] font-bold shrink-0">
                      TGT {tIdx + 1}
                    </span>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={wp.name || `TGT ${tIdx + 1}`}
                      onChange={(e) => onUpdateTarget(globalIndex, { name: e.target.value })}
                      placeholder="Target Name (e.g. STORAGEB)"
                      className="w-full max-w-[190px] bg-stone-950 border border-stone-700 rounded px-2 py-1 text-xs text-stone-100 font-bold uppercase focus:border-red-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPanToTarget(globalIndex)}
                      className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
                      title="Pan to target on map"
                    >
                      <Crosshair className="size-3.5 text-amber-400" weight="duotone" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onDeleteTarget(globalIndex)}
                        className="p-1 rounded bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-400 border border-transparent hover:border-red-800/60 transition-colors cursor-pointer"
                        title="Delete target"
                      >
                        <Trash className="size-3.5" weight="duotone" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Coordinates Row */}
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono bg-stone-950/70 p-1.5 rounded border border-stone-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(mgrs);
                      onNotify('info', `Copied MGRS: ${mgrs}`);
                    }}
                    className="text-stone-300 truncate hover:text-amber-300 text-left cursor-pointer"
                    title="Click to copy MGRS"
                  >
                    <span className="text-stone-500">MGRS: </span>
                    <span className="text-stone-200 font-bold">{mgrs}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(lldm);
                      onNotify('info', `Copied LLDM: ${lldm}`);
                    }}
                    className="text-stone-400 text-[11px] truncate hover:text-amber-300 text-right cursor-pointer"
                    title="Click to copy LLDM"
                  >
                    <span className="text-stone-500">LLDM: </span>
                    <span>{lldm}</span>
                  </button>
                </div>

                {/* 4-Column Target Strike Parameters */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                      Elev (ft)
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={elevVal}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        onUpdateTarget(globalIndex, {
                          elev: val,
                          alt: val === '' ? 0 : Number(val),
                        });
                      }}
                      placeholder="Ground elev"
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-mono focus:border-red-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">
                      Drop Alt (ft)
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={dropAlt}
                      onChange={(e) =>
                        onUpdateTarget(globalIndex, { drop_alt: Number(e.target.value) || 0 })
                      }
                      placeholder="30000"
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-mono focus:border-red-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                      Atk Hdg (°)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={360}
                      disabled={!canEdit}
                      value={wp.attack_heading ?? 0}
                      onChange={(e) =>
                        onUpdateTarget(globalIndex, {
                          attack_heading: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="198.1"
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-mono focus:border-red-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                      Drop Spd (kts)
                    </label>
                    <input
                      type="number"
                      disabled={!canEdit}
                      value={wp.drop_spd ?? 450}
                      onChange={(e) =>
                        onUpdateTarget(globalIndex, { drop_spd: Number(e.target.value) || 0 })
                      }
                      placeholder="450"
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-mono focus:border-red-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* Weapon & Station Row */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-800/60">
                  <div className={`space-y-0.5 ${isF14 ? '' : 'col-span-2'}`}>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">
                      Weapon
                    </label>
                    <input
                      type="text"
                      list="fp-target-weapon-suggestions"
                      disabled={!canEdit}
                      value={wp.weapon || 'GBU-38'}
                      onChange={(e) => onUpdateTarget(globalIndex, { weapon: e.target.value })}
                      placeholder="GBU-38"
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-semibold focus:border-sky-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {isF14 && (
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block">
                        Station (F-14)
                      </label>
                      <select
                        disabled={!canEdit}
                        value={String(wp.station || 'all')}
                        onChange={(e) => onUpdateTarget(globalIndex, { station: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-1 text-xs text-stone-200 font-semibold focus:border-purple-500 focus:outline-none disabled:opacity-60"
                      >
                        <option value="all">All Stations (3-6)</option>
                        <option value="3">STA 3 (Forward Right)</option>
                        <option value="4">STA 4 (Aft Right)</option>
                        <option value="5">STA 5 (Aft Left)</option>
                        <option value="6">STA 6 (Forward Left)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <datalist id="fp-target-weapon-suggestions">
        <option value="GBU-38">GBU-38 (500lb JDAM)</option>
        <option value="GBU-31">GBU-31 (2,000lb JDAM)</option>
        <option value="GBU-31(V)3/B">GBU-31(V)3/B (Penetrator JDAM)</option>
        <option value="GBU-12">GBU-12 (500lb Paveway II)</option>
        <option value="GBU-24">GBU-24 (2,000lb Paveway III)</option>
        <option value="GBU-10">GBU-10 (2,000lb Paveway II)</option>
        <option value="Mk-82">Mk-82 (500lb GP Bomb)</option>
        <option value="Mk-83">Mk-83 (1,000lb GP Bomb)</option>
        <option value="Mk-84">Mk-84 (2,000lb GP Bomb)</option>
        <option value="CBU-87">CBU-87 (CEM)</option>
        <option value="CBU-97">CBU-97 (SFW)</option>
        <option value="CBU-99">CBU-99 (Cluster Bomb)</option>
        <option value="AGM-65D">AGM-65D Maverick</option>
        <option value="AGM-65E">AGM-65E Laser Maverick</option>
        <option value="AGM-65F">AGM-65F IR Maverick</option>
      </datalist>
    </div>
  );
};
