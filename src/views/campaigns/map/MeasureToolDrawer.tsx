import React from 'react';
import {
  ArrowCounterClockwise,
  Compass,
  Gauge,
  MapPin,
  Ruler,
  Trash,
} from '@phosphor-icons/react';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  calculateBearingDegrees,
  calculateDistanceKm,
  calculateDistanceNm,
  formatCoordinateDdm,
  formatDurationSeconds,
  getMagneticDeclination,
  trueToMagnetic,
} from './geodesy';

export interface MeasurePoint {
  lat: number;
  lng: number;
  label?: string;
}

interface MeasureToolDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  points: MeasurePoint[];
  unit: 'nm' | 'km';
  onToggleUnit: (unit: 'nm' | 'km') => void;
  speedInput: string;
  onSpeedChange: (val: string) => void;
  onUndoLast: () => void;
  onClear: () => void;
  campaignDate?: string | null;
  theatreDeclination?: number | null;
  isPicking: boolean;
  onTogglePicking: () => void;
}

function formatTotalHms(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MeasureToolDrawer: React.FC<MeasureToolDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1130,
  onFocus,
  points,
  unit,
  onToggleUnit,
  speedInput,
  onSpeedChange,
  onUndoLast,
  onClear,
  campaignDate,
  theatreDeclination,
  isPicking,
  onTogglePicking,
}) => {
  if (!isOpen) return null;

  const parsedSpeed = Number(speedInput);
  const validSpeed = Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 0;

  let cumulativeNm = 0;
  let cumulativeKm = 0;
  let totalTimeSec = 0;

  const legs = points.slice(1).map((pt, index) => {
    const prev = points[index];
    const distNm = calculateDistanceNm(prev.lat, prev.lng, pt.lat, pt.lng);
    const distKm = calculateDistanceKm(prev.lat, prev.lng, pt.lat, pt.lng);
    cumulativeNm += distNm;
    cumulativeKm += distKm;
    const legDistForUnit = unit === 'km' ? distKm : distNm;
    const legTimeSec = validSpeed > 0 ? (legDistForUnit / validSpeed) * 3600 : null;
    if (legTimeSec !== null) {
      totalTimeSec += legTimeSec;
    }
    const bearingTrue = Math.round(calculateBearingDegrees(prev.lat, prev.lng, pt.lat, pt.lng)) % 360;
    const decl = getMagneticDeclination(prev.lat, prev.lng, campaignDate, theatreDeclination);
    const bearingMag = trueToMagnetic(bearingTrue, decl);
    return {
      legNumber: index + 1,
      fromLabel: prev.label || `PT ${index + 1}`,
      toLabel: pt.label || `PT ${index + 2}`,
      bearingTrue: String(bearingTrue === 0 ? 360 : bearingTrue).padStart(3, '0'),
      bearingMag: String(bearingMag === 0 ? 360 : bearingMag).padStart(3, '0'),
      distNm,
      distKm,
      cumulativeNm,
      cumulativeKm,
      eteLabel: legTimeSec !== null ? formatDurationSeconds(legTimeSec) : '--:--',
    };
  });

  const totalDisplay =
    unit === 'km' ? `${cumulativeKm.toFixed(1)} km` : `${cumulativeNm.toFixed(1)} NM`;
  const totalEteDisplay =
    legs.length === 0
      ? '00:00:00'
      : validSpeed > 0
        ? formatTotalHms(totalTimeSec)
        : '--:--:--';

  return (
    <FloatingToolWindow
      title="Ruler & Bearing Tool"
      icon={<Ruler className="w-4 h-4 text-amber-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 520, y: 120 }}
      widthClass="w-[380px] max-w-[92vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onTogglePicking}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isPicking
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-600'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {isPicking ? 'Click Map to Add Point' : 'Resume Map Click'}
          </button>

          <div className="flex items-center bg-stone-950 border border-stone-800 rounded-lg p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => onToggleUnit('nm')}
              className={`px-2 py-1 rounded cursor-pointer ${
                unit === 'nm' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              NM
            </button>
            <button
              type="button"
              onClick={() => onToggleUnit('km')}
              className={`px-2 py-1 rounded cursor-pointer ${
                unit === 'km' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              KM
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndoLast}
              disabled={points.length === 0}
              className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Undo Last Point"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={points.length === 0}
              className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 hover:text-red-400 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Clear Measurement"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-stone-950/70 border border-stone-800/80 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
              Total Distance ({legs.length} {legs.length === 1 ? 'leg' : 'legs'})
            </div>
            <div className="text-lg font-mono font-bold text-amber-400">{totalDisplay}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
              Est. Travel Time
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400">{totalEteDisplay}</div>
          </div>
        </div>

        {/* Speed Input Row */}
        <div className="bg-stone-950/70 border border-stone-800/80 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <label className="text-stone-300 font-semibold text-xs whitespace-nowrap flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-amber-400" weight="duotone" />
            <span>Speed ({unit === 'km' ? 'kph' : 'kts'}):</span>
          </label>
          <input
            type="number"
            min={1}
            max={5000}
            step={10}
            value={speedInput}
            onChange={(e) => onSpeedChange(e.target.value)}
            placeholder={unit === 'km' ? '648' : '350'}
            className="w-24 bg-stone-950 border border-stone-700 rounded-md px-2 py-1 text-stone-100 text-xs font-mono font-bold focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-right outline-none"
          />
        </div>

        {points.length === 0 ? (
          <div className="text-xs text-stone-400 bg-stone-900/50 border border-stone-800/60 rounded-lg p-3 leading-relaxed">
            Click anywhere on the campaign map to place your starting anchor, then click additional
            points to measure multi-leg distances, Magnetic/True headings, and estimated travel time.
          </div>
        ) : (
          <div className="space-y-2">
            {legs.length > 0 && (
              <div className="border border-stone-800 rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-stone-950 text-stone-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Leg</th>
                      <th className="px-1.5 py-1.5 text-right">HDG (M/T)</th>
                      <th className="px-1.5 py-1.5 text-right">Leg</th>
                      <th className="px-1.5 py-1.5 text-right">Total</th>
                      <th className="px-2 py-1.5 text-right">ETE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/70 bg-stone-900/40">
                    {legs.map((leg) => (
                      <tr key={leg.legNumber} className="hover:bg-stone-800/40">
                        <td className="px-2 py-1.5 font-medium text-stone-200 whitespace-nowrap">
                          {leg.fromLabel} → {leg.toLabel}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-sky-300 whitespace-nowrap">
                          {leg.bearingMag}° / {leg.bearingTrue}°
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono text-stone-300 whitespace-nowrap">
                          {unit === 'km'
                            ? `${leg.distKm.toFixed(1)}km`
                            : `${leg.distNm.toFixed(1)}nm`}
                        </td>
                        <td className="px-1.5 py-1.5 text-right font-mono font-semibold text-amber-300 whitespace-nowrap">
                          {unit === 'km'
                            ? `${leg.cumulativeKm.toFixed(1)}`
                            : `${leg.cumulativeNm.toFixed(1)}`}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-emerald-400 whitespace-nowrap">
                          {leg.eteLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {points.map((pt, i) => (
                <div
                  key={`${pt.lat}-${pt.lng}-${i}`}
                  className="flex items-center justify-between text-[11px] bg-stone-900/60 border border-stone-800/70 rounded px-2.5 py-1"
                >
                  <span className="font-semibold text-stone-300">
                    <Compass className="w-3 h-3 inline mr-1 text-amber-400" />
                    PT {i + 1}
                  </span>
                  <span className="font-mono text-stone-400">
                    {formatCoordinateDdm(pt.lat, pt.lng)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FloatingToolWindow>
  );
};
