import L from 'leaflet';
import {
  CampaignMapSamSystem,
  CampaignMapSupportAsset,
  CampaignMapSupportAssetTypeOption,
} from '../../../types';
import { calculateBearingDegrees, calculateDistanceNm, computeDestinationPoint } from './geodesy';
import { createPatriotEngagementLayer, SVG_C130 } from './portalLayers';

export interface SupportAssetWorkingItem extends CampaignMapSupportAsset {
  _key: string;
  _isSaved: boolean;
  _isPending: boolean;
}

export interface SupportAssetsControllerStats {
  confirmedCount: number;
  pendingCount: number;
  removedCount: number;
  undoCount: number;
  isDirty: boolean;
}

interface ManagedAssetEntry {
  key: string;
  data: SupportAssetWorkingItem;
  marker: L.Marker;
  rangeLayer: L.Layer | null;
  orbitTrack: L.Polygon | null;
  dcsPlaneMarker: L.Marker | null;
}

interface UndoRemovalEntry {
  kind: 'existing' | 'pending';
  key: string;
  data: SupportAssetWorkingItem;
}

export interface SupportAssetsSyncOptions {
  campaignId: number;
  assets: CampaignMapSupportAsset[];
  supportAssetTypes: CampaignMapSupportAssetTypeOption[];
  samSystems: CampaignMapSamSystem[];
  unit: 'nm' | 'km';
  editMode: boolean;
  focusAssetIndex?: number | null;
  forceReset?: boolean;
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cloneAsset(a: CampaignMapSupportAsset): CampaignMapSupportAsset {
  return {
    ...a,
    waypoints: Array.isArray(a.waypoints) ? a.waypoints.map((w) => ({ ...w })) : a.waypoints,
  };
}

/**
 * Persistent Leaflet controller for Campaign Support Assets matching the Member Portal's
 * direct map-click placement, 60fps draggable markers/orbits/radar wedges, inline Leaflet
 * edit popups, undo removal stack, and pending stats tracking.
 */
export class SupportAssetsMapController {
  private map: L.Map;
  private layerGroup: L.LayerGroup;
  private onStatsChange: (stats: SupportAssetsControllerStats) => void;

  private campaignId: number | null = null;
  private savedAssets: CampaignMapSupportAsset[] = [];
  private supportAssetTypes: CampaignMapSupportAssetTypeOption[] = [];
  private samSystems: CampaignMapSamSystem[] = [];
  private unit: 'nm' | 'km' = 'nm';
  private editMode = false;
  private selectedAssetType = 'tanker';

  private entries = new Map<string, ManagedAssetEntry>();
  private removedIds = new Set<number>();
  private undoStack: UndoRemovalEntry[] = [];
  private newCounter = 0;
  private lastSavedSig = '';
  private lastFocusedIdx: number | null = null;

  constructor(
    map: L.Map,
    layerGroup: L.LayerGroup,
    onStatsChange: (stats: SupportAssetsControllerStats) => void
  ) {
    this.map = map;
    this.layerGroup = layerGroup;
    this.onStatsChange = onStatsChange;
  }

  public setOnStatsChange(cb: (stats: SupportAssetsControllerStats) => void): void {
    this.onStatsChange = cb;
  }

  public setSelectedAssetType(type: string): void {
    if (type) {
      this.selectedAssetType = type;
    }
  }

  public getStats(): SupportAssetsControllerStats {
    let pendingCount = 0;
    this.entries.forEach((entry) => {
      if (entry.data._isPending || !entry.data._isSaved) {
        pendingCount++;
      }
    });
    const removedCount = this.removedIds.size;
    return {
      confirmedCount: this.savedAssets.length,
      pendingCount,
      removedCount,
      undoCount: this.undoStack.length,
      isDirty: pendingCount > 0 || removedCount > 0,
    };
  }

  private emitStats(): void {
    this.onStatsChange(this.getStats());
  }

  public sync(opts: SupportAssetsSyncOptions): void {
    const campaignChanged = this.campaignId !== opts.campaignId;
    this.campaignId = opts.campaignId;
    this.supportAssetTypes = opts.supportAssetTypes || [];
    this.samSystems = opts.samSystems || [];

    const unitChanged = this.unit !== opts.unit;
    const editModeChanged = this.editMode !== opts.editMode;
    this.unit = opts.unit;
    this.editMode = opts.editMode;

    if (this.supportAssetTypes.length > 0) {
      const hasCurrent = this.supportAssetTypes.some((t) => t.value === this.selectedAssetType);
      if (!hasCurrent) {
        const tankerOpt = this.supportAssetTypes.find((t) => t.value === 'tanker');
        this.selectedAssetType = tankerOpt ? tankerOpt.value : this.supportAssetTypes[0].value;
      }
    }

    const incomingSig = JSON.stringify(opts.assets || []);
    const assetsChanged = incomingSig !== this.lastSavedSig;
    const isDirty = this.getStats().isDirty;

    if (campaignChanged || opts.forceReset) {
      this.savedAssets = (opts.assets || []).map(cloneAsset);
      this.lastSavedSig = incomingSig;
      this.removedIds.clear();
      this.undoStack = [];
      this.rebuildAllFromSaved();
      this.emitStats();
    } else if (!isDirty && (assetsChanged || unitChanged || editModeChanged)) {
      this.savedAssets = (opts.assets || []).map(cloneAsset);
      this.lastSavedSig = incomingSig;
      this.rebuildAllFromSaved(true);
      this.emitStats();
    } else {
      // Dirty edits exist: preserve unsaved work, only update live DCS telemetry + mode/unit
      if (assetsChanged) {
        this.savedAssets = (opts.assets || []).map(cloneAsset);
        this.lastSavedSig = incomingSig;
        this.mergeLiveDcsTelemetry();
      }
      if (editModeChanged) {
        this.entries.forEach((entry) => this.applyModeToEntry(entry));
      }
      if (unitChanged) {
        this.entries.forEach((entry) => {
          this.updateAssetGraphics(entry);
          if (entry.marker.isPopupOpen()) {
            entry.marker.closePopup();
            entry.marker.openPopup();
          }
        });
      }
      this.emitStats();
    }

    if (
      opts.focusAssetIndex !== undefined &&
      opts.focusAssetIndex !== null &&
      opts.focusAssetIndex !== this.lastFocusedIdx
    ) {
      this.lastFocusedIdx = opts.focusAssetIndex;
      const targetAsset = this.savedAssets[opts.focusAssetIndex];
      if (targetAsset?.id) {
        const entry = this.entries.get(`saved_${targetAsset.id}`);
        if (entry) {
          this.map.flyTo([Number(entry.data.lat), Number(entry.data.lng)], Math.max(this.map.getZoom(), 11), {
            duration: 0.6,
          });
          window.setTimeout(() => entry.marker.openPopup(), 120);
        }
      }
    } else if (opts.focusAssetIndex === null) {
      this.lastFocusedIdx = null;
    }
  }

