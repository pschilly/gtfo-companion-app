import L from 'leaflet';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../types';
import {
  calculateBearingDegrees,
  calculateDistanceNm,
  casToTas,
  computeDestinationPoint,
  formatCoordinateDdm,
  formatCoordinateDms,
  getMagneticDeclination,
  toMgrs,
  trueToMagnetic,
} from './geodesy';
import {
  AvionicsDrawTarget,
  DoghouseConfig,
  F16_GEO_LINE_COLORS,
  JF17_DEFAULT_COLORS,
  SEQUENCE_DASH_PATTERNS,
  TickConfig,
  extractFrontLinePoints,
  getAvailableSequences,
  getSequenceColor,
  isAdditionalPoint,
  isDivertPoint,
  isFaorPointsClosed,
  isFixPoint,
  isSequenceTrackPoint,
  isTargetPoint,
  recalcF16DestPoints,
  recalcF16GeoLines,
  recalculateTransitSpeeds,
} from './flightPlanner/helpers';

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ActiveFlightPlanControllerCallbacks {
  onInsertOrAppendWaypoint: (latlng: L.LatLng, seq: number) => void;
  onCommitPoints: (nextPoints: FlightPlanRoutePoint[]) => void;
  onUpdatePoint: (index: number, patch: Partial<FlightPlanRoutePoint>) => void;
  onDeletePoint: (index: number) => void;
  onAutoFetchPointElevation: (index: number, lat: number, lng: number, isTarget: boolean) => void;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onAvionicsDrawClick?: (latlng: L.LatLng) => void;
}

export interface ActiveFlightPlanSyncParams {
  plan: FlightPlanDetail | null;
  airframe: CampaignMapAirframeCatalogItem | null;
  mapData: CampaignMapPayload | null;
  editable: boolean;
  isOpen: boolean;
  unit: 'nm' | 'km';
  activeSequence: number;
  userCreatedSequences: number[];
  sequenceColors: Record<number, string>;
  tickConfig: TickConfig;
  doghouseConfig: DoghouseConfig;
  activeDrawTarget: AvionicsDrawTarget | null;
  isF14: boolean;
  isF16: boolean;
  isF18: boolean;
  isJf17: boolean;
}

export class ActiveFlightPlanMapController {
  private map: L.Map;
  private rootGroup: L.LayerGroup;
  private linesGroup: L.LayerGroup;
  private markersGroup: L.LayerGroup;
  private avionicsGroup: L.LayerGroup;
  private callbacks: ActiveFlightPlanControllerCallbacks;

  private lastSyncParams: ActiveFlightPlanSyncParams | null = null;
  private workingPoints: FlightPlanRoutePoint[] = [];
  private markerList: L.Marker[] = [];
  private isDragging = false;
  private lastPolylineClickTime = 0;

  constructor(
    map: L.Map,
    rootGroup: L.LayerGroup,
    callbacks: ActiveFlightPlanControllerCallbacks
  ) {
    this.map = map;
    this.rootGroup = rootGroup;
    this.callbacks = callbacks;
    this.linesGroup = L.layerGroup().addTo(this.rootGroup);
    this.markersGroup = L.layerGroup().addTo(this.rootGroup);
    this.avionicsGroup = L.layerGroup().addTo(this.rootGroup);
  }

