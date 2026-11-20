import L from 'leaflet';
import {
  CampaignMapTacticalIcon,
  CampaignMapTacticalMarking,
} from '../../../types';
import { computeDestinationPoint } from './geodesy';

export type TacticalShapeType = 'line' | 'polygon' | 'rectangle' | 'circle' | 'text' | 'icon';

export interface NormalizedTacticalIcon {
  id: string;
  label: string;
  category: string;
  defaultColor: string;
  svg: string;
}

export interface NormalizedIconCatalog {
  list: NormalizedTacticalIcon[];
  byId: Record<string, NormalizedTacticalIcon>;
  categories: string[];
}

export interface TacticalDrawConfig {
  shape: TacticalShapeType;
  color: string;
  fillColor: string;
  weight: number;
  dashArray: string | null;
  fillOpacity: number;
  label?: string;
  text?: string;
  fontSize?: number;
  boxBg?: boolean;
  iconId?: string;
  unit: 'nm' | 'km';
}

export interface TacticalMarkingDraftCompletion {
  marking_type: string;
  geometry: Record<string, any>;
  properties: Record<string, any>;
}

export interface TacticalMarkingsControllerCallbacks {
  onSelectMarking: (marking: CampaignMapTacticalMarking) => void;
  onDeselectMarking: () => void;
  onCompleteDraw: (result: TacticalMarkingDraftCompletion) => void;
  onCommitGeometry: (
    markingId: number,
    geometry: Record<string, any>,
    propertyPatch?: Record<string, any>
  ) => void;
  onDrawStateChange: (isDrawing: boolean, shape: TacticalShapeType | null) => void;
}

const PORTAL_CATEGORY_ORDER = [
  'Ground Units',
  'Air Defense & Radar',
  'Structures',
  'Aviation',
  'Tactical Points',
  'Weapons & Other',
];

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function normalizeTacticalIcons(
  raw: Record<string, CampaignMapTacticalIcon> | CampaignMapTacticalIcon[] | undefined | null
): NormalizedIconCatalog {
  const list: NormalizedTacticalIcon[] = [];
  const byId: Record<string, NormalizedTacticalIcon> = {};

  if (!raw) {
    return { list, byId, categories: ['Ground Units', 'Structures', 'Tactical Points'] };
  }

  const entries: Array<[string, CampaignMapTacticalIcon]> = Array.isArray(raw)
    ? raw.map((item, idx) => [String(item.id || item.key || idx), item])
    : Object.entries(raw);

  entries.forEach(([mapKey, item]) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || item.key || mapKey);
    const norm: NormalizedTacticalIcon = {
      id,
      label: String(item.label || item.name || id),
      category: String(item.category || 'General'),
      defaultColor: String(item.defaultColor || '#f59e0b'),
      svg: String(item.svg || ''),
    };
    list.push(norm);
    byId[id] = norm;
  });

  const seenCats = new Set(list.map((i) => i.category));
  const ordered: string[] = [];
  PORTAL_CATEGORY_ORDER.forEach((cat) => {
    if (seenCats.has(cat)) {
      ordered.push(cat);
      seenCats.delete(cat);
    }
  });
  seenCats.forEach((cat) => ordered.push(cat));

  return {
    list,
    byId,
    categories: ordered.length > 0 ? ordered : ['Ground Units', 'Structures', 'Tactical Points'],
  };
}

/**
 * Pure-Leaflet Tactical Markings controller replicating Member Portal `tacticalMarkingLayer.js`:
 * - Dedicated `tacticalMarkingsPane` (zIndex 430)
 * - Visibility filtering (personal, campaign, mission, sortie)
 * - Live interactive drawing (`line`, `polygon`, `rectangle`, `circle`, `text`, `icon`)
 * - Live interactive editing handles (markers, line/polygon vertices + midpoints + Alt+Click delete,
 *   rectangle 4 corners + center move, circle center move + radius resize handle)
 */
export class TacticalMarkingsMapController {
  private map: L.Map;
  private markingsGroup: L.LayerGroup;
  private draftGroup: L.LayerGroup;
  private callbacks: TacticalMarkingsControllerCallbacks;

  private markings: CampaignMapTacticalMarking[] = [];
  private iconsById: Record<string, NormalizedTacticalIcon> = {};
  private selectedMissionId: number | null = null;
  private selectedSortieId: number | null = null;
  private editingMarkingId: number | null = null;
  private isModeActive = false;

  private layerById = new Map<number, L.Layer>();
  private metaById = new Map<number, CampaignMapTacticalMarking>();

  // Drawing state
  private drawConfig: TacticalDrawConfig | null = null;
  private drawVertices: L.LatLng[] = [];
  private drawPreviewShape: L.Layer | null = null;
  private drawCursorMarker: L.Marker | null = null;
  private drawStartPoint: L.LatLng | null = null;
  private drawTip: L.Tooltip | null = null;
  private lastClickClient: { x: number; y: number; time: number } | null = null;

  private boundOnMouseMove: (e: L.LeafletMouseEvent) => void;
  private boundOnMapClick: (e: L.LeafletMouseEvent) => void;
  private boundOnMapDblClick: (e: L.LeafletMouseEvent) => void;

  private layerJustClickedAt = 0;