  public addPendingAt(lat: number, lng: number, openPopup = true): void {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    const defaultType = this.selectedAssetType || 'tanker';
    const defaultSam = this.samSystems[0] || null;

    this.newCounter += 1;
    const key = `new_${this.newCounter}`;
    const data: SupportAssetWorkingItem = {
      _key: key,
      _isSaved: false,
      _isPending: true,
      type: defaultType,
      sam_system_id: defaultSam ? defaultSam.id : null,
      sam_name: defaultType === 'sam' && defaultSam ? defaultSam.name : null,
      range: defaultType === 'sam' && defaultSam ? Number(defaultSam.max_range || defaultSam.range || 0) : undefined,
      title: defaultType === 'sam' && defaultSam ? defaultSam.name : '',
      description: '',
      lat: cleanLat,
      lng: cleanLng,
      heading: 0,
      leg_length: 20,
      altitude: null,
      aircraft_type: null,
      speed: null,
      tacan_channel: null,
      radio_freq: null,
      dcs_group_name: null,
      dcs_group_type: null,
      waypoints: null,
      is_dcs_tracked: false,
    };

    const entry = this.mountEntry(data);
    this.emitStats();

    if (openPopup && entry) {
      window.setTimeout(() => {
        entry.marker.openPopup();
      }, 40);
    }
  }

  public undoRemoval(): void {
    const popped = this.undoStack.pop();
    if (!popped) return;

    if (popped.kind === 'existing' && popped.data.id) {
      this.removedIds.delete(Number(popped.data.id));
    }

    this.mountEntry({
      ...popped.data,
      lat: Number(popped.data.lat),
      lng: Number(popped.data.lng),
    });
    this.emitStats();
  }

  public discardPending(): void {
    this.removedIds.clear();
    this.undoStack = [];
    this.rebuildAllFromSaved();
    this.emitStats();
  }

  public getSavePayload(): {
    supportAssets: Partial<CampaignMapSupportAsset>[];
    removedIds: number[];
  } {
    const supportAssets: Partial<CampaignMapSupportAsset>[] = [];
    this.entries.forEach((entry) => {
      const d = entry.data;
      if (!d._isPending && d._isSaved) return;
      if (d.id && this.removedIds.has(Number(d.id))) return;

      const pos = entry.marker.getLatLng();
      supportAssets.push({
        id: d.id,
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
        type: d.type,
        sam_system_id: d.sam_system_id || null,
        title: d.title || null,
        description: d.description || null,
        heading: d.heading ?? 0,
        leg_length: d.leg_length ?? 20,
        altitude: d.altitude !== undefined && d.altitude !== '' ? d.altitude : null,
        aircraft_type: d.aircraft_type || null,
        speed: d.speed !== undefined && d.speed !== null ? d.speed : null,
        tacan_channel: d.tacan_channel || null,
        radio_freq: d.radio_freq || null,
        dcs_group_name: d.dcs_group_name || null,
        dcs_group_type: d.dcs_group_type || null,
      });
    });

    return {
      supportAssets,
      removedIds: Array.from(this.removedIds),
    };
  }

  public applySavedAssets(freshAssets: CampaignMapSupportAsset[]): void {
    this.savedAssets = (freshAssets || []).map(cloneAsset);
    this.lastSavedSig = JSON.stringify(this.savedAssets);
    this.removedIds.clear();
    this.undoStack = [];
    this.rebuildAllFromSaved(false);
    this.emitStats();
  }

  public clear(): void {
    this.entries.clear();
    this.layerGroup.clearLayers();
    this.removedIds.clear();
    this.undoStack = [];
    this.lastSavedSig = '';
    this.emitStats();
  }

  private mergeLiveDcsTelemetry(): void {
    const byId = new Map<number, CampaignMapSupportAsset>();
    this.savedAssets.forEach((sa) => {
      if (sa.id) byId.set(Number(sa.id), sa);
    });

    this.entries.forEach((entry) => {
      if (!entry.data._isSaved || !entry.data.id) return;
      const fresh = byId.get(Number(entry.data.id));
      if (!fresh) return;
      entry.data.is_dcs_tracked = Boolean(fresh.is_dcs_tracked);
      entry.data.dcs_lat = fresh.dcs_lat ?? null;
      entry.data.dcs_lng = fresh.dcs_lng ?? null;
      entry.data.dcs_heading = fresh.dcs_heading ?? null;
      entry.data.dcs_altitude = fresh.dcs_altitude ?? null;
      entry.data.dcs_speed = fresh.dcs_speed ?? null;
      entry.data.waypoints = fresh.waypoints ?? null;

      if (!entry.data._isPending) {
        Object.assign(entry.data, cloneAsset(fresh));
        entry.marker.setLatLng([Number(fresh.lat), Number(fresh.lng)]);
        entry.marker.setIcon(this.buildMarkerIcon(entry.data));
      }
      this.updateAssetGraphics(entry);
    });
  }