  public setCallbacks(callbacks: ActiveFlightPlanControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  public wasPolylineClickedRecently(): boolean {
    return Date.now() - this.lastPolylineClickTime < 400;
  }

  public getIsDragging(): boolean {
    return this.isDragging;
  }

  public panAndOpenPopup(pointIndex: number): void {
    const marker = this.markerList[pointIndex];
    if (marker && this.map) {
      this.map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  }

  public clear(): void {
    this.linesGroup.clearLayers();
    this.markersGroup.clearLayers();
    this.avionicsGroup.clearLayers();
    this.markerList = [];
    this.workingPoints = [];
  }

  public sync(params: ActiveFlightPlanSyncParams): void {
    this.lastSyncParams = params;
    if (this.isDragging) {
      // Never tear down markers/lines while actively dragging
      return;
    }

    if (!params.plan) {
      this.clear();
      return;
    }

    this.workingPoints = (params.plan.route_points || []).map((p) => ({ ...p }));
    this.rebuildMarkers();
    this.drawLinesOnly();
    this.renderAvionics();
  }

  private buildMarkerIcon(pt: FlightPlanRoutePoint, idx: number, openPopupIndex?: number): L.DivIcon {
    const params = this.lastSyncParams!;
    const isKm = params.unit === 'km';
    const flightName =
      params.plan?.callsign || params.plan?.name || params.plan?.identifier || 'Flight Plan';

    const target = isTargetPoint(pt);
    const additional = isAdditionalPoint(pt);
    const divert = isDivertPoint(pt);
    const fix = isFixPoint(pt);
    const seqNum = parseInt(String(pt.sequence || 1), 10) || 1;
    const markerColor = additional
      ? '#7e22ce'
      : divert
        ? '#d97706'
        : getSequenceColor(seqNum, params.plan?.color, params.sequenceColors);

    const parts: string[] = [];
    if (idx === 0) {
      parts.push(
        `<span class="text-blue-200 font-bold uppercase tracking-wider">${escapeHtml(flightName)}</span>`
      );
    }

    if (target) {
      parts.push(
        `<span class="text-[11px] font-bold text-red-300 bg-red-950/90 px-1.5 py-0.5 rounded border border-red-600">TARGET</span>`
      );
      if (pt.name) {
        parts.push(`<span class="text-red-400 font-bold uppercase tracking-wider">${escapeHtml(pt.name)}</span>`);
      }
      const tgtStats: string[] = [];
      if (pt.drop_alt !== undefined && pt.drop_alt !== null && pt.drop_alt !== '') {
        tgtStats.push(`Drop: ${escapeHtml(pt.drop_alt)}ft`);
      }
      if (pt.elev !== undefined && pt.elev !== null && pt.elev !== '') {
        tgtStats.push(`Elev: ${escapeHtml(pt.elev)}ft`);
      }
      if (pt.attack_heading !== undefined && pt.attack_heading !== null && pt.attack_heading !== '') {
        tgtStats.push(`Hdg: ${escapeHtml(pt.attack_heading)}°`);
      }
      if (tgtStats.length > 0) {
        parts.push(
          `<span class="font-mono text-stone-300">${tgtStats.join('<span class="mx-1 text-stone-600">|</span>')}</span>`
        );
      }
    } else if (additional) {
      parts.unshift(
        `<span class="text-[11px] font-bold text-purple-300 bg-purple-950/90 px-1.5 py-0.5 rounded border border-purple-600">ADDITIONAL PT (PLAN ${seqNum})</span>`
      );
    } else if (divert) {
      parts.unshift(
        `<span class="text-[11px] font-bold text-amber-300 bg-amber-950/90 px-1.5 py-0.5 rounded border border-amber-600">DIVERT</span>`
      );
    } else if (seqNum > 1) {
      parts.unshift(
        `<span class="text-[11px] font-bold text-sky-300 bg-sky-950/90 px-1.5 py-0.5 rounded border border-sky-600">${params.isF14 ? 'PLAN' : 'SEQ'} ${seqNum}</span>`
      );
    }

    if (!target && pt.name) {
      parts.push(`<span class="text-amber-300 font-bold uppercase tracking-wider">${escapeHtml(pt.name)}</span>`);
    }

    if (!target && (pt.alt !== undefined || pt.speed !== undefined)) {
      const altVal = pt.alt !== undefined && pt.alt !== null && String(pt.alt) !== '' ? Number(pt.alt) : null;
      const speedVal = pt.speed !== undefined && pt.speed !== null && String(pt.speed) !== '' ? Number(pt.speed) : null;
      const stats: string[] = [];
      if (altVal !== null && Number.isFinite(altVal) && altVal !== 0) {
        stats.push(
          isKm
            ? `${Math.round(altVal * 0.3048)}<span class="text-[11px] text-stone-400 ml-0.5">m</span>`
            : `${Math.round(altVal)}<span class="text-[11px] text-stone-400 ml-0.5">ft</span>`
        );
      }
      if (speedVal !== null && Number.isFinite(speedVal) && speedVal !== 0) {
        stats.push(
          isKm
            ? `${Math.round(speedVal * 1.852)}<span class="text-[11px] text-stone-400 ml-0.5">kph</span>`
            : `${Math.round(speedVal)}<span class="text-[11px] text-stone-400 ml-0.5">kts</span>`
        );
      }
      if (stats.length > 0) {
        parts.push(
          `<span class="font-mono text-stone-300">${stats.join('<span class="mx-1 text-stone-600">|</span>')}</span>`
        );
      }
    }

    if (!target && pt.tot) {
      parts.push(`<span class="text-xs font-bold text-green-400">M+${escapeHtml(pt.tot)}</span>`);
    }

    const labelHtml =
      parts.length > 0
        ? `<div class="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-stone-900/95 text-white text-xs font-bold px-2 py-1.5 rounded shadow-lg border border-stone-600 pointer-events-none flex flex-col items-center gap-0.5 z-20">
            ${parts.join('<div class="w-full h-[1px] bg-stone-700 my-0.5"></div>')}
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-stone-900/95"></div>
          </div>`
        : '';

    const displayNum = openPopupIndex !== undefined ? openPopupIndex + 1 : idx + 1;
    const markerHtml = target
      ? `<div style="pointer-events:auto;background-color:#991b1b;border:2px solid #ef4444;box-shadow:0 0 10px rgba(239,68,68,0.7);" class="w-[26px] h-[26px] flex items-center justify-center rounded-full text-white shadow-xl hover:scale-110 hover:brightness-125 transition-all z-20 relative"><svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-red-100" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a96,96,0,1,1-96-96A96.11,96.11,0,0,1,224,128Zm-96,80a80,80,0,1,0-80-80A80.09,80.09,0,0,0,128,208Zm0-136a56,56,0,1,0,56,56A56.06,56.06,0,0,0,128,72Zm0,96a40,40,0,1,1,40-40A40,40,0,0,1,128,168Zm0-56a16,16,0,1,0,16,16A16,16,0,0,0,128,112Z"/></svg></div>`
      : additional
        ? `<div style="pointer-events:auto;background-color:${markerColor};border:1.5px solid #d8b4fe" class="w-[22px] h-[22px] flex items-center justify-center rotate-45 text-white font-bold text-[10px] leading-none shadow-lg hover:brightness-125 transition-all z-10 relative"><span class="-rotate-45 font-mono text-[9px] font-bold">⌖</span></div>`
        : fix
          ? `<div style="pointer-events:auto;background-color:${markerColor};border:1.5px solid #ffffff;box-shadow:0 0 6px rgba(0,0,0,0.6);" class="w-[20px] h-[20px] flex items-center justify-center rotate-45 rounded-[2px] text-white font-bold text-[10px] leading-none shadow hover:brightness-110 transition-colors z-10 relative" title="Nav Fix: ${escapeHtml(pt.name || '')}"><span class="-rotate-45 font-mono text-[9px] font-bold block leading-none">${displayNum}</span></div>`
          : `<div style="pointer-events:auto;background-color:${markerColor}" class="w-[21px] h-[21px] flex items-center justify-center rounded-full border border-white text-white font-bold text-[11px] leading-none shadow hover:brightness-110 transition-colors z-10 relative">${displayNum}</div>`;

    const iconDim = target ? 26 : 22;
    return L.divIcon({
      className: 'flight-plan-point-marker',
      html: `<div class="relative group">${labelHtml}${markerHtml}</div>`,
      iconSize: [iconDim, iconDim],
      iconAnchor: [iconDim / 2, iconDim / 2],
    });
  }

  private createPopupContent(idx: number, marker: L.Marker): HTMLElement {
    const params = this.lastSyncParams!;
    const pt = this.workingPoints[idx];
    const canEdit = Boolean(params.editable && params.isOpen);
    const isKm = params.unit === 'km';
    const isF14 = params.isF14;

    if (!pt) return document.createElement('div');

    if (isTargetPoint(pt)) {
      const container = document.createElement('div');
      container.className = 'p-1 min-w-[260px] space-y-3 font-sans';
      const ll = marker.getLatLng();
      const dropAltVal = pt.drop_alt !== undefined && pt.drop_alt !== null && pt.drop_alt !== '' ? pt.drop_alt : 30000;
      const elevVal =
        pt.elev !== undefined && pt.elev !== null && pt.elev !== '' && pt.elev !== dropAltVal
          ? pt.elev
          : pt.alt && pt.alt !== dropAltVal
            ? pt.alt
            : '';
      const dropSpdVal = pt.drop_spd !== undefined && pt.drop_spd !== null && pt.drop_spd !== '' ? pt.drop_spd : 450;
      const atkHdgVal = pt.attack_heading !== undefined && pt.attack_heading !== null && pt.attack_heading !== '' ? pt.attack_heading : 0;
      const mgrsStr = pt.mgrs || toMgrs(ll.lat, ll.lng);

      container.innerHTML = `
        <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-red-500/20 text-red-400 border border-red-500/30">TARGET</span>
            <h3 class="text-sm font-bold text-zinc-100 truncate max-w-[150px]">${escapeHtml(pt.name || 'TARGET')}</h3>
          </div>
          ${mgrsStr ? `<span class="text-[11px] font-mono text-zinc-400">${escapeHtml(mgrsStr)}</span>` : ''}
        </div>
        <div class="space-y-2.5">
          <div>
            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Target Name</label>
            <input type="text" class="target-name-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-zinc-100 font-semibold rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(pt.name || '')}" placeholder="e.g. STORAGEB, WAREHOUSE" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Target Elev (ft)</label>
              <input type="number" class="target-elev-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(elevVal)}" placeholder="Ground elev" />
            </div>
            <div>
              <label class="block text-xs font-bold text-red-400 uppercase tracking-wider mb-1">Drop Alt (ft)</label>
              <input type="number" class="target-drop-alt-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(dropAltVal)}" placeholder="30000" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Attack Hdg (°)</label>
              <input type="number" step="0.1" class="target-hdg-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(atkHdgVal)}" placeholder="198.1" />
            </div>
            <div>
              <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Drop Spd (kts)</label>
              <input type="number" class="target-speed-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(dropSpdVal)}" placeholder="450" />
            </div>
          </div>
          <div class="grid ${isF14 ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
            <div>
              <label class="block text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">Weapon</label>
              <input type="text" class="target-weapon-input w-full bg-zinc-800/90 border border-zinc-700 focus:border-red-500 text-zinc-100 font-semibold rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(pt.weapon || 'GBU-38')}" placeholder="GBU-38" />
            </div>
            ${
              isF14
                ? `<div>
                    <label class="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Station #</label>
                    <select class="target-station-select w-full bg-zinc-800/90 border border-zinc-700 text-zinc-100 font-semibold rounded-md px-2 py-1 text-xs">
                      <option value="all" ${!pt.station || pt.station === 'all' ? 'selected' : ''}>All (3-6)</option>
                      <option value="3" ${String(pt.station) === '3' ? 'selected' : ''}>STA 3 (Fwd R)</option>
                      <option value="4" ${String(pt.station) === '4' ? 'selected' : ''}>STA 4 (Aft R)</option>
                      <option value="5" ${String(pt.station) === '5' ? 'selected' : ''}>STA 5 (Aft L)</option>
                      <option value="6" ${String(pt.station) === '6' ? 'selected' : ''}>STA 6 (Fwd L)</option>
                    </select>
                  </div>`
                : ''
            }
          </div>
        </div>
        ${
          canEdit
            ? `<div class="pt-2 border-t border-zinc-800">
                <button type="button" class="target-delete-btn w-full bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 hover:text-red-100 text-xs font-semibold py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer">Remove Target</button>
              </div>`
            : ''
        }
      `;

      const nameInput = container.querySelector<HTMLInputElement>('.target-name-input');
      const elevInput = container.querySelector<HTMLInputElement>('.target-elev-input');
      const dropAltInput = container.querySelector<HTMLInputElement>('.target-drop-alt-input');
      const hdgInput = container.querySelector<HTMLInputElement>('.target-hdg-input');
      const speedInput = container.querySelector<HTMLInputElement>('.target-speed-input');
      const weaponInput = container.querySelector<HTMLInputElement>('.target-weapon-input');
      const stationSelect = container.querySelector<HTMLSelectElement>('.target-station-select');
      const delBtn = container.querySelector<HTMLButtonElement>('.target-delete-btn');

      if (!canEdit) {
        [nameInput, elevInput, dropAltInput, hdgInput, speedInput, weaponInput, stationSelect].forEach(
          (el) => {
            if (el) el.disabled = true;
          }
        );
      } else {
        nameInput?.addEventListener('change', (e) => {
          const val = (e.target as HTMLInputElement).value;
          this.callbacks.onUpdatePoint(idx, { name: val });
        });
        elevInput?.addEventListener('change', (e) => {
          const val = Number((e.target as HTMLInputElement).value) || 0;
          this.callbacks.onUpdatePoint(idx, { elev: val, alt: val });
        });
        dropAltInput?.addEventListener('change', (e) => {
          this.callbacks.onUpdatePoint(idx, { drop_alt: Number((e.target as HTMLInputElement).value) || 0 });
        });
        hdgInput?.addEventListener('change', (e) => {
          this.callbacks.onUpdatePoint(idx, { attack_heading: Number((e.target as HTMLInputElement).value) || 0 });
        });
        speedInput?.addEventListener('change', (e) => {
          this.callbacks.onUpdatePoint(idx, { drop_spd: Number((e.target as HTMLInputElement).value) || 0 });
        });
        weaponInput?.addEventListener('change', (e) => {
          this.callbacks.onUpdatePoint(idx, { weapon: (e.target as HTMLInputElement).value });
        });
        stationSelect?.addEventListener('change', (e) => {
          this.callbacks.onUpdatePoint(idx, { station: (e.target as HTMLSelectElement).value });
        });
        delBtn?.addEventListener('click', () => {
          this.map.closePopup();
          this.callbacks.onDeletePoint(idx);
        });
      }

      return container;
    }

    // Standard Waypoint / Fix / Additional Point Popup
    const isSpawnPoint = idx === 0;
    const divert = isDivertPoint(pt);
    const currentSeq = divert ? 'divert' : Number(pt.sequence || 1);
    const availSeqs = getAvailableSequences(this.workingPoints, params.userCreatedSequences);
    if (typeof currentSeq === 'number' && !availSeqs.includes(currentSeq)) {
      availSeqs.push(currentSeq);
      availSeqs.sort((a, b) => a - b);
    }

    const seqOptionsHtml = availSeqs
      .map(
        (s) =>
          `<option value="${s}" ${currentSeq === s ? 'selected' : ''}>${isF14 ? 'Plan' : 'Seq'} ${s}${
            s === 1 ? ' (Main)' : ''
          }</option>`
      )
      .join('');

    const altDisplay = pt.alt
      ? isKm
        ? String(Math.round(Number(pt.alt) * 0.3048))
        : String(Math.round(Number(pt.alt)))
      : '';
    const speedDisplay = pt.speed
      ? isKm
        ? String(Math.round(Number(pt.speed) * 1.852))
        : String(Math.round(Number(pt.speed)))
      : '';

    const container = document.createElement('div');
    container.className = 'p-1 min-w-[240px] space-y-3 font-sans';
    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${
            divert
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : isSpawnPoint
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
          }">${divert ? 'DIVERT' : isSpawnPoint ? 'START / DEP' : `WAYPOINT ${idx}`}</span>
          <h3 class="text-sm font-bold text-zinc-100 truncate max-w-[140px]">${escapeHtml(pt.name || `Waypoint ${idx + 1}`)}</h3>
        </div>
      </div>
      <div class="space-y-2.5">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">${isF14 ? 'Plan' : 'Sequence'}</label>
            <select class="wp-sequence-select w-full bg-zinc-800/90 border border-zinc-700 text-amber-300 font-bold rounded-md px-2 py-1 text-xs">
              ${seqOptionsHtml}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Waypoint Name</label>
            <input type="text" class="wp-name-input w-full bg-zinc-800/90 border border-zinc-700 text-zinc-100 font-semibold rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(pt.name || '')}" placeholder="${isSpawnPoint ? 'Departure Airfield' : 'Turning Point'}" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">${isKm ? 'Alt (m)' : 'Alt (ft)'}</label>
            <input type="text" class="wp-alt-input w-full bg-zinc-800/90 border border-zinc-700 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(altDisplay)}" placeholder="${isKm ? '6000' : '20000'}" />
          </div>
          <div>
            <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">${isKm ? 'Speed (kph CAS)' : 'Speed (kts CAS)'}</label>
            <input type="text" class="wp-speed-input w-full bg-zinc-800/90 border border-zinc-700 text-zinc-100 font-semibold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(speedDisplay)}" placeholder="${isKm ? '648' : '350'}" />
          </div>
        </div>
        <div class="bg-zinc-800/40 border border-zinc-800 rounded-md p-2 space-y-1">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold ${isSpawnPoint ? 'text-amber-400' : 'text-zinc-300'} uppercase tracking-wider">Time on Target (M+)</label>
            <span class="text-[11px] font-mono text-zinc-500">HH:MM:SS</span>
          </div>
          <input type="text" class="wp-tot-input w-full bg-zinc-800/90 border border-zinc-700 text-amber-400 font-bold font-mono rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(pt.tot || '')}" placeholder="HH:MM:SS" />
          <p class="text-[11px] text-zinc-500 font-medium mt-0.5">Format: HH:MM:SS (from Mission Start)</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Remarks</label>
          <input type="text" class="wp-remarks-input w-full bg-zinc-800/90 border border-zinc-700 text-zinc-100 font-medium rounded-md px-2.5 py-1 text-xs" value="${escapeHtml(pt.remarks || '')}" placeholder="Notes for flight report..." />
        </div>
      </div>
      ${
        canEdit
          ? `<div class="pt-2 border-t border-zinc-800">
              <button type="button" class="wp-delete-btn w-full bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 hover:text-red-100 text-xs font-semibold py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer">Remove Waypoint</button>
            </div>`
          : ''
      }
    `;

    const seqSelect = container.querySelector<HTMLSelectElement>('.wp-sequence-select');
    const nameInput = container.querySelector<HTMLInputElement>('.wp-name-input');
    const altInput = container.querySelector<HTMLInputElement>('.wp-alt-input');
    const speedInput = container.querySelector<HTMLInputElement>('.wp-speed-input');
    const totInput = container.querySelector<HTMLInputElement>('.wp-tot-input');
    const remarksInput = container.querySelector<HTMLInputElement>('.wp-remarks-input');
    const delBtn = container.querySelector<HTMLButtonElement>('.wp-delete-btn');

    if (!canEdit) {
      [seqSelect, nameInput, altInput, speedInput, totInput, remarksInput].forEach((el) => {
        if (el) el.disabled = true;
      });
    } else {
      seqSelect?.addEventListener('change', (e) => {
        const val = parseInt((e.target as HTMLSelectElement).value, 10) || 1;
        this.callbacks.onUpdatePoint(idx, { sequence: val, is_divert: false });
      });
      nameInput?.addEventListener('change', (e) => {
        this.callbacks.onUpdatePoint(idx, { name: (e.target as HTMLInputElement).value });
      });
      altInput?.addEventListener('change', (e) => {
        let val = parseFloat((e.target as HTMLInputElement).value);
        if (Number.isNaN(val)) {
          this.callbacks.onUpdatePoint(idx, { alt: 0 });
        } else {
          if (isKm) val = val / 0.3048;
          this.callbacks.onUpdatePoint(idx, { alt: Math.round(val) });
        }
      });
      speedInput?.addEventListener('change', (e) => {
        let val = parseFloat((e.target as HTMLInputElement).value);
        if (Number.isNaN(val)) {
          this.callbacks.onUpdatePoint(idx, { speed: 0 });
        } else {
          if (isKm) val = val / 1.852;
          this.callbacks.onUpdatePoint(idx, { speed: Math.round(val) });
        }
      });
      totInput?.addEventListener('input', (e) => {
        const el = e.target as HTMLInputElement;
        let v = el.value.replace(/\D/g, '').substring(0, 6);
        if (v.length >= 5) {
          v = `${v.substring(0, 2)}:${v.substring(2, 4)}:${v.substring(4, 6)}`;
        } else if (v.length >= 3) {
          v = `${v.substring(0, 2)}:${v.substring(2, 4)}`;
        }
        el.value = v;
      });
      totInput?.addEventListener('change', (e) => {
        this.callbacks.onUpdatePoint(idx, { tot: (e.target as HTMLInputElement).value || null });
      });
      remarksInput?.addEventListener('change', (e) => {
        this.callbacks.onUpdatePoint(idx, { remarks: (e.target as HTMLInputElement).value });
      });
      delBtn?.addEventListener('click', () => {
        this.map.closePopup();
        this.callbacks.onDeletePoint(idx);
      });
    }

    return container;
  }

  private rebuildMarkers(): void {
    this.markersGroup.clearLayers();
    this.markerList = [];
    const params = this.lastSyncParams;
    if (!params) return;

    const draggable = Boolean(params.editable && params.isOpen);

    this.workingPoints.forEach((pt, idx) => {
      if (!Number.isFinite(Number(pt.lat)) || !Number.isFinite(Number(pt.lng))) {
        return;
      }

      const marker = L.marker([Number(pt.lat), Number(pt.lng)], {
        draggable,
        icon: this.buildMarkerIcon(pt, idx),
        zIndexOffset: isTargetPoint(pt) ? 2450 : 2400,
      }).addTo(this.markersGroup);

      (marker as any)._isFlightPlanWaypoint = true;
      marker.bindPopup(() => this.createPopupContent(idx, marker), { maxWidth: 300 });

      marker.on('click', (ev: L.LeafletMouseEvent) => {
        if (draggable && ev.originalEvent?.altKey) {
          L.DomEvent.stopPropagation(ev);
          ev.originalEvent.preventDefault();
          marker.closePopup();
          this.callbacks.onDeletePoint(idx);
        }
      });

      marker.on('dragstart', () => {
        this.isDragging = true;
      });

      marker.on('drag', (ev: L.LeafletEvent) => {
        const pos = (ev.target as L.Marker).getLatLng();
        if (this.workingPoints[idx]) {
          this.workingPoints[idx].lat = pos.lat;
          this.workingPoints[idx].lng = pos.lng;
          this.workingPoints = recalculateTransitSpeeds(this.workingPoints);
          this.drawLinesOnly();
        }
      });

      marker.on('dragend', (ev: L.LeafletEvent) => {
        this.isDragging = false;
        const pos = (ev.target as L.Marker).getLatLng();
        const lat = Number(pos.lat.toFixed(6));
        const lng = Number(pos.lng.toFixed(6));
        const nextPts = this.workingPoints.map((p, i) =>
          i === idx
            ? {
                ...p,
                lat,
                lng,
                mgrs: toMgrs(lat, lng),
                ddm: formatCoordinateDdm(lat, lng),
                lldm: formatCoordinateDdm(lat, lng),
                dms: formatCoordinateDms(lat, lng),
              }
            : { ...p }
        );
        const recalced = recalculateTransitSpeeds(nextPts);
        this.workingPoints = recalced;
        this.drawLinesOnly();
        this.callbacks.onCommitPoints(recalced);
        if (this.workingPoints[idx]) {
          this.callbacks.onAutoFetchPointElevation(idx, lat, lng, isTargetPoint(this.workingPoints[idx]));
        }
      });

      this.markerList[idx] = marker;
    });
  }

  private drawLinesOnly(): void {
    this.linesGroup.clearLayers();
    const params = this.lastSyncParams;
    if (!params || !params.plan) return;

    const pts = recalculateTransitSpeeds(this.workingPoints);
    this.workingPoints = pts;
    const seqList = getAvailableSequences(pts, params.userCreatedSequences);
    const isKm = params.unit === 'km';
    const campaignDate = params.mapData?.campaign.campaignDate;
    const theatreDecl = params.mapData?.campaign.magneticDeclination;
    const canEdit = Boolean(params.editable && params.isOpen);

    seqList.forEach((seq) => {
      const seqPoints = pts.filter(
        (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && isSequenceTrackPoint(p, seq)
      );
      if (seqPoints.length < 2) return;

      const latLngs = seqPoints.map((p) => L.latLng(Number(p.lat), Number(p.lng)));
      const color = getSequenceColor(seq, params.plan?.color, params.sequenceColors);
      const dash = SEQUENCE_DASH_PATTERNS[seq];

      const polyline = L.polyline(latLngs, {
        color,
        weight: 2.5,
        opacity: 0.9,
        dashArray: dash,
        className: 'flight-plan-route-line cursor-pointer',
      }).addTo(this.linesGroup);
      (polyline as any)._isFlightRouteLine = true;

      const spine = L.polyline(latLngs, {
        color,
        weight: 20,
        opacity: 0,
        className: 'flight-plan-route-spine cursor-pointer',
      }).addTo(this.linesGroup);
      (spine as any)._isFlightRouteLine = true;

      const handleLineClick = (e: L.LeafletMouseEvent) => {
        this.lastPolylineClickTime = Date.now();
        L.DomEvent.stopPropagation(e);
        if (e.originalEvent) e.originalEvent.stopPropagation();
        if (!canEdit) return;
        this.callbacks.onInsertOrAppendWaypoint(e.latlng, seq);
      };

      polyline.on('click', handleLineClick);
      spine.on('click', handleLineClick);

      // Doghouse Cards
      if (params.doghouseConfig !== 'off') {
        for (let i = 1; i < seqPoints.length; i++) {
          const prev = seqPoints[i - 1];
          const curr = seqPoints[i];
          const segDistNm = calculateDistanceNm(prev.lat, prev.lng, curr.lat, curr.lng);
          const distVal = isKm ? segDistNm * 1.852 : segDistNm;
          const unitLabel = isKm ? 'KM' : 'NM';
          const bearing = calculateBearingDegrees(prev.lat, prev.lng, curr.lat, curr.lng);
          const midLat = (Number(prev.lat) + Number(curr.lat)) / 2;
          const midLng = (Number(prev.lng) + Number(curr.lng)) / 2;
          const decl = getMagneticDeclination(midLat, midLng, campaignDate, theatreDecl);
          const magBrg = trueToMagnetic(bearing, decl);

          const transitSpd = curr.transitSpeed;
          const speedHtml = transitSpd
            ? `<span class="text-green-400 ml-2 pl-2 border-l border-stone-600">REQ: ${
                isKm ? `${Math.round(transitSpd * 1.852)} kph CAS` : `${transitSpd} kts CAS`
              }</span>`
            : '';

          let rotAngle = (bearing - 90) % 360;
          let isFlipped = false;
          if (rotAngle > 90) {
            rotAngle -= 180;
            isFlipped = true;
          }
          if (rotAngle < -90) {
            rotAngle += 180;
            isFlipped = true;
          }

          const cardClasses = isFlipped
            ? 'relative flex flex-col items-center justify-center bg-[#1c1917]/95 border-y border-r border-[#44403c] rounded-r-md pr-3.5 pl-3 py-1.5 shadow-lg text-xs font-bold whitespace-nowrap min-w-[110px] -translate-y-8 pointer-events-none'
            : 'relative flex flex-col items-center justify-center bg-[#1c1917]/95 border-y border-l border-[#44403c] rounded-l-md pl-3.5 pr-3 py-1.5 shadow-lg text-xs font-bold whitespace-nowrap min-w-[110px] -translate-y-8 pointer-events-none';

          const tipHtml = isFlipped
            ? `<div class="absolute right-full top-0 bottom-0 -mr-[1px] w-3.5 h-full pointer-events-none">
                 <svg viewBox="0 0 14 40" preserveAspectRatio="none" class="w-3.5 h-full overflow-visible">
                   <polygon points="14,0 0,20 14,40" fill="#1c1917" fill-opacity="0.95" />
                   <polyline points="14,0 0,20 14,40" fill="none" stroke="#44403c" stroke-width="1.2" />
                 </svg>
               </div>`
            : `<div class="absolute left-full top-0 bottom-0 -ml-[1px] w-3.5 h-full pointer-events-none">
                 <svg viewBox="0 0 14 40" preserveAspectRatio="none" class="w-3.5 h-full overflow-visible">
                   <polygon points="0,0 14,20 0,40" fill="#1c1917" fill-opacity="0.95" />
                   <polyline points="0,0 14,20 0,40" fill="none" stroke="#44403c" stroke-width="1.2" />
                 </svg>
               </div>`;

          const seqBadge =
            seq > 1
              ? `<span class="text-[11px] font-mono px-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 mr-1.5">S${seq}</span>`
              : '';

          L.marker([midLat, midLng], {
            interactive: false,
            zIndexOffset: 1000,
            icon: L.divIcon({
              className: 'segment-measure-label',
              iconSize: [220, 100],
              iconAnchor: [110, 50],
              html: `<div style="transform: rotate(${rotAngle.toFixed(1)}deg);" class="relative flex items-center justify-center pointer-events-none">
                <div class="${cardClasses}">
                  <div class="flex items-center">
                    ${seqBadge}
                    <span class="text-amber-400">${Math.round(distVal)} ${unitLabel}</span>
                    ${speedHtml}
                  </div>
                  <span class="text-stone-300 font-mono text-[11px] mt-0.5">
                    ${String(Math.round(bearing)).padStart(3, '0')}°T / ${String(Math.round(magBrg)).padStart(3, '0')}°M
                  </span>
                  ${tipHtml}
                </div>
              </div>`,
            }),
          }).addTo(this.linesGroup);
        }
      }

      // Flight Path Ticks (Time or Range)
      if (params.tickConfig.type !== 'off') {
        this.renderTicksForSequence(seqPoints, color, params.tickConfig, isKm);
      }
    });
  }

  private renderTicksForSequence(
    pts: FlightPlanRoutePoint[],
    color: string,
    cfg: TickConfig,
    isKm: boolean
  ): void {
    const isTimeMode = cfg.type === 'time';
    const intervalVal = cfg.interval || 5;
    let totalDistMeters = 0;
    let totalDurationMins = 0;

    const legs: Array<{
      p1: FlightPlanRoutePoint;
      p2: FlightPlanRoutePoint;
      distMeters: number;
      legDurationMins: number;
      bearing: number;
      startMin: number;
      endMin: number;
      startMeters: number;
      endMeters: number;
    }> = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const distMeters = this.map.distance([p1.lat, p1.lng], [p2.lat, p2.lng]);
      const distNm = distMeters * 0.000539957;

      let cas = 350;
      if (p2.transitSpeed && Number.isFinite(Number(p2.transitSpeed))) {
        cas = Number(p2.transitSpeed);
      } else if (p1.speed && Number(p1.speed) > 0) {
        cas = Number(p1.speed);
      } else if (p2.speed && Number(p2.speed) > 0) {
        cas = Number(p2.speed);
      }

      const altFt = Number(p2.alt || p1.alt || 0) || 0;
      const gs = casToTas(cas, altFt);
      const gsNmMin = (gs > 0 ? gs : 350) / 60;
      const legDurationMins = distNm / gsNmMin;
      const bearing = calculateBearingDegrees(p1.lat, p1.lng, p2.lat, p2.lng);

      legs.push({
        p1,
        p2,
        distMeters,
        legDurationMins,
        bearing,
        startMin: totalDurationMins,
        endMin: totalDurationMins + legDurationMins,
        startMeters: totalDistMeters,
        endMeters: totalDistMeters + distMeters,
      });

      totalDurationMins += legDurationMins;
      totalDistMeters += distMeters;
    }

    const addTickMarker = (lat: number, lng: number, bearing: number, isMajor: boolean) => {
      const strokeWidth = isMajor ? 3 : 2;
      const tickWidth = isMajor ? 20 : 14;
      const x1 = (24 - tickWidth) / 2;
      const x2 = x1 + tickWidth;
      L.marker([lat, lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'flight-path-tick-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: `<div class="relative w-6 h-6 flex items-center justify-center pointer-events-none">
            <svg style="transform: rotate(${bearing.toFixed(1)}deg);" viewBox="0 0 24 24" class="w-6 h-6 overflow-visible">
              <line x1="${x1}" y1="12" x2="${x2}" y2="12" stroke="#09090b" stroke-width="${strokeWidth + 1.5}" stroke-linecap="round" />
              <line x1="${x1}" y1="12" x2="${x2}" y2="12" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" />
            </svg>
          </div>`,
        }),
      }).addTo(this.linesGroup);
    };

    if (isTimeMode) {
      if (totalDurationMins <= 0) return;
      for (let m = intervalVal; m < totalDurationMins && m < 10000; m += intervalVal) {
        const leg = legs.find((l) => m >= l.startMin && m < l.endMin);
        if (!leg || leg.legDurationMins <= 0) continue;
        const frac = (m - leg.startMin) / leg.legDurationMins;
        addTickMarker(
          leg.p1.lat + (leg.p2.lat - leg.p1.lat) * frac,
          leg.p1.lng + (leg.p2.lng - leg.p1.lng) * frac,
          leg.bearing,
          m % 5 === 0
        );
      }
    } else {
      const stepMeters = intervalVal * (isKm ? 1000 : 1852);
      if (totalDistMeters <= 0 || stepMeters <= 0) return;
      for (let d = stepMeters; d < totalDistMeters && d < 20000000; d += stepMeters) {
        const leg = legs.find((l) => d >= l.startMeters && d < l.endMeters);
        if (!leg || leg.distMeters <= 0) continue;
        const frac = (d - leg.startMeters) / leg.distMeters;
        const disp = isKm ? Math.round(d / 1000) : Math.round(d / 1852);
        addTickMarker(
          leg.p1.lat + (leg.p2.lat - leg.p1.lat) * frac,
          leg.p1.lng + (leg.p2.lng - leg.p1.lng) * frac,
          leg.bearing,
          disp % 5 === 0
        );
      }
    }
  }

  // ============================================================================
  // Live-Dragging Airframe Tactical Avionics Layers (F-18, F-16, F-14, JF-17)
  // ============================================================================

  private renderAvionics(): void {
    this.avionicsGroup.clearLayers();
    const params = this.lastSyncParams;
    if (!params || !params.plan) return;

    const canEdit = Boolean(params.editable && params.isOpen);

    if (params.isF18) this.renderF18Sa(canEdit);
    if (params.isF16) {
      this.renderF16Geo(canEdit);
      this.renderF16Dest(canEdit);
    }
    if (params.isF14) this.renderF14Plot(canEdit);
    if (params.isJf17) this.renderJf17Airspace(canEdit);
  }

  private renderF18Sa(canEdit: boolean): void {
    const params = this.lastSyncParams!;
    const sa = params.plan?.sa_settings || {};
    const defaultFlot = parseInt(String(sa.default_flot ?? 1), 10);
    const defaultFaor = parseInt(String(sa.default_faor ?? 1), 10);
    const defaultCap = parseInt(String(sa.default_cap ?? 1), 10);
    const defaultCorr = parseInt(String(sa.default_corridor ?? 1), 10);

    const createVertexIcon = (text: string, draggable: boolean) => {
      const wide =
        text.includes('FLOT') || text.includes('FAOR') || text.includes('CORR') || text.includes('CAP');
      return L.divIcon({
        className: 'f18-sa-vertex-icon',
        iconSize: [60, 18],
        iconAnchor: [6, 9],
        html: `<div class="flex items-center gap-1 text-[11px] font-bold font-mono text-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] select-none ${
          draggable ? 'cursor-move' : 'cursor-default'
        }">
          <span class="w-3 h-3 rounded-full border-2 border-emerald-400 bg-stone-900/90 shadow-[0_0_6px_rgba(34,197,94,0.8)] hover:scale-125 transition-transform shrink-0 inline-block"></span>
          <span class="text-emerald-300 leading-none ${wide ? 'min-w-[48px]' : 'min-w-[20px]'}">${escapeHtml(
            text
          )}</span>
        </div>`,
      });
    };

    // 1. FLOT 1 (Read-only campaign front line, NO downsampling, slice 0..7) + User FLOT 2..3
    const frontLinePts = extractFrontLinePoints(params.mapData?.frontLine, 7);
    const flots: Array<{ num: number; note: string; points: any[]; isCustom: boolean }> = [];
    if (frontLinePts.length > 0) {
      flots.push({ num: 1, note: 'FRONT LINE', points: frontLinePts, isCustom: false });
    }
    (Array.isArray(sa.flot) ? sa.flot.slice(0, 2) : []).forEach((f: any, idx: number) => {
      flots.push({
        num: idx + 2,
        note: f.note || '',
        points: Array.isArray(f.points) ? f.points : [],
        isCustom: true,
      });
    });

    flots.forEach((flot) => {
      const validPts = flot.points.filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)));
      if (validPts.length === 0) return;
      const latLngs = validPts.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]);
      const line =
        latLngs.length >= 2
          ? L.polyline(latLngs, {
              color: '#22c55e',
              weight: flot.num === defaultFlot ? 3.5 : 2.5,
              opacity: 0.95,
            })
              .bindTooltip(
                `<b>FLOT ${flot.num}</b>${flot.num === defaultFlot ? ' (Default)' : ''}${
                  flot.note ? `<br>${escapeHtml(flot.note)}` : ''
                }`,
                { sticky: true, direction: 'top' }
              )
              .addTo(this.avionicsGroup)
          : null;

      validPts.forEach((pt, idx) => {
        const label =
          idx === 0
            ? `FLOT${flot.num}`
            : idx === validPts.length - 1
              ? `${idx + 1} FLOT${flot.num}`
              : `${idx + 1}`;
        const draggable = Boolean(flot.isCustom && canEdit);
        const m = L.marker([Number(pt.lat), Number(pt.lng)], {
          icon: createVertexIcon(label, draggable),
          zIndexOffset: 1100,
          draggable,
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        if (draggable) {
          m.bindTooltip(`<b>${label}</b><br>Drag to move • Alt+Click to delete`, {
            direction: 'top',
            offset: [0, -6],
          });
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            latLngs[idx] = [np.lat, np.lng];
            line?.setLatLngs(latLngs);
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            const lineIdx = flot.num - 2;
            this.callbacks.onMutatePlan((prev) => {
              const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(pSa.flot) ? [...pSa.flot] : [];
              if (list[lineIdx]?.points?.[idx]) {
                const nPts = [...list[lineIdx].points];
                nPts[idx] = { lat: Number(np.lat.toFixed(6)), lng: Number(np.lng.toFixed(6)) };
                list[lineIdx] = { ...list[lineIdx], points: nPts };
              }
              return { ...prev, sa_settings: { ...pSa, flot: list } };
            });
          });
          m.on('click', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent?.altKey) {
              L.DomEvent.stopPropagation(ev);
              const lineIdx = flot.num - 2;
              this.callbacks.onMutatePlan((prev) => {
                const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
                const list = Array.isArray(pSa.flot) ? [...pSa.flot] : [];
                if (list[lineIdx]?.points) {
                  list[lineIdx] = {
                    ...list[lineIdx],
                    points: list[lineIdx].points.filter((_: any, i: number) => i !== idx),
                  };
                }
                return { ...prev, sa_settings: { ...pSa, flot: list } };
              });
            }
          });
        }
      });
    });

    // 2. FAOR 1..3
    (Array.isArray(sa.faor) ? sa.faor.slice(0, 3) : []).forEach((faor: any, faorIdx: number) => {
      const num = faorIdx + 1;
      const validPts = (Array.isArray(faor.points) ? faor.points : []).filter(
        (p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))
      );
      if (validPts.length === 0) return;

      const closed = isFaorPointsClosed(validPts);
      const latLngs = validPts.map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      const line =
        latLngs.length >= 2
          ? L.polyline(latLngs, {
              color: '#22c55e',
              weight: num === defaultFaor ? 3.5 : 2.5,
              dashArray: '8, 8',
              opacity: 0.95,
            })
              .bindTooltip(`<b>FAOR ${num}</b>${closed ? ' (Closed Box)' : ''}`, {
                sticky: true,
                direction: 'top',
              })
              .addTo(this.avionicsGroup)
          : null;

      validPts.forEach((pt: any, idx: number) => {
        if (closed && idx === validPts.length - 1) return;
        const label =
          idx === 0
            ? closed
              ? `FAOR${num} (Box)`
              : `FAOR${num}`
            : idx === validPts.length - 1
              ? `${idx + 1} FAOR${num}`
              : `${idx + 1}`;
        const m = L.marker([Number(pt.lat), Number(pt.lng)], {
          icon: createVertexIcon(label, canEdit),
          zIndexOffset: 1100,
          draggable: canEdit,
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        m.on('click', (ev: L.LeafletMouseEvent) => {
          if (canEdit && params.activeDrawTarget?.kind === 'f18_faor' && this.callbacks.onAvionicsDrawClick) {
            L.DomEvent.stopPropagation(ev);
            this.callbacks.onAvionicsDrawClick(m.getLatLng());
            return;
          }
          if (canEdit && ev.originalEvent?.altKey) {
            L.DomEvent.stopPropagation(ev);
            this.callbacks.onMutatePlan((prev) => {
              const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(pSa.faor) ? [...pSa.faor] : [];
              if (list[faorIdx]?.points) {
                list[faorIdx] = {
                  ...list[faorIdx],
                  points: list[faorIdx].points.filter((_: any, i: number) => i !== idx),
                };
              }
              return { ...prev, sa_settings: { ...pSa, faor: list } };
            });
          }
        });

        if (canEdit) {
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            latLngs[idx] = [np.lat, np.lng];
            if (closed && idx === 0) latLngs[latLngs.length - 1] = [np.lat, np.lng];
            line?.setLatLngs(latLngs);
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            const nLat = Number(np.lat.toFixed(6));
            const nLng = Number(np.lng.toFixed(6));
            this.callbacks.onMutatePlan((prev) => {
              const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(pSa.faor) ? [...pSa.faor] : [];
              if (list[faorIdx]?.points) {
                const nPts = [...list[faorIdx].points];
                nPts[idx] = { lat: nLat, lng: nLng };
                if (closed && idx === 0 && nPts.length >= 4) {
                  nPts[nPts.length - 1] = { lat: nLat, lng: nLng };
                }
                list[faorIdx] = { ...list[faorIdx], points: nPts };
              }
              return { ...prev, sa_settings: { ...pSa, faor: list } };
            });
          });
        }
      });
    });

    // 3. CAP 1..9 (5 NM wide racetrack with live drag & rotate handle)
    (Array.isArray(sa.cap_points) ? sa.cap_points.slice(0, 9) : []).forEach((cap: any, capIdx: number) => {
      const lat = Number(cap?.lat);
      const lng = Number(cap?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const num = capIdx + 1;
      let curCourse = parseInt(String(cap.course || 0), 10) || 0;
      let curLength = parseFloat(String(cap.length ?? cap.length_nm ?? 20)) || 20;
      const turnDir: 'Left' | 'Right' =
        String(cap.turn_direction || 'Right').toLowerCase() === 'left' ? 'Left' : 'Right';
      let curP0 = { lat, lng };

      const computeGeom = (p0: { lat: number; lng: number }, crs: number, lenNm: number) => {
        const w = 5.0;
        const r = 2.5;
        const isCcw = turnDir === 'Left';
        const topC = computeDestinationPoint(p0.lat, p0.lng, (crs + (isCcw ? -90 : 90) + 360) % 360, r);
        const p1 = computeDestinationPoint(p0.lat, p0.lng, (crs + (isCcw ? -90 : 90) + 360) % 360, w);
        const p2 = computeDestinationPoint(p1.lat, p1.lng, (crs + 180) % 360, lenNm);
        const botC = computeDestinationPoint(p2.lat, p2.lng, (crs + (isCcw ? 90 : -90) + 360) % 360, r);
        const p3 = computeDestinationPoint(p2.lat, p2.lng, (crs + (isCcw ? 90 : -90) + 360) % 360, w);

        const arc = (c: { lat: number; lng: number }, a0: number, a1: number) => {
          const out: [number, number][] = [];
          let diff = a1 - a0;
          if (isCcw) {
            while (diff > 0) diff -= 360;
          } else {
            while (diff < 0) diff += 360;
          }
          for (let i = 0; i <= 16; i++) {
            const p = computeDestinationPoint(c.lat, c.lng, (a0 + (diff * i) / 16 + 360) % 360, r);
            out.push([p.lat, p.lng]);
          }
          return out;
        };

        const circuitPts: [number, number][] = [
          [p3.lat, p3.lng],
          [p0.lat, p0.lng],
          ...arc(topC, isCcw ? (crs + 90) % 360 : (crs - 90 + 360) % 360, isCcw ? (crs - 90 + 360) % 360 : (crs + 90) % 360),
          [p1.lat, p1.lng],
          [p2.lat, p2.lng],
          ...arc(botC, isCcw ? (crs - 90 + 360) % 360 : (crs + 90) % 360, isCcw ? (crs + 90) % 360 : (crs - 90 + 360) % 360),
          [p3.lat, p3.lng],
        ];
        const midIn = computeDestinationPoint(p3.lat, p3.lng, crs, lenNm / 2);
        return { circuitPts, midIn, rotateHandlePos: botC };
      };

      let geom = computeGeom(curP0, curCourse, curLength);
      const circuitPoly = L.polyline(geom.circuitPts, {
        color: '#ffffff',
        weight: num === defaultCap ? 3.0 : 2.0,
        opacity: 0.95,
      }).addTo(this.avionicsGroup);

      const arrowMarker = L.marker([geom.midIn.lat, geom.midIn.lng], {
        interactive: false,
        zIndexOffset: 1200,
        icon: L.divIcon({
          className: 'f18-cap-arrow-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `<div style="transform: rotate(${curCourse}deg);" class="flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] text-base font-black select-none pointer-events-none">▲</div>`,
        }),
      }).addTo(this.avionicsGroup);

      const anchorMarker = L.marker([curP0.lat, curP0.lng], {
        draggable: canEdit,
        zIndexOffset: 1400,
        icon: L.divIcon({
          className: 'f18-cap-anchor-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          html: `<div class="flex flex-col items-center justify-center font-mono select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] cursor-move">
            <div class="w-5 h-5 rounded-full border-2 border-white bg-stone-950/90 flex items-center justify-center text-[10px] text-white font-black leading-none">${num}</div>
            <div class="text-[9px] text-white font-extrabold tracking-wider leading-none mt-0.5 bg-stone-900/80 px-1 rounded border border-white/40">CAP</div>
          </div>`,
        }),
      }).addTo(this.avionicsGroup);
      (anchorMarker as any)._isFlightPlanWaypoint = true;

      if (canEdit) {
        const makeRotateIcon = (c: number, len: number) =>
          L.divIcon({
            className: 'f18-cap-rotate-icon',
            iconSize: [110, 24],
            iconAnchor: [55, 12],
            html: `<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-900/95 border-2 border-amber-400 text-amber-300 font-mono text-[11px] font-black shadow-[0_0_10px_rgba(251,191,36,0.7)] cursor-grab whitespace-nowrap">
              <span>${String(c).padStart(3, '0')}° · ${len}NM</span>
            </div>`,
          });

        const rotateMarker = L.marker([geom.rotateHandlePos.lat, geom.rotateHandlePos.lng], {
          draggable: true,
          zIndexOffset: 1350,
          icon: makeRotateIcon(curCourse, curLength),
        }).addTo(this.avionicsGroup);
        (rotateMarker as any)._isFlightPlanWaypoint = true;

        anchorMarker.on('dragstart', () => {
          this.isDragging = true;
        });
        anchorMarker.on('drag', (e: L.LeafletEvent) => {
          curP0 = (e.target as L.Marker).getLatLng();
          geom = computeGeom(curP0, curCourse, curLength);
          circuitPoly.setLatLngs(geom.circuitPts);
          arrowMarker.setLatLng([geom.midIn.lat, geom.midIn.lng]);
          rotateMarker.setLatLng([geom.rotateHandlePos.lat, geom.rotateHandlePos.lng]);
        });
        anchorMarker.on('dragend', (e: L.LeafletEvent) => {
          this.isDragging = false;
          const np = (e.target as L.Marker).getLatLng();
          this.callbacks.onMutatePlan((prev) => {
            const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
            const caps = Array.isArray(pSa.cap_points) ? [...pSa.cap_points] : [];
            if (caps[capIdx]) {
              caps[capIdx] = {
                ...caps[capIdx],
                lat: Number(np.lat.toFixed(6)),
                lng: Number(np.lng.toFixed(6)),
              };
            }
            return { ...prev, sa_settings: { ...pSa, cap_points: caps } };
          });
        });

        const applyRotateDrag = (dragPos: L.LatLng) => {
          const dist = calculateDistanceNm(curP0.lat, curP0.lng, dragPos.lat, dragPos.lng);
          if (dist < 1.0) return;
          curLength = Math.max(3, Math.min(100, Math.round(Math.sqrt(Math.max(0, dist * dist - 6.25)))));
          const dx = turnDir === 'Left' ? -2.5 : 2.5;
          const dy = -curLength;
          const offsetAngle = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
          const brg = calculateBearingDegrees(curP0.lat, curP0.lng, dragPos.lat, dragPos.lng);
          curCourse = (Math.round(brg - offsetAngle) + 360) % 360;
        };

        rotateMarker.on('dragstart', () => {
          this.isDragging = true;
        });
        rotateMarker.on('drag', (e: L.LeafletEvent) => {
          applyRotateDrag((e.target as L.Marker).getLatLng());
          geom = computeGeom(curP0, curCourse, curLength);
          circuitPoly.setLatLngs(geom.circuitPts);
          arrowMarker.setLatLng([geom.midIn.lat, geom.midIn.lng]);
          const arrowDiv = arrowMarker.getElement()?.querySelector('div');
          if (arrowDiv) arrowDiv.style.transform = `rotate(${curCourse}deg)`;
          const pillSpan = rotateMarker.getElement()?.querySelector('span');
          if (pillSpan) pillSpan.textContent = `${String(curCourse).padStart(3, '0')}° · ${curLength}NM`;
        });
        rotateMarker.on('dragend', (e: L.LeafletEvent) => {
          this.isDragging = false;
          applyRotateDrag((e.target as L.Marker).getLatLng());
          this.callbacks.onMutatePlan((prev) => {
            const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
            const caps = Array.isArray(pSa.cap_points) ? [...pSa.cap_points] : [];
            if (caps[capIdx]) {
              caps[capIdx] = {
                ...caps[capIdx],
                course: curCourse,
                length: curLength,
                length_nm: curLength,
              };
            }
            return { ...prev, sa_settings: { ...pSa, cap_points: caps } };
          });
        });
      }
    });

    // 4. Corridors 1..7 (Centerline + parallel +/- 5 NM dashed rails)
    const computeParallelOffset = (pts: Array<{ lat: number; lng: number }>, offsetNm: number): [number, number][] => {
      if (pts.length < 2) return [];
      const out: [number, number][] = [];
      for (let i = 0; i < pts.length; i++) {
        let brg: number;
        if (i === 0) {
          brg = calculateBearingDegrees(pts[0].lat, pts[0].lng, pts[1].lat, pts[1].lng);
        } else if (i === pts.length - 1) {
          brg = calculateBearingDegrees(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        } else {
          const b1 = calculateBearingDegrees(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
          const b2 = calculateBearingDegrees(pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
          let diff = b2 - b1;
          while (diff < -180) diff += 360;
          while (diff > 180) diff -= 360;
          brg = (b1 + diff / 2 + 360) % 360;
        }
        const offBrg = offsetNm >= 0 ? (brg + 90) % 360 : (brg - 90 + 360) % 360;
        const d = computeDestinationPoint(pts[i].lat, pts[i].lng, offBrg, Math.abs(offsetNm));
        out.push([d.lat, d.lng]);
      }
      return out;
    };

    (Array.isArray(sa.corridors) ? sa.corridors.slice(0, 7) : []).forEach((corr: any, corrIdx: number) => {
      const num = corrIdx + 1;
      const validPts = (Array.isArray(corr.points) ? corr.points : [])
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
      if (validPts.length === 0) return;

      const latLngs = validPts.map((p: { lat: number; lng: number }) => [p.lat, p.lng] as [number, number]);
      const centerPoly =
        latLngs.length >= 2
          ? L.polyline(latLngs, {
              color: '#22c55e',
              weight: num === defaultCorr ? 3.5 : 2.5,
              opacity: 0.95,
            })
              .bindTooltip(`<b>CORRIDOR ${num}</b> (Width: 10 NM)`, { sticky: true, direction: 'top' })
              .addTo(this.avionicsGroup)
          : null;

      const leftPoly =
        validPts.length >= 2
          ? L.polyline(computeParallelOffset(validPts, -5), {
              color: '#22c55e',
              weight: 2,
              dashArray: '6, 6',
              opacity: 0.75,
            }).addTo(this.avionicsGroup)
          : null;

      const rightPoly =
        validPts.length >= 2
          ? L.polyline(computeParallelOffset(validPts, 5), {
              color: '#22c55e',
              weight: 2,
              dashArray: '6, 6',
              opacity: 0.75,
            }).addTo(this.avionicsGroup)
          : null;

      validPts.forEach((pt: { lat: number; lng: number }, idx: number) => {
        const label =
          idx === 0
            ? `CORR${num}`
            : idx === validPts.length - 1
              ? `${idx + 1} CORR${num}`
              : `${idx + 1}`;
        const m = L.marker([pt.lat, pt.lng], {
          icon: createVertexIcon(label, canEdit),
          zIndexOffset: 1100,
          draggable: canEdit,
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        if (canEdit) {
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            validPts[idx] = { lat: np.lat, lng: np.lng };
            latLngs[idx] = [np.lat, np.lng];
            centerPoly?.setLatLngs(latLngs);
            leftPoly?.setLatLngs(computeParallelOffset(validPts, -5));
            rightPoly?.setLatLngs(computeParallelOffset(validPts, 5));
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            this.callbacks.onMutatePlan((prev) => {
              const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(pSa.corridors) ? [...pSa.corridors] : [];
              if (list[corrIdx]?.points?.[idx]) {
                const nPts = [...list[corrIdx].points];
                nPts[idx] = { lat: Number(np.lat.toFixed(6)), lng: Number(np.lng.toFixed(6)) };
                list[corrIdx] = { ...list[corrIdx], points: nPts };
              }
              return { ...prev, sa_settings: { ...pSa, corridors: list } };
            });
          });
          m.on('click', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent?.altKey) {
              L.DomEvent.stopPropagation(ev);
              this.callbacks.onMutatePlan((prev) => {
                const pSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
                const list = Array.isArray(pSa.corridors) ? [...pSa.corridors] : [];
                if (list[corrIdx]?.points) {
                  list[corrIdx] = {
                    ...list[corrIdx],
                    points: list[corrIdx].points.filter((_: any, i: number) => i !== idx),
                  };
                }
                return { ...prev, sa_settings: { ...pSa, corridors: list } };
              });
            }
          });
        }
      });
    });
  }

  private renderF16Geo(canEdit: boolean): void {
    const params = this.lastSyncParams!;
    const linesMap = recalcF16GeoLines(params.plan?.geo_lines_settings);
    if (linesMap[1].length === 0) {
      const flPts = extractFrontLinePoints(params.mapData?.frontLine, 25);
      linesMap[1] = flPts.map((pt, idx) => ({
        name: `FLOT ${idx + 1}`,
        lat: pt.lat,
        lng: pt.lng,
        stpt: 31 + idx,
        line: 1,
      }));
    }

    ([1, 2, 3, 4] as const).forEach((lineNum) => {
      const points = linesMap[lineNum].filter(
        (p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))
      );
      if (points.length === 0) return;
      const color = F16_GEO_LINE_COLORS[lineNum];
      const latLngs = points.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]);

      const poly =
        latLngs.length >= 2
          ? L.polyline(latLngs, {
              color,
              weight: lineNum === 1 ? 3 : 2.5,
              opacity: 0.9,
              dashArray: lineNum === 1 ? '8, 6' : undefined,
              interactive: false,
            }).addTo(this.avionicsGroup)
          : null;

      points.forEach((pt, idx) => {
        const stptLabel = pt.stpt ? `STPT ${pt.stpt} [L${lineNum}]` : `L${lineNum} Pt ${idx + 1}`;
        const m = L.marker([Number(pt.lat), Number(pt.lng)], {
          zIndexOffset: 1200,
          draggable: canEdit,
          icon: L.divIcon({
            className: 'f16-geo-vertex-icon',
            iconSize: [64, 18],
            iconAnchor: [6, 9],
            html: `<div class="flex items-center gap-1 text-[11px] font-bold font-mono select-none ${
              canEdit ? 'cursor-move' : 'cursor-default'
            }" style="color:${color};">
              <span class="w-3 h-3 rounded-full border-2 bg-stone-900/90 shrink-0 inline-block" style="border-color:${color};box-shadow:0 0 6px ${color};"></span>
              <span class="leading-none bg-stone-950/80 px-1 py-0.5 rounded border border-stone-800 text-[11px]">${escapeHtml(
                stptLabel
              )}</span>
            </div>`,
          }),
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        if (canEdit) {
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            latLngs[idx] = [np.lat, np.lng];
            poly?.setLatLngs(latLngs);
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            this.callbacks.onMutatePlan((prev) => {
              const nextLines = recalcF16GeoLines(prev.geo_lines_settings);
              if (nextLines[lineNum]?.[idx]) {
                nextLines[lineNum][idx] = {
                  ...nextLines[lineNum][idx],
                  lat: Number(np.lat.toFixed(6)),
                  lng: Number(np.lng.toFixed(6)),
                };
              }
              return { ...prev, geo_lines_settings: recalcF16GeoLines(nextLines) };
            });
          });
          m.on('click', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent?.altKey) {
              L.DomEvent.stopPropagation(ev);
              this.callbacks.onMutatePlan((prev) => {
                const nextLines = recalcF16GeoLines(prev.geo_lines_settings);
                nextLines[lineNum] = (nextLines[lineNum] || []).filter((_, i) => i !== idx);
                return { ...prev, geo_lines_settings: recalcF16GeoLines(nextLines) };
              });
            }
          });
        }
      });
    });
  }

  private renderF16Dest(canEdit: boolean): void {
    const params = this.lastSyncParams!;
    const rawDest = params.plan?.dest_points_settings;
    const destPoints = Array.isArray(rawDest)
      ? rawDest
      : Array.isArray((rawDest as any)?.points)
        ? (rawDest as any).points
        : [];

    destPoints.forEach((pt: any, idx: number) => {
      const lat = Number(pt?.lat);
      const lng = Number(pt?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const stptNum = pt.stpt || 81 + idx;
      const labelText = pt.text || `D${stptNum}`;
      const noteText = pt.note || pt.name || '';

      const m = L.marker([lat, lng], {
        zIndexOffset: 1250,
        draggable: canEdit,
        icon: L.divIcon({
          className: 'f16-dest-point-icon',
          iconSize: [80, 20],
          iconAnchor: [7, 10],
          html: `<div class="flex items-center gap-1 text-[11px] font-bold font-mono text-amber-400 select-none ${
            canEdit ? 'cursor-move' : 'cursor-default'
          }">
            <span class="w-3.5 h-3.5 rotate-45 border-2 border-amber-400 bg-stone-950/90 shrink-0 inline-block"></span>
            <span class="flex items-center gap-1 bg-stone-950/90 px-1.5 py-0.5 rounded border border-amber-500/50 text-[11px] leading-tight">
              <span class="text-amber-300 font-bold">${escapeHtml(labelText)}</span>
              ${noteText ? `<span class="text-stone-300 font-normal truncate max-w-[80px]">${escapeHtml(noteText)}</span>` : ''}
            </span>
          </div>`,
        }),
      }).addTo(this.avionicsGroup);
      (m as any)._isFlightPlanWaypoint = true;

      if (canEdit) {
        m.on('dragend', (e: L.LeafletEvent) => {
          const np = (e.target as L.Marker).getLatLng();
          this.callbacks.onMutatePlan((prev) => {
            const raw = prev.dest_points_settings;
            const list = Array.isArray(raw) ? [...raw] : [];
            if (list[idx]) {
              list[idx] = { ...list[idx], lat: Number(np.lat.toFixed(6)), lng: Number(np.lng.toFixed(6)) };
            }
            return { ...prev, dest_points_settings: recalcF16DestPoints(list) };
          });
        });
        m.on('click', (ev: L.LeafletMouseEvent) => {
          if (ev.originalEvent?.altKey) {
            L.DomEvent.stopPropagation(ev);
            this.callbacks.onMutatePlan((prev) => {
              const raw = prev.dest_points_settings;
              const list = Array.isArray(raw) ? raw.filter((_, i) => i !== idx) : [];
              return { ...prev, dest_points_settings: recalcF16DestPoints(list) };
            });
          }
        });
      }
    });
  }

  private renderF14Plot(canEdit: boolean): void {
    const params = this.lastSyncParams!;
    const rawF14 = (params.plan?.f14_plot_lines_settings || {}) as Record<string, any>;

    ([1, 2, 3, 4] as const).forEach((lineNum) => {
      const entry = rawF14[lineNum] ?? rawF14[String(lineNum)];
      const rawPts = Array.isArray(entry) ? entry : Array.isArray(entry?.points) ? entry.points : [];
      const points = rawPts.filter(
        (p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))
      );
      if (points.length === 0) return;

      const isClosed = Boolean(entry?.closed);
      const latLngs = points.map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      const polyCoords = isClosed && latLngs.length >= 3 ? [...latLngs, latLngs[0]] : latLngs;
      const color = F16_GEO_LINE_COLORS[lineNum];

      const poly =
        polyCoords.length >= 2
          ? L.polyline(polyCoords, {
              color,
              weight: lineNum === 1 ? 3 : 2.5,
              opacity: 0.9,
              dashArray: lineNum === 1 ? '8, 6' : undefined,
              interactive: false,
            }).addTo(this.avionicsGroup)
          : null;

      points.forEach((pt: any, idx: number) => {
        const ptLabel = pt.name || `L${lineNum} P${idx + 1}`;
        const m = L.marker([Number(pt.lat), Number(pt.lng)], {
          zIndexOffset: 850,
          draggable: canEdit,
          icon: L.divIcon({
            className: 'f14-plot-vertex-icon',
            iconSize: [64, 18],
            iconAnchor: [6, 9],
            html: `<div class="flex items-center gap-1 text-[11px] font-bold font-mono select-none ${
              canEdit ? 'cursor-move' : 'cursor-default'
            }" style="color:${color};">
              <span class="w-3 h-3 rounded-full border-2 bg-stone-900/90 shrink-0 inline-block" style="border-color:${color};box-shadow:0 0 6px ${color};"></span>
              <span class="leading-none bg-stone-950/80 px-1 py-0.5 rounded border border-stone-800 text-[11px]">${escapeHtml(
                ptLabel
              )}</span>
            </div>`,
          }),
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        if (canEdit) {
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            latLngs[idx] = [np.lat, np.lng];
            const nextPoly = isClosed && latLngs.length >= 3 ? [...latLngs, latLngs[0]] : latLngs;
            poly?.setLatLngs(nextPoly);
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            this.callbacks.onMutatePlan((prev) => {
              const pF14 = { ...(prev.f14_plot_lines_settings || {}) } as Record<string, any>;
              const ex = pF14[lineNum] ?? pF14[String(lineNum)] ?? { closed: false, points: [] };
              const nextPts = Array.isArray(ex) ? [...ex] : [...(ex.points || [])];
              if (nextPts[idx]) {
                nextPts[idx] = { ...nextPts[idx], lat: Number(np.lat.toFixed(6)), lng: Number(np.lng.toFixed(6)) };
              }
              return {
                ...prev,
                f14_plot_lines_settings: { ...pF14, [lineNum]: { closed: Boolean(ex?.closed), points: nextPts } },
              };
            });
          });
          m.on('click', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent?.altKey) {
              L.DomEvent.stopPropagation(ev);
              this.callbacks.onMutatePlan((prev) => {
                const pF14 = { ...(prev.f14_plot_lines_settings || {}) } as Record<string, any>;
                const ex = pF14[lineNum] ?? pF14[String(lineNum)] ?? { closed: false, points: [] };
                const nextPts = (Array.isArray(ex) ? ex : ex.points || []).filter((_: any, i: number) => i !== idx);
                return {
                  ...prev,
                  f14_plot_lines_settings: { ...pF14, [lineNum]: { closed: Boolean(ex?.closed), points: nextPts } },
                };
              });
            }
          });
        }
      });
    });
  }

  private renderJf17Airspace(canEdit: boolean): void {
    const params = this.lastSyncParams!;
    const rawJf = (params.plan?.jf17_airspace_settings || {}) as Record<string, any>;

    (['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).forEach((lineKey, lineIdx) => {
      const cfg = rawJf[lineKey] ?? rawJf[lineKey.toLowerCase()] ?? rawJf[String(lineIdx + 1)];
      const rawPts = Array.isArray(cfg) ? cfg : Array.isArray(cfg?.points) ? cfg.points : [];
      const points = rawPts.filter(
        (p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng ?? p?.lon))
      );
      if (points.length === 0) return;

      const color = cfg?.color || JF17_DEFAULT_COLORS[lineKey];
      const latLngs = points.map((p: any) => [Number(p.lat), Number(p.lng ?? p.lon)] as [number, number]);
      const isClosed = Boolean(cfg?.closed) && latLngs.length >= 3;
      const polyCoords = isClosed ? [...latLngs, latLngs[0]] : latLngs;

      const poly =
        polyCoords.length >= 2
          ? L.polyline(polyCoords, {
              color,
              weight: lineKey === 'BKYA' ? 3 : 2.5,
              opacity: 0.9,
              dashArray: lineKey === 'BKYA' ? '8, 6' : undefined,
              interactive: false,
            }).addTo(this.avionicsGroup)
          : null;

      const fillPoly = isClosed
        ? L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 0,
            interactive: false,
          }).addTo(this.avionicsGroup)
        : null;

      points.forEach((pt: any, idx: number) => {
        const ptLabel = pt.name || `${lineKey} ${idx + 1}`;
        const m = L.marker([Number(pt.lat), Number(pt.lng ?? pt.lon)], {
          zIndexOffset: 860,
          draggable: canEdit,
          icon: L.divIcon({
            className: 'jf17-airspace-vertex-icon',
            iconSize: [64, 18],
            iconAnchor: [6, 9],
            html: `<div class="flex items-center gap-1 text-[11px] font-bold font-mono select-none ${
              canEdit ? 'cursor-move' : 'cursor-default'
            }" style="color:${color};">
              <span class="w-3 h-3 rounded-full border-2 bg-stone-900/90 shrink-0 inline-block" style="border-color:${color};box-shadow:0 0 6px ${color};"></span>
              <span class="leading-none bg-stone-950/80 px-1 py-0.5 rounded border border-stone-800 text-[11px]">${escapeHtml(
                ptLabel
              )}</span>
            </div>`,
          }),
        }).addTo(this.avionicsGroup);
        (m as any)._isFlightPlanWaypoint = true;

        if (canEdit) {
          m.on('dragstart', () => {
            this.isDragging = true;
          });
          m.on('drag', (e: L.LeafletEvent) => {
            const np = (e.target as L.Marker).getLatLng();
            latLngs[idx] = [np.lat, np.lng];
            const nextPoly = isClosed ? [...latLngs, latLngs[0]] : latLngs;
            poly?.setLatLngs(nextPoly);
            fillPoly?.setLatLngs(latLngs);
          });
          m.on('dragend', (e: L.LeafletEvent) => {
            this.isDragging = false;
            const np = (e.target as L.Marker).getLatLng();
            this.callbacks.onMutatePlan((prev) => {
              const pJf = { ...(prev.jf17_airspace_settings || {}) } as Record<string, any>;
              const ex = pJf[lineKey] ?? pJf[lineKey.toLowerCase()] ?? { color: JF17_DEFAULT_COLORS[lineKey], closed: false, points: [] };
              const nextPts = Array.isArray(ex) ? [...ex] : [...(ex.points || [])];
              if (nextPts[idx]) {
                nextPts[idx] = { ...nextPts[idx], lat: Number(np.lat.toFixed(6)), lng: Number(np.lng.toFixed(6)) };
              }
              return {
                ...prev,
                jf17_airspace_settings: {
                  ...pJf,
                  [lineKey]: { color: ex?.color || JF17_DEFAULT_COLORS[lineKey], closed: Boolean(ex?.closed), points: nextPts },
                },
              };
            });
          });
          m.on('click', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent?.altKey) {
              L.DomEvent.stopPropagation(ev);
              this.callbacks.onMutatePlan((prev) => {
                const pJf = { ...(prev.jf17_airspace_settings || {}) } as Record<string, any>;
                const ex = pJf[lineKey] ?? pJf[lineKey.toLowerCase()] ?? { color: JF17_DEFAULT_COLORS[lineKey], closed: false, points: [] };
                const nextPts = (Array.isArray(ex) ? ex : ex.points || []).filter((_: any, i: number) => i !== idx);
                return {
                  ...prev,
                  jf17_airspace_settings: {
                    ...pJf,
                    [lineKey]: { color: ex?.color || JF17_DEFAULT_COLORS[lineKey], closed: Boolean(ex?.closed), points: nextPts },
                  },
                };
              });
            }
          });
        }
      });
    });
  }
}