  constructor(
    map: L.Map,
    markingsGroup: L.LayerGroup,
    draftGroup: L.LayerGroup,
    callbacks: TacticalMarkingsControllerCallbacks
  ) {
    this.map = map;
    this.markingsGroup = markingsGroup;
    this.draftGroup = draftGroup;
    this.callbacks = callbacks;

    if (!this.map.getPane('tacticalMarkingsPane')) {
      const pane = this.map.createPane('tacticalMarkingsPane');
      pane.style.zIndex = '430';
    }

    this.boundOnMouseMove = (e) => this.handleDrawMouseMove(e);
    this.boundOnMapClick = (e) => this.handleDrawClick(e);
    this.boundOnMapDblClick = (e) => this.handleDrawDblClick(e);
  }

  public setCallbacks(callbacks: TacticalMarkingsControllerCallbacks): void {
    this.callbacks = callbacks;
  }

  public isDrawing(): boolean {
    return this.drawConfig !== null;
  }

  public wasLayerClickedRecently(): boolean {
    return Date.now() - this.layerJustClickedAt < 180;
  }

  public sync(opts: {
    markings: CampaignMapTacticalMarking[];
    icons: Record<string, CampaignMapTacticalIcon> | CampaignMapTacticalIcon[];
    selectedMissionId: number | null;
    selectedSortieId: number | null;
    editingMarkingId: number | null;
    isModeActive: boolean;
  }): void {
    this.markings = opts.markings || [];
    this.iconsById = normalizeTacticalIcons(opts.icons).byId;
    this.selectedMissionId = opts.selectedMissionId;
    this.selectedSortieId = opts.selectedSortieId;
    this.editingMarkingId = opts.editingMarkingId;
    this.isModeActive = opts.isModeActive;

    this.renderMarkings();
    if (!this.isDrawing()) {
      this.rebuildEditHandles();
    }
  }

  public setEditingMarkingId(id: number | null): void {
    this.editingMarkingId = id;
    if (!this.isDrawing()) {
      this.rebuildEditHandles();
    }
  }