  private rebuildAllFromSaved(preserveOpenPopup = false): void {
    let openKey: string | null = null;
    if (preserveOpenPopup) {
      this.entries.forEach((entry, k) => {
        if (entry.marker.isPopupOpen()) {
          openKey = k;
        }
      });
    }

    this.entries.clear();
    this.layerGroup.clearLayers();

    this.savedAssets.forEach((sa, idx) => {
      const lat = Number(sa.lat);
      const lng = Number(sa.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const legLength =
        sa.leg_length !== undefined && sa.leg_length !== null && String(sa.leg_length) !== ''
          ? Number(sa.leg_length)
          : 20;
      const key = sa.id ? `saved_${sa.id}` : `saved_idx_${idx}`;
      const working: SupportAssetWorkingItem = {
        ...cloneAsset(sa),
        _key: key,
        _isSaved: true,
        _isPending: false,
        lat,
        lng,
        heading: Number(sa.heading) || 0,
        leg_length: legLength,
      };
      const entry = this.mountEntry(working);
      if (openKey && openKey === key && entry) {
        window.setTimeout(() => entry.marker.openPopup(), 60);
      }
    });
  }

  private buildMarkerIcon(data: SupportAssetWorkingItem): L.DivIcon {
    const typeCfg =
      this.supportAssetTypes.find((t) => t.value === data.type) || this.supportAssetTypes[0];
    const fallbackBadge = `<span class="text-[10px] font-bold text-sky-400">${escapeHtml(
      String(data.type || 'SA').slice(0, 2).toUpperCase()
    )}</span>`;
    const iconHtml = typeCfg?.icon || fallbackBadge;
    const isSam = data.type === 'sam';
    const pendingRing = data._isPending
      ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
      : '';
    const callsign = (data.title || (isSam ? data.sam_name || '' : '') || '').trim();

    const badgeInner = isSam
      ? `<div class="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer ${
          data._isPending ? 'bg-stone-900/90 border border-amber-400 ' + pendingRing : ''
        }">${iconHtml}</div>`
      : `<div class="w-7 h-7 rounded-full bg-stone-900/90 border ${
          data._isPending ? 'border-amber-400 ' + pendingRing : 'border-sky-400/90'
        } shadow-md flex items-center justify-center p-1 text-sky-400 hover:scale-110 transition-transform cursor-pointer">${iconHtml}</div>`;

    const callsignHtml = `<div data-sa-pill="1" style="${
      callsign ? '' : 'display:none;'
    }" class="pointer-events-none select-none mt-0.5 px-1.5 py-0.5 rounded bg-stone-950/90 border ${
      data._isPending ? 'border-amber-500/70 text-amber-200' : 'border-sky-500/50 text-sky-200'
    } text-[11px] font-mono font-bold whitespace-nowrap shadow-md leading-none">${escapeHtml(
      callsign
    )}</div>`;

    return L.divIcon({
      className: 'sa-icon group',
      html: `<div class="relative w-7 h-7 flex flex-col items-center justify-start overflow-visible">
        <div class="w-7 h-7 shrink-0 flex items-center justify-center">${badgeInner}</div>
        ${callsignHtml}
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  private refreshMarkerLabelAndBadge(entry: ManagedAssetEntry, iconCategoryChanged = false): void {
    const el = entry.marker.getElement();
    if (!iconCategoryChanged && el) {
      const pill = el.querySelector<HTMLElement>('[data-sa-pill="1"]');
      const titleText = (
        entry.data.title ||
        (entry.data.type === 'sam' ? entry.data.sam_name || '' : '') ||
        ''
      ).trim();
      if (pill) {
        pill.textContent = titleText;
        pill.style.display = titleText ? '' : 'none';
      }
      // If _isPending changed and not yet ringed, swap icon safely preserving popup state
      if (entry.data._isPending && !el.innerHTML.includes('ring-amber-400')) {
        const wasOpen = entry.marker.isPopupOpen();
        entry.marker.setIcon(this.buildMarkerIcon(entry.data));
        if (wasOpen) {
          entry.marker.openPopup();
        }
      }
      return;
    }

    const wasOpen = entry.marker.isPopupOpen();
    entry.marker.setIcon(this.buildMarkerIcon(entry.data));
    if (wasOpen) {
      entry.marker.openPopup();
    }
  }

  private mountEntry(data: SupportAssetWorkingItem): ManagedAssetEntry {
    const existing = this.entries.get(data._key);
    if (existing) {
      this.unmountEntry(existing);
    }

    const marker = L.marker([Number(data.lat), Number(data.lng)], {
      icon: this.buildMarkerIcon(data),
      draggable: this.editMode,
      zIndexOffset: 1100,
    });

    const entry: ManagedAssetEntry = {
      key: data._key,
      data,
      marker,
      rangeLayer: null,
      orbitTrack: null,
      dcsPlaneMarker: null,
    };

    marker.on('click', (e: L.LeafletMouseEvent) => {
      if (e?.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }
      L.DomEvent.stopPropagation(e);
    });

    marker.on('drag', () => {
      this.updateAssetGraphics(entry);
    });

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      entry.data.lat = Number(pos.lat.toFixed(6));
      entry.data.lng = Number(pos.lng.toFixed(6));
      entry.data._isPending = true;
      this.refreshMarkerLabelAndBadge(entry);
      this.emitStats();
    });

    this.entries.set(data._key, entry);
    marker.addTo(this.layerGroup);
    this.applyModeToEntry(entry);
    this.updateAssetGraphics(entry);

    return entry;
  }

  private unmountEntry(entry: ManagedAssetEntry): void {
    entry.marker.closePopup();
    if (this.layerGroup.hasLayer(entry.marker)) {
      this.layerGroup.removeLayer(entry.marker);
    }
    this.clearEntryGraphics(entry);
  }

  private clearEntryGraphics(entry: ManagedAssetEntry): void {
    if (entry.rangeLayer) {
      if (this.layerGroup.hasLayer(entry.rangeLayer)) {
        this.layerGroup.removeLayer(entry.rangeLayer);
      }
      entry.rangeLayer = null;
    }
    if (entry.orbitTrack) {
      if (this.layerGroup.hasLayer(entry.orbitTrack)) {
        this.layerGroup.removeLayer(entry.orbitTrack);
      }
      entry.orbitTrack = null;
    }
    if (entry.dcsPlaneMarker) {
      if (this.layerGroup.hasLayer(entry.dcsPlaneMarker)) {
        this.layerGroup.removeLayer(entry.dcsPlaneMarker);
      }
      entry.dcsPlaneMarker = null;
    }
  }

  private applyModeToEntry(entry: ManagedAssetEntry): void {
    if (this.editMode) {
      if (entry.marker.dragging) {
        entry.marker.dragging.enable();
      }
      entry.marker.unbindPopup();
      entry.marker.bindPopup(() => this.createSupportAssetPopupContent(entry), {
        maxWidth: 340,
        minWidth: 270,
        autoPan: true,
      });
    } else {
      if (entry.marker.dragging) {
        entry.marker.dragging.disable();
      }
      entry.marker.unbindPopup();
      entry.marker.bindPopup(this.getSupportAssetViewPopupContent(entry.data), {
        maxWidth: 330,
      });
    }
  }

  private removeEntry(entry: ManagedAssetEntry): void {
    entry.marker.closePopup();
    this.unmountEntry(entry);
    this.entries.delete(entry.key);

    if (entry.data._isSaved && entry.data.id) {
      const id = Number(entry.data.id);
      if (!this.removedIds.has(id)) {
        this.removedIds.add(id);
        this.undoStack.push({
          kind: 'existing',
          key: entry.key,
          data: { ...entry.data },
        });
      }
    } else {
      this.undoStack.push({
        kind: 'pending',
        key: entry.key,
        data: { ...entry.data },
      });
    }

    this.emitStats();
  }

  private updateAssetGraphics(entry: ManagedAssetEntry): void {
    const pos = entry.marker.getLatLng();
    const data = entry.data;

    if (data.type === 'sam') {
      if (entry.orbitTrack) {
        if (this.layerGroup.hasLayer(entry.orbitTrack)) this.layerGroup.removeLayer(entry.orbitTrack);
        entry.orbitTrack = null;
      }
      if (entry.dcsPlaneMarker) {
        if (this.layerGroup.hasLayer(entry.dcsPlaneMarker)) {
          this.layerGroup.removeLayer(entry.dcsPlaneMarker);
        }
        entry.dcsPlaneMarker = null;
      }

      let maxRangeNm = 0;
      let samSysName = data.sam_name || '';
      if (data.sam_system_id) {
        const sys = this.samSystems.find((s) => Number(s.id) === Number(data.sam_system_id));
        if (sys) {
          maxRangeNm = Number(sys.max_range || sys.range || 0);
          samSysName = sys.name || samSysName;
          if (!data.title) {
            data.title = sys.name;
          }
        }
      }
      if (maxRangeNm <= 0 && data.range) {
        maxRangeNm = Number(data.range);
      }

      if (maxRangeNm <= 0) {
        if (entry.rangeLayer && this.layerGroup.hasLayer(entry.rangeLayer)) {
          this.layerGroup.removeLayer(entry.rangeLayer);
        }
        entry.rangeLayer = null;
        return;
      }

      const titleClean = `${data.title || ''} ${samSysName}`.toLowerCase();
      const isPatriot =
        titleClean.includes('patriot') ||
        titleClean.includes('mpq-53') ||
        titleClean.includes('mpq-65') ||
        titleClean.includes('mim-104');

      if (isPatriot) {
        if (entry.rangeLayer && this.layerGroup.hasLayer(entry.rangeLayer)) {
          this.layerGroup.removeLayer(entry.rangeLayer);
        }
        const heading =
          data.heading !== undefined && data.heading !== null && Number.isFinite(Number(data.heading))
            ? Number(data.heading)
            : 0;
        entry.rangeLayer = createPatriotEngagementLayer([pos.lat, pos.lng], heading, maxRangeNm, {
          strokeColor: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(this.layerGroup);
      } else if (entry.rangeLayer instanceof L.Circle) {
        entry.rangeLayer.setLatLng(pos);
        entry.rangeLayer.setRadius(maxRangeNm * 1852);
      } else {
        if (entry.rangeLayer && this.layerGroup.hasLayer(entry.rangeLayer)) {
          this.layerGroup.removeLayer(entry.rangeLayer);
        }
        entry.rangeLayer = L.circle(pos, {
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
          radius: maxRangeNm * 1852,
          weight: 1.5,
          dashArray: '5, 5',
          interactive: false,
        }).addTo(this.layerGroup);
      }
      return;
    }

    if (data.type === 'tanker' || data.type === 'awacs') {
      if (entry.rangeLayer) {
        if (this.layerGroup.hasLayer(entry.rangeLayer)) this.layerGroup.removeLayer(entry.rangeLayer);
        entry.rangeLayer = null;
      }

      let heading = Number(data.heading) || 0;
      let legLength =
        data.leg_length !== undefined && data.leg_length !== null && String(data.leg_length) !== ''
          ? Number(data.leg_length)
          : 20;

      if (Array.isArray(data.waypoints) && data.waypoints.length >= 2 && !data.heading) {
        const w1 = data.waypoints[0];
        const w2 = data.waypoints[1];
        const w1Lat = Number(w1.lat);
        const w1Lng = Number(w1.lng);
        const w2Lat = Number(w2.lat);
        const w2Lng = Number(w2.lng);
        if (
          Number.isFinite(w1Lat) &&
          Number.isFinite(w1Lng) &&
          Number.isFinite(w2Lat) &&
          Number.isFinite(w2Lng)
        ) {
          heading = calculateBearingDegrees(w1Lat, w1Lng, w2Lat, w2Lng);
          legLength = calculateDistanceNm(w1Lat, w1Lng, w2Lat, w2Lng);
        }
      }

      if (legLength > 0) {
        const dest = computeDestinationPoint(pos.lat, pos.lng, heading, legLength);
        const radiusNm = 5;
        const pts: Array<[number, number]> = [];
        const p0 = computeDestinationPoint(pos.lat, pos.lng, heading + 90, radiusNm);
        pts.push([p0.lat, p0.lng]);

        for (let i = 0; i <= 180; i += 10) {
          const p = computeDestinationPoint(dest.lat, dest.lng, heading + 90 - i, radiusNm);
          pts.push([p.lat, p.lng]);
        }
        for (let i = 0; i <= 180; i += 10) {
          const p = computeDestinationPoint(pos.lat, pos.lng, heading - 90 - i, radiusNm);
          pts.push([p.lat, p.lng]);
        }

        if (entry.orbitTrack) {
          entry.orbitTrack.setLatLngs(pts);
        } else {
          entry.orbitTrack = L.polygon(pts, {
            color: '#0284c7',
            weight: 2.5,
            opacity: 0.95,
            fill: true,
            fillColor: '#38bdf8',
            fillOpacity: 0.15,
            dashArray: '6, 6',
            className: 'support-asset-orbit-track',
            interactive: false,
          }).addTo(this.layerGroup);
        }
      } else if (entry.orbitTrack) {
        if (this.layerGroup.hasLayer(entry.orbitTrack)) {
          this.layerGroup.removeLayer(entry.orbitTrack);
        }
        entry.orbitTrack = null;
      }

      // Live DCS plane marker if actively tracked
      if (
        data._isSaved &&
        data.is_dcs_tracked &&
        data.dcs_lat != null &&
        data.dcs_lng != null &&
        Number.isFinite(Number(data.dcs_lat)) &&
        Number.isFinite(Number(data.dcs_lng))
      ) {
        const liveHdg =
          data.dcs_heading !== null && data.dcs_heading !== undefined
            ? Number(data.dcs_heading)
            : heading;
        const liveIcon = L.divIcon({
          className: 'support-asset-icon-live-plane',
          html: `<div style="transform: rotate(${liveHdg}deg); width:32px; height:32px;" class="text-sky-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] cursor-pointer">${SVG_C130}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (!entry.dcsPlaneMarker) {
          const livePlaneMarker = L.marker([Number(data.dcs_lat), Number(data.dcs_lng)], {
            icon: liveIcon,
            zIndexOffset: 1200,
          });
          livePlaneMarker.bindPopup(this.getSupportAssetViewPopupContent(data), { maxWidth: 330 });
          livePlaneMarker.bindTooltip(
            `<div class="text-xs font-semibold text-sky-400">${escapeHtml(
              data.title || data.dcs_group_name || 'LIVE ASSET'
            )}</div>`,
            { direction: 'top', offset: [0, -10] }
          );
          entry.dcsPlaneMarker = livePlaneMarker.addTo(this.layerGroup);
        } else {
          entry.dcsPlaneMarker.setLatLng([Number(data.dcs_lat), Number(data.dcs_lng)]);
          entry.dcsPlaneMarker.setIcon(liveIcon);
        }
      } else if (entry.dcsPlaneMarker) {
        if (this.layerGroup.hasLayer(entry.dcsPlaneMarker)) {
          this.layerGroup.removeLayer(entry.dcsPlaneMarker);
        }
        entry.dcsPlaneMarker = null;
      }
      return;
    }

    // Any other type: clean up range/orbit/plane markers
    this.clearEntryGraphics(entry);
  }

  private getSupportAssetViewPopupContent(data: SupportAssetWorkingItem): string {
    const isKM = this.unit === 'km';
    const rawAlt =
      data.altitude !== null && data.altitude !== undefined && data.altitude !== ''
        ? Number(data.altitude)
        : null;
    const displayAlt =
      rawAlt !== null && Number.isFinite(rawAlt)
        ? isKM
          ? Math.round(rawAlt * 0.3048)
          : rawAlt
        : null;
    const rawLeg =
      data.leg_length !== null && data.leg_length !== undefined
        ? Number(data.leg_length)
        : null;
    const displayLeg =
      rawLeg !== null && Number.isFinite(rawLeg)
        ? isKM
          ? parseFloat((rawLeg * 1.852).toFixed(1))
          : rawLeg
        : null;
    const altUnit = isKM ? 'm MSL' : 'ft MSL';
    const legUnit = isKM ? 'KM' : 'NM';

    let samRange = data.range ? Number(data.range) : null;
    if (data.type === 'sam' && !samRange && data.sam_system_id) {
      const sys = this.samSystems.find((s) => Number(s.id) === Number(data.sam_system_id));
      if (sys) samRange = Number(sys.max_range || sys.range || 0);
    }

    const typeUpper = (data.type || 'ASSET').toUpperCase();
    const titleText =
      data.title || (data.type === 'sam' ? data.sam_name || 'SAM Site' : 'Support Asset');
    const aircraftType = data.aircraft_type ? String(data.aircraft_type).trim() : '';
    const isOrbitType = data.type === 'tanker' || data.type === 'awacs';

    return `
      <div class="p-1 w-[290px] text-stone-200 font-sans">
        <div class="border-b border-stone-700/80 pb-2 mb-2 pr-6">
          <h3 class="font-extrabold text-base text-white truncate" title="${escapeHtml(titleText)}">${escapeHtml(
            titleText
          )}</h3>
          <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span class="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-sky-950/90 text-sky-400 border border-sky-800/60 whitespace-nowrap">${escapeHtml(
              typeUpper
            )}</span>
            ${
              aircraftType
                ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800/60 whitespace-nowrap">${escapeHtml(
                    aircraftType
                  )}</span>`
                : ''
            }
            ${
              data.is_dcs_tracked
                ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 whitespace-nowrap">LIVE DCS</span>`
                : ''
            }
          </div>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-stone-300 my-2.5">
          ${
            displayAlt !== null
              ? `<div><span class="text-stone-400 font-medium">ALT:</span> <span class="font-semibold text-stone-100 whitespace-nowrap">${displayAlt.toLocaleString()} ${altUnit}</span></div>`
              : ''
          }
          ${
            data.speed
              ? `<div><span class="text-stone-400 font-medium">SPD:</span> <span class="font-semibold text-stone-100 whitespace-nowrap">${data.speed} kts</span></div>`
              : ''
          }
          ${
            isOrbitType && data.heading !== null && data.heading !== undefined
              ? `<div><span class="text-stone-400 font-medium">HDG:</span> <span class="font-semibold text-stone-100 whitespace-nowrap">${Math.round(
                  Number(data.heading)
                )}°</span></div>`
              : ''
          }
          ${
            isOrbitType && displayLeg !== null
              ? `<div><span class="text-stone-400 font-medium">LEG:</span> <span class="font-semibold text-stone-100 whitespace-nowrap">${displayLeg} ${legUnit}</span></div>`
              : ''
          }
          ${
            data.type === 'sam' && data.heading !== null && data.heading !== undefined
              ? `<div><span class="text-stone-400 font-medium">RADAR HDG:</span> <span class="font-semibold text-stone-100 whitespace-nowrap">${Math.round(
                  Number(data.heading)
                )}°</span></div>`
              : ''
          }
          ${
            data.type === 'sam' && samRange
              ? `<div><span class="text-stone-400 font-medium">MAX RNG:</span> <span class="font-semibold text-sky-400 whitespace-nowrap">${samRange} NM</span></div>`
              : ''
          }
          ${
            data.tacan_channel
              ? `<div><span class="text-stone-400 font-medium">TACAN:</span> <span class="font-semibold text-emerald-400 font-mono whitespace-nowrap">${escapeHtml(
                  data.tacan_channel
                )}</span></div>`
              : ''
          }
          ${
            data.radio_freq
              ? `<div class="${isOrbitType ? '' : 'col-span-2'}"><span class="text-stone-400 font-medium">FREQ:</span> <span class="font-semibold text-amber-400 font-mono whitespace-nowrap">${escapeHtml(
                  data.radio_freq
                )}</span></div>`
              : ''
          }
        </div>
        ${
          data.description
            ? `<p class="mt-2.5 pt-2 border-t border-stone-800 text-xs text-stone-400 leading-relaxed whitespace-pre-wrap">${escapeHtml(
                data.description
              )}</p>`
            : ''
        }
      </div>
    `;
  }

  private createSupportAssetPopupContent(entry: ManagedAssetEntry): HTMLElement {
    const data = entry.data;
    const isKM = this.unit === 'km';
    const altLabel = isKM ? 'Altitude (m MSL)' : 'Altitude (ft MSL)';
    const legLabel = isKM ? 'KM' : 'NM';

    const inputAlt =
      data.altitude !== null && data.altitude !== undefined && data.altitude !== ''
        ? String(isKM ? Math.round(Number(data.altitude) * 0.3048) : data.altitude)
        : '';
    const inputLeg =
      data.leg_length !== null && data.leg_length !== undefined
        ? String(isKM ? parseFloat((Number(data.leg_length) * 1.852).toFixed(1)) : data.leg_length)
        : '';

    const container = document.createElement('div');
    container.className = 'p-1 min-w-[260px] space-y-3 font-sans';
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const typeOptions = this.supportAssetTypes
      .map(
        (t) =>
          `<option value="${escapeHtml(t.value)}" ${
            data.type === t.value ? 'selected' : ''
          }>${escapeHtml(t.label)}</option>`
      )
      .join('');
    const samOptions = this.samSystems
      .map(
        (s) =>
          `<option value="${s.id}" ${
            Number(data.sam_system_id) === Number(s.id) ? 'selected' : ''
          }>${escapeHtml(s.name)}</option>`
      )
      .join('');

    const inputClasses =
      'w-full bg-zinc-800/90 border border-zinc-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-zinc-100 font-semibold rounded-md px-2.5 py-1 text-xs transition-colors placeholder:text-zinc-500';
    const labelClasses =
      'block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1';
    const titleText = data.title || 'Support Asset';
    const isOrbit = data.type === 'tanker' || data.type === 'awacs';
    const hasDcsGroup = Boolean(data.dcs_group_name && String(data.dcs_group_name).trim() !== '');

    container.innerHTML = `
      <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
            SUPPORT
          </span>
          <h3 class="sa-header-title text-sm font-bold text-zinc-100 truncate max-w-[165px]" title="${escapeHtml(
            titleText
          )}">${escapeHtml(titleText)}</h3>
        </div>
      </div>

