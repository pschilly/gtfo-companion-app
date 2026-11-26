import React, { useEffect, useState } from 'react';
import {
  Check,
  Compass,
  Copy,
  Crosshair,
  MapPin,
} from '@phosphor-icons/react';
import { CampaignMapBullseye } from '../../../types';
import { fetchTerrainElevation } from '../../../services/campaignMapService';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  calculateBullseyeBraa,
  formatCoordinateDdm,
  formatCoordinateDec,
  formatCoordinateDms,
  getMagneticDeclination,
  parseAnyCoordinate,
  toMgrs,
} from './geodesy';

interface CoordinateConverterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  apiBaseUrl: string;
  token?: string | null;
  pickedCoords: { lat: number; lng: number } | null;
  activeBullseye: CampaignMapBullseye | null;
  campaignDate?: string | null;
  theatreDeclination?: number | null;
  unit: 'nm' | 'km';
  onCenterMap: (lat: number, lng: number) => void;
  hasActivePin?: boolean;
  onClearPin?: () => void;
  isPicking: boolean;
  onTogglePicking: () => void;
}

export const CoordinateConverterDrawer: React.FC<CoordinateConverterDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1120,
  onFocus,
  apiBaseUrl,
  token,
  pickedCoords,
  activeBullseye,
  campaignDate,
  theatreDeclination,
  unit,
  onCenterMap,
  hasActivePin = false,
  onClearPin,
  isPicking,
  onTogglePicking,
}) => {
  const [inputText, setInputText] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(pickedCoords);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [elevationFt, setElevationFt] = useState<number | null>(null);
  const [loadingElev, setLoadingElev] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (pickedCoords) {
      setCoords(pickedCoords);
      setInputText(formatCoordinateDec(pickedCoords.lat, pickedCoords.lng, 5));
      setParseStatus('Picked from map');
    }
  }, [pickedCoords]);

  useEffect(() => {
    let active = true;
    if (!isOpen || !coords) {
      setElevationFt(null);
      return;
    }
    setLoadingElev(true);
    fetchTerrainElevation(apiBaseUrl, coords.lat, coords.lng, token)
      .then((elev) => {
        if (active) setElevationFt(elev);
      })
      .finally(() => {
        if (active) setLoadingElev(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, coords, apiBaseUrl, token]);

  if (!isOpen) return null;

  const handleParse = (val: string) => {
    setInputText(val);
    if (!val.trim()) {
      setParseStatus(null);
      return;
    }
    const parsed = parseAnyCoordinate(val);
    if (parsed) {
      setCoords({ lat: parsed.lat, lng: parsed.lng });
      setParseStatus(`Detected ${parsed.detectedFormat}`);
    } else {
      setParseStatus('Unrecognized format (try MGRS, DDM, DMS, or Decimal)');
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const declination = coords
    ? getMagneticDeclination(coords.lat, coords.lng, campaignDate, theatreDeclination)
    : 0;

  const decStr = coords ? formatCoordinateDec(coords.lat, coords.lng, 5) : '---';
  const ddmStr = coords ? formatCoordinateDdm(coords.lat, coords.lng) : '---';
  const dmsStr = coords ? formatCoordinateDms(coords.lat, coords.lng) : '---';
  const mgrsStr = coords ? toMgrs(coords.lat, coords.lng, 5) : '---';
  const braa =
    coords && activeBullseye
      ? calculateBullseyeBraa(
          coords.lat,
          coords.lng,
          activeBullseye.lat,
          activeBullseye.lng,
          declination,
          unit
        )
      : null;

  const outputs = [
    { key: 'dec', label: 'Decimal (WGS84)', value: decStr },
    { key: 'ddm', label: 'DDM (Hornet / Viper)', value: ddmStr },
    { key: 'dms', label: 'DMS (Deg Min Sec)', value: dmsStr },
    { key: 'mgrs', label: 'MGRS Grid', value: mgrsStr },
  ];

  return (
    <FloatingToolWindow
      title="Coordinate Converter"
      icon={<Crosshair className="w-4 h-4 text-amber-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 520, y: 80 }}
      widthClass="w-[380px] max-w-[92vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              Universal Coordinate Input
            </label>
            <button
              onClick={onTogglePicking}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                isPicking
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-600'
              }`}
            >
              <MapPin className="w-3 h-3" />
              {isPicking ? 'Click Map...' : 'Pick on Map'}
            </button>
          </div>
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="36.2021, 37.1343 | 37S BV 42310 08920 | N36° 12.1' E037° 08.0'"
            className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60"
          />
          {parseStatus && (
            <div className="text-xs text-amber-300/90 font-medium">{parseStatus}</div>
          )}
        </div>

        <div className="space-y-2">
          {outputs.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-2 bg-stone-900/70 border border-stone-800/80 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                  {item.label}
                </div>
                <div className="text-xs font-mono text-stone-100 truncate select-text">
                  {item.value}
                </div>
              </div>
              <button
                onClick={() => handleCopy(item.key, item.value)}
                disabled={!coords}
                className="p-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 hover:text-amber-300 disabled:opacity-40"
                title={`Copy ${item.label}`}
              >
                {copiedKey === item.key ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-stone-900/70 border border-stone-800/80 rounded-lg px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
              Terrain Elevation
            </div>
            <div className="text-xs font-mono text-emerald-400 font-semibold">
              {loadingElev
                ? 'Querying...'
                : elevationFt !== null
                  ? `${elevationFt.toLocaleString()} ft MSL`
                  : '---'}
            </div>
          </div>

          <div className="bg-stone-900/70 border border-stone-800/80 rounded-lg px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
              Mag Var / Declination
            </div>
            <div className="text-xs font-mono text-sky-300 font-semibold">
              {coords
                ? `${Math.abs(declination).toFixed(1)}° ${declination >= 0 ? 'E' : 'W'}`
                : '---'}
            </div>
          </div>
        </div>

        {braa && activeBullseye && (
          <div className="bg-sky-950/25 border border-sky-800/40 rounded-lg px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-sky-400 font-semibold">
                Bullseye ({activeBullseye.name}) BRAA
              </div>
              <div className="text-xs font-mono font-semibold text-sky-200">{braa.formatted}</div>
            </div>
            <Compass className="w-4 h-4 text-sky-400" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => coords && onCenterMap(coords.lat, coords.lng)}
            disabled={!coords}
            className="flex-1 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase tracking-wider transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Center &amp; Ping Map Location
          </button>
          {hasActivePin && onClearPin && (
            <button
              type="button"
              onClick={onClearPin}
              className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-sky-300 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Clear converter map pin"
            >
              Clear Pin
            </button>
          )}
        </div>
      </div>
    </FloatingToolWindow>
  );
};