  public flyToMarking(id: number): void {
    const layer = this.layerById.get(id);
    if (!layer) return;

    if (typeof (layer as any).getBounds === 'function') {
      const bounds = (layer as L.Polygon).getBounds();
      if (bounds.isValid()) {
        this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 0.65 });
      }
    } else if (typeof (layer as any).getLatLng === 'function') {
      this.map.flyTo((layer as L.Marker).getLatLng(), Math.max(this.map.getZoom(), 13), {
        duration: 0.65,
      });
    }
  }

  public updateEditingStyle(
    id: number,
    style: {
      color?: string;
      fillColor?: string;
      fillOpacity?: number;
      weight?: number;
      dashArray?: string | null;
      label?: string;
      text?: string;
      fontSize?: number;
      boxBg?: boolean;
      icon?: string | null;
    }
  ): void {
    const layer = this.layerById.get(id);
    const meta = this.metaById.get(id);
    if (!layer || !meta) return;

    const mergedProps: Record<string, any> = { ...(meta.properties || {}), ...style };
    meta.properties = mergedProps;
    const shape = String(mergedProps.shape || '').toLowerCase();

    if (layer instanceof L.Marker) {
      if (shape === 'text') {
        layer.setIcon(this.createTextDivIcon(mergedProps));
      } else {
        const iconId = String(mergedProps.icon || mergedProps.icon_id || 'armored');
        layer.setIcon(
          this.createSvgDivIcon(iconId, {
            color: String(mergedProps.color || '#f59e0b'),
            label: String(mergedProps.label || ''),
            svgOverride: mergedProps.icon_svg,
          })
        );
      }
      return;
    }

    if (typeof (layer as L.Path).setStyle === 'function') {
      const isLine = shape === 'line' || meta.geometry?.type === 'LineString';
      (layer as L.Path).setStyle({
        color: mergedProps.color || '#3388ff',
        fillColor: mergedProps.fillColor || mergedProps.color || '#3388ff',
        weight: mergedProps.weight !== undefined ? Number(mergedProps.weight) : 3,
        dashArray: mergedProps.dashArray || undefined,
        fillOpacity: isLine
          ? 0
          : mergedProps.fillOpacity !== undefined
            ? Number(mergedProps.fillOpacity)
            : 0.2,
      });
    }

    if (shape !== 'text' && shape !== 'icon') {
      layer.unbindTooltip();
      this.bindShapeTooltip(layer, meta, mergedProps, shape);
    }
  }

  public startDrawing(config: TacticalDrawConfig): void {
    this.cancelDrawing(true);
    this.clearEditHandles();
    this.editingMarkingId = null;

    this.drawConfig = { ...config };
    this.drawVertices = [];
    this.drawStartPoint = null;
    this.drawPreviewShape = null;
    this.drawCursorMarker = null;
    this.lastClickClient = null;

    if (config.shape === 'line' || config.shape === 'polygon') {
      this.map.doubleClickZoom.disable();
    }

    if (config.shape === 'text') {
      this.drawCursorMarker = L.marker(this.map.getCenter(), {
        interactive: false,
        icon: this.createTextDivIcon(
          {
            color: config.color,
            text: config.text || 'Click map to place',
            fontSize: config.fontSize ?? 12,
            boxBg: config.boxBg ?? true,
          },
          true
        ),
      });
    } else if (config.shape === 'icon') {
      this.drawCursorMarker = L.marker(this.map.getCenter(), {
        interactive: false,
        icon: this.createSvgDivIcon(config.iconId || 'armored', {
          color: config.color,
          label: config.label || '',
        }),
      });
    }

    this.map.on('mousemove', this.boundOnMouseMove);
    this.map.on('click', this.boundOnMapClick);
    this.map.on('dblclick', this.boundOnMapDblClick);
    this.callbacks.onDrawStateChange(true, config.shape);
  }

  public updateDrawingOptions(partial: Partial<TacticalDrawConfig>): void {
    if (!this.drawConfig) return;
    this.drawConfig = { ...this.drawConfig, ...partial };

    if (this.drawPreviewShape && typeof (this.drawPreviewShape as L.Path).setStyle === 'function') {
      const isLine = this.drawConfig.shape === 'line';
      (this.drawPreviewShape as L.Path).setStyle({
        color: this.drawConfig.color,
        fillColor: this.drawConfig.fillColor || this.drawConfig.color,
        weight: this.drawConfig.weight,
        dashArray: this.drawConfig.dashArray || undefined,
        fillOpacity: isLine ? 0 : this.drawConfig.fillOpacity,
      });
    }

    if (this.drawCursorMarker && this.drawConfig.shape === 'text') {
      this.drawCursorMarker.setIcon(
        this.createTextDivIcon(
          {
            color: this.drawConfig.color,
            text: this.drawConfig.text || 'Click map to place',
            fontSize: this.drawConfig.fontSize ?? 12,
            boxBg: this.drawConfig.boxBg ?? true,
          },
          true
        )
      );
    } else if (this.drawCursorMarker && this.drawConfig.shape === 'icon') {
      this.drawCursorMarker.setIcon(
        this.createSvgDivIcon(this.drawConfig.iconId || 'armored', {
          color: this.drawConfig.color,
          label: this.drawConfig.label || '',
        })
      );
    }
  }

  public finishDrawing(): void {
    if (!this.drawConfig) return;
    const cfg = this.drawConfig;
    const pts = [...this.drawVertices];

    if (cfg.shape === 'line') {
      if (pts.length < 2) return;
      this.cancelDrawing(true);
      this.callbacks.onCompleteDraw({
        marking_type: 'drawing',
        geometry: {
          type: 'LineString',
          coordinates: pts.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]),
        },
        properties: {
          shape: 'line',
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray,
          fillOpacity: cfg.fillOpacity,
          label: cfg.label || '',
          notes: '',
        },
      });
      return;
    }

    if (cfg.shape === 'polygon') {
      if (pts.length < 3) return;
      this.cancelDrawing(true);
      const ring = pts.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
      ring.push([...ring[0]]);
      this.callbacks.onCompleteDraw({
        marking_type: 'drawing',
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
        properties: {
          shape: 'polygon',
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray,
          fillOpacity: cfg.fillOpacity,
          label: cfg.label || '',
          notes: '',
        },
      });
    }
  }

  public cancelDrawing(silent = false): void {
    const hadDraw = this.drawConfig !== null;
    this.map.off('mousemove', this.boundOnMouseMove);
    this.map.off('click', this.boundOnMapClick);
    this.map.off('dblclick', this.boundOnMapDblClick);
    if (!this.map.doubleClickZoom.enabled()) {
      this.map.doubleClickZoom.enable();
    }

    this.drawConfig = null;
    this.drawVertices = [];
    this.drawStartPoint = null;
    this.drawPreviewShape = null;
    this.drawCursorMarker = null;
    if (this.drawTip) {
      this.map.removeLayer(this.drawTip);
      this.drawTip = null;
    }
    this.draftGroup.clearLayers();
    this.rebuildEditHandles();

    if (hadDraw && !silent) {
      this.callbacks.onDrawStateChange(false, null);
    } else if (silent && hadDraw) {
      this.callbacks.onDrawStateChange(false, null);
    }
  }

  public clear(): void {
    this.cancelDrawing(true);
    this.layerById.clear();
    this.metaById.clear();
    this.markingsGroup.clearLayers();
    this.draftGroup.clearLayers();
  }

  private renderMarkings(): void {
    this.layerById.clear();
    this.metaById.clear();
    this.markingsGroup.clearLayers();

    this.markings.forEach((m) => {
      if (!m || !m.geometry || !m.properties) return;
      if (!this.isMarkingVisible(m)) return;

      const props = m.properties || {};
      const shape = String(props.shape || '').toLowerCase();
      const geomType = String(m.geometry.type || '');
      const isPoint = geomType === 'Point';
      const color = String(props.color || '#3388ff');
      const fillColor = String(props.fillColor || color);
      const weight = props.weight !== undefined ? Number(props.weight) : 3;
      const dashArray = props.dashArray ? String(props.dashArray) : undefined;
      const fillOpacity =
        props.fillOpacity !== undefined ? Number(props.fillOpacity) : 0.2;
      const canEdit = Boolean(m.can_edit);

      let layer: L.Layer | null = null;

      if (shape === 'text' && isPoint && Array.isArray(m.geometry.coordinates)) {
        const coords = m.geometry.coordinates;
        const lat = Number(coords[1]);
        const lng = Number(coords[0]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const marker = L.marker([lat, lng], {
          draggable: canEdit && (this.isModeActive || this.editingMarkingId === m.id),
          icon: this.createTextDivIcon({ ...props, color }),
        });

        if (canEdit) {
          marker.on('dragstart', () => {
            this.layerJustClickedAt = Date.now();
            this.callbacks.onSelectMarking(m);
          });
          marker.on('dragend', () => {
            this.layerJustClickedAt = Date.now();
            const pos = marker.getLatLng();
            this.callbacks.onCommitGeometry(m.id, {
              type: 'Point',
              coordinates: [Number(pos.lng.toFixed(6)), Number(pos.lat.toFixed(6))],
            });
          });
        }
        layer = marker;
      } else if (
        (shape === 'circle' || props.radius !== undefined || props.radius_m !== undefined) &&
        isPoint &&
        Array.isArray(m.geometry.coordinates)
      ) {
        const coords = m.geometry.coordinates;
        const lat = Number(coords[1]);
        const lng = Number(coords[0]);
        const radius = Number(props.radius ?? props.radius_m ?? 1000);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) return;

        layer = L.circle([lat, lng], {
          radius: Math.max(50, radius),
          color,
          fillColor,
          fillOpacity,
          weight,
          dashArray,
          pane: 'tacticalMarkingsPane',
        });
      } else if (isPoint && Array.isArray(m.geometry.coordinates)) {
        const coords = m.geometry.coordinates;
        const lat = Number(coords[1]);
        const lng = Number(coords[0]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const iconId = String(props.icon || props.icon_id || 'armored');
        const iconDef = this.iconsById[iconId];
        const marker = L.marker([lat, lng], {
          draggable: canEdit && (this.isModeActive || this.editingMarkingId === m.id),
          icon: this.createSvgDivIcon(iconId, {
            color: String(props.color || iconDef?.defaultColor || '#f59e0b'),
            label: String(props.label || ''),
            svgOverride: props.icon_svg,
          }),
        });

        if (canEdit) {
          marker.on('dragstart', () => {
            this.layerJustClickedAt = Date.now();
            this.callbacks.onSelectMarking(m);
          });
          marker.on('dragend', () => {
            this.layerJustClickedAt = Date.now();
            const pos = marker.getLatLng();
            this.callbacks.onCommitGeometry(m.id, {
              type: 'Point',
              coordinates: [Number(pos.lng.toFixed(6)), Number(pos.lat.toFixed(6))],
            });
          });
        }
        layer = marker;
      } else if (geomType === 'LineString' && Array.isArray(m.geometry.coordinates)) {
        const latLngs = (m.geometry.coordinates as number[][])
          .map((c) => [Number(c[1]), Number(c[0])] as [number, number])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        if (latLngs.length < 2) return;

        layer = L.polyline(latLngs, {
          color,
          weight,
          dashArray,
          fillOpacity: 0,
          pane: 'tacticalMarkingsPane',
        });
      } else if (geomType === 'Polygon' && Array.isArray(m.geometry.coordinates?.[0])) {
        const rawRing = m.geometry.coordinates[0] as number[][];
        const latLngs = rawRing
          .map((c) => [Number(c[1]), Number(c[0])] as [number, number])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        if (latLngs.length > 3) {
          const f = latLngs[0];
          const l = latLngs[latLngs.length - 1];
          if (Math.abs(f[0] - l[0]) < 1e-6 && Math.abs(f[1] - l[1]) < 1e-6) {
            latLngs.pop();
          }
        }
        if (latLngs.length < 3) return;

        layer = L.polygon(latLngs, {
          color,
          fillColor,
          fillOpacity,
          weight,
          dashArray,
          pane: 'tacticalMarkingsPane',
        });
      }

      if (!layer) return;

      this.bindShapeTooltip(layer, m, props, shape);

      layer.on('click', (e: L.LeafletMouseEvent) => {
        if (this.isDrawing()) return;
        this.layerJustClickedAt = Date.now();
        if (e?.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        L.DomEvent.stopPropagation(e);

        if (canEdit) {
          this.callbacks.onSelectMarking(m);
        } else {
          L.popup({ maxWidth: 280 })
            .setLatLng(e.latlng)
            .setContent(
              `<div class="p-1 text-xs text-stone-200 space-y-1 font-sans">
                <div class="font-bold text-amber-400">${escapeHtml(
                  props.label || props.text || `${shape || 'Marking'} #${m.id}`
                )}</div>
                <div class="text-[10px] text-stone-400">By: ${escapeHtml(
                  m.creator_name || 'Member'
                )} &bull; ${escapeHtml(String(m.visibility).toUpperCase())}</div>
                ${
                  props.notes
                    ? `<p class="text-[11px] text-stone-300 pt-1 border-t border-stone-800 whitespace-pre-wrap">${escapeHtml(
                        props.notes
                      )}</p>`
                    : ''
                }
              </div>`
            )
            .openOn(this.map);
        }
      });

      this.layerById.set(m.id, layer);
      this.metaById.set(m.id, {
        ...m,
        properties: { ...props },
      });
      layer.addTo(this.markingsGroup);
    });
  }

  private isMarkingVisible(m: CampaignMapTacticalMarking): boolean {
    if (this.editingMarkingId && Number(m.id) === Number(this.editingMarkingId)) {
      return true;
    }
    const vis = String(m.visibility || 'personal').toLowerCase();
    if (vis === 'personal' || vis === 'campaign') return true;
    if (vis === 'mission') {
      if (this.selectedMissionId && m.mission_id && Number(m.mission_id) !== Number(this.selectedMissionId)) {
        return false;
      }
      return true;
    }
    if (vis === 'sortie') {
      if (this.selectedSortieId && m.sortie_id && Number(m.sortie_id) !== Number(this.selectedSortieId)) {
        return false;
      }
      if (
        !this.selectedSortieId &&
        this.selectedMissionId &&
        m.mission_id &&
        Number(m.mission_id) !== Number(this.selectedMissionId)
      ) {
        return false;
      }
      return true;
    }
    return true;
  }

  private bindShapeTooltip(
    layer: L.Layer,
    m: CampaignMapTacticalMarking,
    props: Record<string, any>,
    shape: string
  ): void {
    if (props.label && shape !== 'text' && shape !== 'icon') {
      (layer as L.Path).bindTooltip(
        `<span class="tactical-label-text font-bold uppercase tracking-wider">${escapeHtml(
          props.label
        )}</span>`,
        {
          direction: 'center',
          permanent: true,
          className: 'tactical-shape-label',
        }
      );
    } else if (shape === 'icon' && props.notes) {
      (layer as L.Marker).bindTooltip(
        `<div class="text-[11px]">
          <div class="font-bold text-amber-400">${escapeHtml(props.label || 'Tactical Marker')}</div>
          <div class="text-[10px] text-stone-300 mt-0.5 whitespace-pre-wrap">${escapeHtml(
            props.notes
          )}</div>
          ${
            m.creator_name
              ? `<div class="text-[9px] text-stone-400 mt-1">By: ${escapeHtml(
                  m.creator_name
                )} (${escapeHtml(m.visibility)})</div>`
              : ''
          }
        </div>`,
        { direction: 'top', offset: [0, -18], opacity: 0.95 }
      );
    } else if (!props.label && shape !== 'text' && shape !== 'icon') {
      const tooltipText = `${props.shape || 'Marking'} #${m.id}`;
      (layer as L.Path).bindTooltip(
        `<div class="text-[11px] font-bold">
          <span class="text-amber-400">${escapeHtml(tooltipText)}</span>
          ${
            m.creator_name
              ? `<div class="text-[9px] text-stone-400 font-normal">By: ${escapeHtml(
                  m.creator_name
                )} (${escapeHtml(m.visibility)})</div>`
              : ''
          }
        </div>`,
        { direction: 'top', offset: [0, -10], opacity: 0.95 }
      );
    }
  }

  private createTextDivIcon(props: Record<string, any>, pulse = false): L.DivIcon {
    const color = String(props.color || '#ffffff');
    const text = String(props.text || props.label || 'Note');
    const fontSize = Number(props.fontSize || 12);
    const boxBg = props.boxBg !== false;

    const html = boxBg
      ? `<div class="tactical-text-box ${
          pulse ? 'animate-pulse' : ''
        }" style="color: ${escapeHtml(color)}; font-size: ${fontSize}px;">${escapeHtml(text)}</div>`
      : `<div class="font-bold whitespace-nowrap ${
          pulse ? 'animate-pulse' : ''
        }" style="color: ${escapeHtml(
          color
        )}; font-size: ${fontSize}px; text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95);">${escapeHtml(
          text
        )}</div>`;

    return L.divIcon({
      className: 'tactical-text-marker-wrapper',
      iconSize: undefined,
      html,
      iconAnchor: [0, 0],
    });
  }

  private createSvgDivIcon(
    iconId: string,
    opts: { color?: string; label?: string; svgOverride?: string }
  ): L.DivIcon {
    const def = this.iconsById[iconId];
    const color = opts.color || def?.defaultColor || '#f59e0b';
    const label = opts.label || '';
    const size = 28;
    const svgHtml =
      opts.svgOverride ||
      def?.svg ||
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;

    const html = `
      <div class="tactical-svg-marker-container relative flex flex-col items-center justify-start pointer-events-auto select-none" style="width:${size}px;height:${size}px;">
        <div class="tactical-svg-icon-wrapper flex items-center justify-center transition-transform hover:scale-110"
             style="width:${size}px;height:${size}px;color:${escapeHtml(
               color
             )};filter:drop-shadow(0 2px 4px rgba(0,0,0,0.85));">
          <div class="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none">
            ${svgHtml}
          </div>
        </div>
        ${
          label
            ? `<div class="tactical-svg-label absolute top-full mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap shadow-md pointer-events-none"
                    style="background-color:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.25);text-shadow:0 1px 2px #000;">
                 ${escapeHtml(label)}
               </div>`
            : ''
        }
      </div>
    `;

    return L.divIcon({
      className: 'tactical-custom-svg-marker',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  /* ============================================================================
   * Pure-Leaflet Drawing Handlers
   * ========================================================================== */
  private handleDrawMouseMove(e: L.LeafletMouseEvent): void {
    const cfg = this.drawConfig;
    if (!cfg) return;

    if (cfg.shape === 'text' || cfg.shape === 'icon') {
      if (this.drawCursorMarker) {
        this.drawCursorMarker.setLatLng(e.latlng);
        if (!this.draftGroup.hasLayer(this.drawCursorMarker)) {
          this.drawCursorMarker.addTo(this.draftGroup);
        }
      }
      return;
    }

    if (cfg.shape === 'line' && this.drawVertices.length > 0) {
      const pts = [...this.drawVertices, e.latlng];
      if (!this.drawPreviewShape) {
        this.drawPreviewShape = L.polyline(pts, {
          color: cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray || undefined,
          interactive: false,
        }).addTo(this.draftGroup);
      } else {
        (this.drawPreviewShape as L.Polyline).setLatLngs(pts);
      }
      return;
    }

    if (cfg.shape === 'polygon' && this.drawVertices.length > 0) {
      const pts = [...this.drawVertices, e.latlng];
      if (pts.length >= 3) {
        if (this.drawPreviewShape instanceof L.Polygon) {
          this.drawPreviewShape.setLatLngs(pts);
        } else {
          if (this.drawPreviewShape) this.draftGroup.removeLayer(this.drawPreviewShape);
          this.drawPreviewShape = L.polygon(pts, {
            color: cfg.color,
            fillColor: cfg.fillColor || cfg.color,
            weight: cfg.weight,
            dashArray: cfg.dashArray || undefined,
            fillOpacity: cfg.fillOpacity,
            interactive: false,
          }).addTo(this.draftGroup);
        }
      } else if (!this.drawPreviewShape) {
        this.drawPreviewShape = L.polyline(pts, {
          color: cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray || undefined,
          interactive: false,
        }).addTo(this.draftGroup);
      } else if (this.drawPreviewShape instanceof L.Polyline) {
        this.drawPreviewShape.setLatLngs(pts);
      }
      return;
    }

    if (cfg.shape === 'rectangle' && this.drawStartPoint) {
      const bounds = L.latLngBounds(this.drawStartPoint, e.latlng);
      if (!this.drawPreviewShape) {
        this.drawPreviewShape = L.rectangle(bounds, {
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray || undefined,
          fillOpacity: cfg.fillOpacity,
          interactive: false,
        }).addTo(this.draftGroup);
      } else {
        (this.drawPreviewShape as L.Rectangle).setBounds(bounds);
      }
      return;
    }

    if (cfg.shape === 'circle' && this.drawStartPoint) {
      const radiusMeters = Math.max(50, this.map.distance(this.drawStartPoint, e.latlng));
      if (!this.drawPreviewShape) {
        this.drawPreviewShape = L.circle(this.drawStartPoint, {
          radius: radiusMeters,
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray || undefined,
          fillOpacity: cfg.fillOpacity,
          interactive: false,
        }).addTo(this.draftGroup);
      } else {
        (this.drawPreviewShape as L.Circle).setRadius(radiusMeters);
      }

      const radiusText =
        cfg.unit === 'km'
          ? `${(radiusMeters / 1000).toFixed(1)} KM`
          : `${(radiusMeters / 1852).toFixed(1)} NM`;
      if (!this.drawTip) {
        this.drawTip = L.tooltip({ permanent: true, direction: 'right', offset: [10, 0], className: 'gtfo-map-tooltip' })
          .setLatLng(e.latlng)
          .setContent(`R: ${radiusText}`)
          .addTo(this.map);
      } else {
        this.drawTip.setLatLng(e.latlng).setContent(`R: ${radiusText}`);
      }
    }
  }

  private handleDrawClick(e: L.LeafletMouseEvent): void {
    const cfg = this.drawConfig;
    if (!cfg) return;
    if (e?.originalEvent) {
      L.DomEvent.stopPropagation(e.originalEvent);
    }

    if (cfg.shape === 'text') {
      const textVal = cfg.text || 'Tactical Note';
      this.cancelDrawing(true);
      this.callbacks.onCompleteDraw({
        marking_type: 'drawing',
        geometry: {
          type: 'Point',
          coordinates: [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))],
        },
        properties: {
          shape: 'text',
          text: textVal,
          label: textVal,
          color: cfg.color,
          fontSize: cfg.fontSize ?? 12,
          boxBg: cfg.boxBg ?? true,
          notes: '',
        },
      });
      return;
    }

    if (cfg.shape === 'icon') {
      this.cancelDrawing(true);
      this.callbacks.onCompleteDraw({
        marking_type: 'icon',
        geometry: {
          type: 'Point',
          coordinates: [Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))],
        },
        properties: {
          shape: 'icon',
          icon: cfg.iconId || 'armored',
          color: cfg.color,
          label: cfg.label || '',
          notes: '',
        },
      });
      return;
    }

    if (cfg.shape === 'rectangle') {
      if (!this.drawStartPoint) {
        this.drawStartPoint = e.latlng;
        L.circleMarker(e.latlng, {
          radius: 4.5,
          color: '#fbbf24',
          fillColor: '#0f172a',
          fillOpacity: 1,
          weight: 2,
          interactive: false,
        }).addTo(this.draftGroup);
        return;
      }

      const b = L.latLngBounds(this.drawStartPoint, e.latlng);
      const sw = b.getSouthWest();
      const nw = b.getNorthWest();
      const ne = b.getNorthEast();
      const se = b.getSouthEast();
      if (Math.abs(ne.lat - sw.lat) < 1e-6 || Math.abs(ne.lng - sw.lng) < 1e-6) {
        return;
      }
      const ring = [
        [Number(sw.lng.toFixed(6)), Number(sw.lat.toFixed(6))],
        [Number(nw.lng.toFixed(6)), Number(nw.lat.toFixed(6))],
        [Number(ne.lng.toFixed(6)), Number(ne.lat.toFixed(6))],
        [Number(se.lng.toFixed(6)), Number(se.lat.toFixed(6))],
        [Number(sw.lng.toFixed(6)), Number(sw.lat.toFixed(6))],
      ];
      this.cancelDrawing(true);
      this.callbacks.onCompleteDraw({
        marking_type: 'drawing',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          shape: 'rectangle',
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray,
          fillOpacity: cfg.fillOpacity,
          label: cfg.label || '',
          notes: '',
        },
      });
      return;
    }

    if (cfg.shape === 'circle') {
      if (!this.drawStartPoint) {
        this.drawStartPoint = e.latlng;
        L.circleMarker(e.latlng, {
          radius: 4.5,
          color: '#fbbf24',
          fillColor: '#0f172a',
          fillOpacity: 1,
          weight: 2,
          interactive: false,
        }).addTo(this.draftGroup);
        return;
      }
      const radiusMeters = Math.round(Math.max(100, this.map.distance(this.drawStartPoint, e.latlng)));
      const center = this.drawStartPoint;
      this.cancelDrawing(true);
      this.callbacks.onCompleteDraw({
        marking_type: 'drawing',
        geometry: {
          type: 'Point',
          coordinates: [Number(center.lng.toFixed(6)), Number(center.lat.toFixed(6))],
        },
        properties: {
          shape: 'circle',
          radius: radiusMeters,
          color: cfg.color,
          fillColor: cfg.fillColor || cfg.color,
          weight: cfg.weight,
          dashArray: cfg.dashArray,
          fillOpacity: cfg.fillOpacity,
          label: cfg.label || '',
          notes: '',
        },
      });
      return;
    }

    // Line or Polygon: deduplicate rapid double-click first point
    const now = Date.now();
    const ptPx = this.map.latLngToLayerPoint(e.latlng);
    if (
      this.lastClickClient &&
      now - this.lastClickClient.time < 320 &&
      Math.hypot(ptPx.x - this.lastClickClient.x, ptPx.y - this.lastClickClient.y) < 6
    ) {
      return;
    }
    this.lastClickClient = { x: ptPx.x, y: ptPx.y, time: now };

    if (cfg.shape === 'polygon' && this.drawVertices.length >= 3) {
      const firstPx = this.map.latLngToLayerPoint(this.drawVertices[0]);
      if (ptPx.distanceTo(firstPx) <= 14) {
        this.finishDrawing();
        return;
      }
    }

    if (cfg.shape === 'line' && this.drawVertices.length >= 2) {
      const lastPx = this.map.latLngToLayerPoint(this.drawVertices[this.drawVertices.length - 1]);
      if (ptPx.distanceTo(lastPx) <= 10) {
        this.finishDrawing();
        return;
      }
    }

    this.drawVertices.push(e.latlng);
    L.circleMarker(e.latlng, {
      radius: 4.5,
      color: '#fbbf24',
      fillColor: this.drawVertices.length === 1 && cfg.shape === 'polygon' ? '#f59e0b' : '#0f172a',
      fillOpacity: 1,
      weight: 2,
      interactive: false,
    }).addTo(this.draftGroup);
  }

  private handleDrawDblClick(e: L.LeafletMouseEvent): void {
    if (!this.drawConfig) return;
    if (this.drawConfig.shape === 'line' || this.drawConfig.shape === 'polygon') {
      if (e?.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      this.finishDrawing();
    }
  }

  /* ============================================================================
   * Pure-Leaflet Vertex / Corner / Circle Resize Edit Handles
   * ========================================================================== */
  private clearEditHandles(): void {
    if (!this.isDrawing()) {
      this.draftGroup.clearLayers();
    }
  }

  private rebuildEditHandles(): void {
    this.clearEditHandles();
    if (!this.editingMarkingId) return;

    const layer = this.layerById.get(this.editingMarkingId);
    const meta = this.metaById.get(this.editingMarkingId);
    if (!layer || !meta || !meta.can_edit) return;

    const shape = String(meta.properties?.shape || '').toLowerCase();

    if (layer instanceof L.Marker) {
      if (layer.dragging) layer.dragging.enable();
      return;
    }

    if (layer instanceof L.Circle) {
      this.buildCircleEditHandles(layer, meta.id);
      return;
    }

    if (layer instanceof L.Polygon && shape === 'rectangle') {
      this.buildRectangleEditHandles(layer, meta.id);
      return;
    }

    if (layer instanceof L.Polygon) {
      this.buildPolyEditHandles(layer, meta.id, true);
      return;
    }

    if (layer instanceof L.Polyline) {
      this.buildPolyEditHandles(layer, meta.id, false);
    }
  }

  private buildCircleEditHandles(circle: L.Circle, markingId: number): void {
    const getCenter = () => circle.getLatLng();
    const getRadiusEdge = (c: L.LatLng, radiusMeters: number) => {
      const dest = computeDestinationPoint(c.lat, c.lng, 90, radiusMeters / 1852);
      return L.latLng(dest.lat, dest.lng);
    };

    const handleIcon = L.divIcon({ className: 'leaflet-editing-icon', iconSize: [12, 12] });
    const centerMarker = L.marker(getCenter(), { icon: handleIcon, draggable: true, zIndexOffset: 1400 });
    const edgeMarker = L.marker(getRadiusEdge(getCenter(), circle.getRadius()), {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 1400,
    });

    centerMarker.on('drag', () => {
      const c = centerMarker.getLatLng();
      circle.setLatLng(c);
      edgeMarker.setLatLng(getRadiusEdge(c, circle.getRadius()));
    });

    centerMarker.on('dragend', () => {
      const c = centerMarker.getLatLng();
      this.callbacks.onCommitGeometry(
        markingId,
        { type: 'Point', coordinates: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))] },
        { radius: Math.round(circle.getRadius()) }
      );
    });

    edgeMarker.on('drag', () => {
      const c = circle.getLatLng();
      const newRadius = Math.max(50, this.map.distance(c, edgeMarker.getLatLng()));
      circle.setRadius(newRadius);
    });

    edgeMarker.on('dragend', () => {
      const c = circle.getLatLng();
      const finalRadius = Math.round(Math.max(50, circle.getRadius()));
      this.callbacks.onCommitGeometry(
        markingId,
        { type: 'Point', coordinates: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))] },
        { radius: finalRadius }
      );
    });

    centerMarker.addTo(this.draftGroup);
    edgeMarker.addTo(this.draftGroup);
  }

  private buildRectangleEditHandles(poly: L.Polygon, markingId: number): void {
    const rawRing = (poly.getLatLngs()[0] as L.LatLng[]) || [];
    if (rawRing.length < 4) {
      this.buildPolyEditHandles(poly, markingId, true);
      return;
    }

    const bounds = poly.getBounds();
    const sw = bounds.getSouthWest();
    const nw = bounds.getNorthWest();
    const ne = bounds.getNorthEast();
    const se = bounds.getSouthEast();

    const cornerCoords = [sw, nw, ne, se];
    const cornerIcon = L.divIcon({ className: 'leaflet-editing-icon', iconSize: [12, 12] });
    const centerIcon = L.divIcon({ className: 'leaflet-editing-midpoint', iconSize: [10, 10] });

    const cornerMarkers = cornerCoords.map((pt) =>
      L.marker(pt, { icon: cornerIcon, draggable: true, zIndexOffset: 1400 })
    );
    const centerMarker = L.marker(bounds.getCenter(), {
      icon: centerIcon,
      draggable: true,
      zIndexOffset: 1390,
    });

    const syncCornersFromBounds = (b: L.LatLngBounds, skipIdx?: number) => {
      const pts = [b.getSouthWest(), b.getNorthWest(), b.getNorthEast(), b.getSouthEast()];
      poly.setLatLngs([pts]);
      pts.forEach((p, idx) => {
        if (idx !== skipIdx) cornerMarkers[idx].setLatLng(p);
      });
      if (skipIdx !== -1) {
        centerMarker.setLatLng(b.getCenter());
      }
    };

    const commitPoly = () => {
      const pts = (poly.getLatLngs()[0] as L.LatLng[]) || [];
      const ring = pts.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
      if (ring.length > 0) ring.push([...ring[0]]);
      this.callbacks.onCommitGeometry(markingId, { type: 'Polygon', coordinates: [ring] });
    };

    cornerMarkers.forEach((cm, idx) => {
      const oppIdx = (idx + 2) % 4;
      cm.on('drag', () => {
        const opp = cornerMarkers[oppIdx].getLatLng();
        const nextBounds = L.latLngBounds(cm.getLatLng(), opp);
        syncCornersFromBounds(nextBounds, idx);
      });
      cm.on('dragend', commitPoly);
      cm.addTo(this.draftGroup);
    });

    let lastCenter = centerMarker.getLatLng();
    centerMarker.on('dragstart', () => {
      lastCenter = centerMarker.getLatLng();
    });
    centerMarker.on('drag', () => {
      const now = centerMarker.getLatLng();
      const dLat = now.lat - lastCenter.lat;
      const dLng = now.lng - lastCenter.lng;
      lastCenter = now;
      const movedPts = cornerMarkers.map((cm) => {
        const p = cm.getLatLng();
        return L.latLng(p.lat + dLat, p.lng + dLng);
      });
      movedPts.forEach((p, idx) => cornerMarkers[idx].setLatLng(p));
      poly.setLatLngs([movedPts]);
    });
    centerMarker.on('dragend', commitPoly);
    centerMarker.addTo(this.draftGroup);
  }

  private buildPolyEditHandles(poly: L.Polyline | L.Polygon, markingId: number, isPolygon: boolean): void {
    const getPoints = (): L.LatLng[] => {
      if (isPolygon) {
        return [...((poly as L.Polygon).getLatLngs()[0] as L.LatLng[])];
      }
      return [...(poly.getLatLngs() as L.LatLng[])];
    };

    const setPoints = (pts: L.LatLng[]) => {
      if (isPolygon) {
        (poly as L.Polygon).setLatLngs([pts]);
      } else {
        poly.setLatLngs(pts);
      }
    };

    const commitPts = (pts: L.LatLng[]) => {
      if (isPolygon) {
        const ring = pts.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]);
        if (ring.length > 0) ring.push([...ring[0]]);
        this.callbacks.onCommitGeometry(markingId, { type: 'Polygon', coordinates: [ring] });
      } else {
        this.callbacks.onCommitGeometry(markingId, {
          type: 'LineString',
          coordinates: pts.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]),
        });
      }
    };

    const pts = getPoints();
    const vertexIcon = L.divIcon({ className: 'leaflet-editing-icon', iconSize: [12, 12] });
    const midIcon = L.divIcon({ className: 'leaflet-editing-midpoint', iconSize: [9, 9] });

    const vertexMarkers: L.Marker[] = [];
    const midMarkers: L.Marker[] = [];

    const updateMidpoints = (currentPts: L.LatLng[]) => {
      midMarkers.forEach((mm, idx) => {
        const a = currentPts[idx];
        const b = currentPts[(idx + 1) % currentPts.length];
        if (a && b) {
          mm.setLatLng([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2]);
        }
      });
    };

    pts.forEach((pt, idx) => {
      const vm = L.marker(pt, { icon: vertexIcon, draggable: true, zIndexOffset: 1400 });
      vm.on('drag', () => {
        const cur = getPoints();
        cur[idx] = vm.getLatLng();
        setPoints(cur);
        updateMidpoints(cur);
      });
      vm.on('dragend', () => {
        commitPts(getPoints());
      });
      vm.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (e.originalEvent?.altKey) {
          const cur = getPoints();
          const minPts = isPolygon ? 3 : 2;
          if (cur.length > minPts) {
            cur.splice(idx, 1);
            setPoints(cur);
            commitPts(cur);
            this.buildPolyEditHandles(poly, markingId, isPolygon);
          }
        }
      });
      vertexMarkers.push(vm);
      vm.addTo(this.draftGroup);
    });

    const segCount = isPolygon ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue;
      const mm = L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
        icon: midIcon,
        zIndexOffset: 1350,
      });
      mm.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        const cur = getPoints();
        const insertPt = mm.getLatLng();
        cur.splice(i + 1, 0, insertPt);
        setPoints(cur);
        commitPts(cur);
        this.buildPolyEditHandles(poly, markingId, isPolygon);
      });
      midMarkers.push(mm);
      mm.addTo(this.draftGroup);
    }
  }
}