      <div class="space-y-2.5">
        <div>
          <label class="${labelClasses}">Asset Category / Type</label>
          <select class="sa-type-select ${inputClasses}">
            ${typeOptions}
          </select>
        </div>

        <div>
          <label class="${labelClasses}">Callsign / Title</label>
          <input type="text" class="sa-title-input ${inputClasses}" value="${escapeHtml(
            data.title || ''
          )}" placeholder="e.g. AR-1 TEXACO">
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="${labelClasses}">Aircraft Type</label>
            <input type="text" class="sa-aircraft-type-input ${inputClasses}" value="${escapeHtml(
              data.aircraft_type || ''
            )}" placeholder="e.g. KC-135MPRS">
          </div>
          <div>
            <label class="${labelClasses}">Speed (kts)</label>
            <input type="number" step="5" class="sa-speed-input ${inputClasses} font-mono" value="${
              data.speed ?? ''
            }" placeholder="e.g. 350">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="${labelClasses}">TACAN Channel</label>
            <input type="text" class="sa-tacan-input ${inputClasses} font-mono" value="${escapeHtml(
              data.tacan_channel || ''
            )}" placeholder="e.g. 63X">
          </div>
          <div>
            <label class="${labelClasses}">Radio Freq</label>
            <input type="text" class="sa-freq-input ${inputClasses} font-mono" value="${escapeHtml(
              data.radio_freq || ''
            )}" placeholder="e.g. 251.000 AM">
          </div>
        </div>

        <div class="sa-sam-wrapper space-y-2" style="${data.type !== 'sam' ? 'display:none;' : ''}">
          <div>
            <label class="${labelClasses}">SAM System</label>
            <select class="sa-sam-select ${inputClasses}">
              <option value="">Unknown / None</option>
              ${samOptions}
            </select>
          </div>
          <div>
            <label class="${labelClasses}">Radar Heading / Azimuth (°)</label>
            <input type="number" step="1" min="0" max="359" class="sa-sam-heading-input ${inputClasses} font-mono" value="${
              data.heading ?? 0
            }" placeholder="e.g. 60">
            <p class="text-[11px] text-zinc-400 mt-0.5">Directional systems like Patriot orient their engagement cone along this heading.</p>
          </div>
        </div>

        <div class="sa-dcs-track-info text-[11px] text-amber-400 italic py-1" style="${
          isOrbit && hasDcsGroup ? '' : 'display:none;'
        }">
          ⚡ Heading &amp; leg length are derived from WP1 → WP2 of the DCS group.
        </div>

        <div class="sa-track-wrapper grid grid-cols-2 gap-2" style="${
          !isOrbit || hasDcsGroup ? 'display:none;' : ''
        }">
          <div>
            <label class="${labelClasses}">Leg Length (${legLabel})</label>
            <input type="number" step="1" class="sa-leg-input ${inputClasses} font-mono" value="${escapeHtml(
              inputLeg
            )}">
          </div>
          <div>
            <label class="${labelClasses}">Heading (°)</label>
            <input type="number" step="1" min="0" max="359" class="sa-heading-input ${inputClasses} font-mono" value="${
              data.heading ?? 0
            }">
          </div>
        </div>

        <div class="sa-alt-wrapper" style="${data.type === 'sam' ? 'display:none;' : ''}">
          <label class="${labelClasses}">${altLabel}</label>
          <input type="number" step="${isKM ? 100 : 500}" class="sa-altitude-input ${inputClasses} font-mono" value="${escapeHtml(
            inputAlt
          )}" placeholder="e.g. ${isKM ? 8000 : 25000}">
        </div>

        <div>
          <label class="${labelClasses}">Intel / Mission Notes</label>
          <textarea class="sa-desc-input ${inputClasses} resize-y" rows="2" placeholder="Optional notes...">${escapeHtml(
            data.description || ''
          )}</textarea>
        </div>

        <div class="pt-2 border-t border-zinc-800 mt-2">
          <label class="${labelClasses}">DCS Live Tracking (Admin)</label>
          <div class="space-y-1.5">
            <input type="text" class="sa-dcs-group-input ${inputClasses}" value="${escapeHtml(
              data.dcs_group_name || ''
            )}" placeholder="DCS Group Name (optional)">
            <select class="sa-dcs-group-type-select ${inputClasses}">
              <option value="">-- No DCS Tracking --</option>
              <option value="plane" ${data.dcs_group_type === 'plane' ? 'selected' : ''}>Plane</option>
              <option value="helicopter" ${
                data.dcs_group_type === 'helicopter' ? 'selected' : ''
              }>Helicopter</option>
              <option value="vehicle" ${
                data.dcs_group_type === 'vehicle' ? 'selected' : ''
              }>Vehicle</option>
              <option value="ship" ${data.dcs_group_type === 'ship' ? 'selected' : ''}>Ship</option>
              <option value="static" ${
                data.dcs_group_type === 'static' ? 'selected' : ''
              }>Static</option>
            </select>
          </div>
        </div>

        <div class="pt-2 border-t border-zinc-800 mt-2">
          <button type="button" class="sa-remove-btn w-full bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 hover:text-red-100 text-xs font-semibold py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
            Delete Support Asset
          </button>
        </div>
      </div>
    `;

    const headerTitleEl = container.querySelector<HTMLElement>('.sa-header-title');
    const typeSelect = container.querySelector<HTMLSelectElement>('.sa-type-select')!;
    const samWrapper = container.querySelector<HTMLElement>('.sa-sam-wrapper')!;
    const samSelect = container.querySelector<HTMLSelectElement>('.sa-sam-select')!;
    const samHeadingInput = container.querySelector<HTMLInputElement>('.sa-sam-heading-input')!;
    const trackWrapper = container.querySelector<HTMLElement>('.sa-track-wrapper')!;
    const dcsTrackInfo = container.querySelector<HTMLElement>('.sa-dcs-track-info')!;
    const altWrapper = container.querySelector<HTMLElement>('.sa-alt-wrapper')!;
    const legInput = container.querySelector<HTMLInputElement>('.sa-leg-input')!;
    const headingInput = container.querySelector<HTMLInputElement>('.sa-heading-input')!;
    const altitudeInput = container.querySelector<HTMLInputElement>('.sa-altitude-input')!;
    const titleInput = container.querySelector<HTMLInputElement>('.sa-title-input')!;
    const descInput = container.querySelector<HTMLTextAreaElement>('.sa-desc-input')!;
    const aircraftTypeInput = container.querySelector<HTMLInputElement>('.sa-aircraft-type-input')!;
    const speedInput = container.querySelector<HTMLInputElement>('.sa-speed-input')!;
    const tacanInput = container.querySelector<HTMLInputElement>('.sa-tacan-input')!;
    const freqInput = container.querySelector<HTMLInputElement>('.sa-freq-input')!;
    const dcsGroupInput = container.querySelector<HTMLInputElement>('.sa-dcs-group-input')!;
    const dcsGroupTypeSelect = container.querySelector<HTMLSelectElement>(
      '.sa-dcs-group-type-select'
    )!;
    const removeBtn = container.querySelector<HTMLButtonElement>('.sa-remove-btn')!;

    const markPending = () => {
      const wasPending = data._isPending;
      data._isPending = true;
      if (!wasPending) {
        this.refreshMarkerLabelAndBadge(entry);
      }
      this.emitStats();
    };

    const syncHeaderAndPill = () => {
      const displayTitle = data.title || 'Support Asset';
      if (headerTitleEl) {
        headerTitleEl.textContent = displayTitle;
        headerTitleEl.title = displayTitle;
      }
      this.refreshMarkerLabelAndBadge(entry, false);
    };

    typeSelect.addEventListener('change', () => {
      data.type = typeSelect.value;
      const isSamNow = data.type === 'sam';
      const isOrbitNow = data.type === 'tanker' || data.type === 'awacs';
      const hasDcsNow = Boolean(data.dcs_group_name && String(data.dcs_group_name).trim() !== '');

      samWrapper.style.display = isSamNow ? 'block' : 'none';
      altWrapper.style.display = isSamNow ? 'none' : 'block';
      trackWrapper.style.display = isOrbitNow && !hasDcsNow ? 'grid' : 'none';
      dcsTrackInfo.style.display = isOrbitNow && hasDcsNow ? 'block' : 'none';

      if (isSamNow && !data.sam_system_id && this.samSystems.length > 0) {
        const firstSam = this.samSystems[0];
        data.sam_system_id = firstSam.id;
        data.sam_name = firstSam.name;
        data.range = Number(firstSam.max_range || firstSam.range || 0);
        samSelect.value = String(firstSam.id);
        if (!data.title || data.title === 'Support Asset') {
          data.title = firstSam.name;
          titleInput.value = firstSam.name;
          syncHeaderAndPill();
        }
      }

      data._isPending = true;
      this.refreshMarkerLabelAndBadge(entry, true);
      this.updateAssetGraphics(entry);
      this.emitStats();
    });

    samSelect.addEventListener('change', () => {
      const selectedId = samSelect.value ? parseInt(samSelect.value, 10) : null;
      data.sam_system_id = selectedId;
      const sys = this.samSystems.find((s) => Number(s.id) === Number(selectedId));
      if (sys) {
        if (
          !data.title ||
          data.title === 'Support Asset' ||
          this.samSystems.some((s) => s.name === data.title)
        ) {
          data.title = sys.name;
          titleInput.value = sys.name;
          syncHeaderAndPill();
        }
        data.sam_name = sys.name;
        data.range = Number(sys.max_range || sys.range || 0);
      }
      this.updateAssetGraphics(entry);
      markPending();
    });

    const onSamHeadingChange = () => {
      const val = parseFloat(samHeadingInput.value) || 0;
      data.heading = val;
      headingInput.value = String(val);
      this.updateAssetGraphics(entry);
      markPending();
    };
    samHeadingInput.addEventListener('input', onSamHeadingChange);
    samHeadingInput.addEventListener('change', onSamHeadingChange);

    legInput.addEventListener('input', () => {
      const val = parseFloat(legInput.value) || 0;
      data.leg_length = this.unit === 'km' ? Number((val / 1.852).toFixed(2)) : val;
      this.updateAssetGraphics(entry);
      markPending();
    });

    headingInput.addEventListener('input', () => {
      const val = parseFloat(headingInput.value) || 0;
      data.heading = val;
      samHeadingInput.value = String(val);
      this.updateAssetGraphics(entry);
      markPending();
    });

    altitudeInput.addEventListener('input', () => {
      const raw = altitudeInput.value.trim();
      if (!raw) {
        data.altitude = null;
      } else {
        const parsed = parseInt(raw, 10);
        data.altitude = Number.isFinite(parsed)
          ? this.unit === 'km'
            ? Math.round(parsed / 0.3048)
            : parsed
          : null;
      }
      markPending();
    });

    titleInput.addEventListener('input', () => {
      data.title = titleInput.value;
      syncHeaderAndPill();
      markPending();
    });

    descInput.addEventListener('input', () => {
      data.description = descInput.value;
      markPending();
    });

    aircraftTypeInput.addEventListener('input', () => {
      data.aircraft_type = aircraftTypeInput.value || null;
      markPending();
    });

    speedInput.addEventListener('input', () => {
      const val = parseInt(speedInput.value, 10);
      data.speed = Number.isNaN(val) ? null : val;
      markPending();
    });

    tacanInput.addEventListener('input', () => {
      data.tacan_channel = tacanInput.value || null;
      markPending();
    });

    freqInput.addEventListener('input', () => {
      data.radio_freq = freqInput.value || null;
      markPending();
    });

    dcsGroupInput.addEventListener('input', () => {
      data.dcs_group_name = dcsGroupInput.value || null;
      const isOrbitNow = data.type === 'tanker' || data.type === 'awacs';
      const hasDcsNow = Boolean(data.dcs_group_name && String(data.dcs_group_name).trim() !== '');
      if (isOrbitNow) {
        trackWrapper.style.display = hasDcsNow ? 'none' : 'grid';
        dcsTrackInfo.style.display = hasDcsNow ? 'block' : 'none';
      }
      markPending();
    });

    dcsGroupTypeSelect.addEventListener('change', () => {
      data.dcs_group_type = dcsGroupTypeSelect.value || null;
      markPending();
    });

    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeEntry(entry);
    });

    return container;
  }
}
