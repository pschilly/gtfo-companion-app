import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowsOutCardinal,
  Check,
  CheckCircle,
  Circle,
  Crosshair,
  Eye,
  FloppyDisk,
  Info,
  LineSegment,
  ListBullets,
  Lock,
  Palette,
  PencilSimpleLine,
  Polygon,
  Shapes,
  ShieldCheck,
  Square,
  Target,
  TextT,
  Trash,
} from '@phosphor-icons/react';
import {
  assignCampaignTacticalMarkingAsAor,
  deleteCampaignTacticalMarking,
  saveCampaignTacticalMarking,
} from '../../../services/campaignMapService';
import {
  CampaignMapMission,
  CampaignMapPayload,
  CampaignMapTacticalMarking,
} from '../../../types';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  normalizeTacticalIcons,
  TacticalDrawConfig,
  TacticalShapeType,
} from './activeTacticalMarkingsLayer';

interface TacticalMarkingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  mapData: CampaignMapPayload;
  unit: 'nm' | 'km';
  selectedMissionId: number | null;
  selectedSortieId: number | null;
  isDrawingActive: boolean;
  activeDrawingType: TacticalShapeType | null;
  editingMarking: CampaignMapTacticalMarking | null;
  onSelectEditingMarking: (m: CampaignMapTacticalMarking | null) => void;
  onStartDraw: (config: TacticalDrawConfig) => void;
  onUpdateDrawOptions: (partial: Partial<TacticalDrawConfig>) => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onUpdateEditingStyle: (
    markingId: number,
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
  ) => void;
  onFlyToMarking: (markingId: number) => void;
  onMarkingsChange: (nextMarkings: CampaignMapTacticalMarking[]) => void;
  onScopeChange?: (scope: {
    visibility: 'personal' | 'campaign' | 'mission' | 'sortie';
    missionId: number | null;
    sortieId: number | null;
  }) => void;
  onAorAssigned: (res: {
    missions: CampaignMapMission[];
    tacticalMarkings: CampaignMapTacticalMarking[];
    aorPresets: NonNullable<CampaignMapPayload['aorPresets']>;
  }) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

type DrawerTab = 'shapes' | 'icons' | 'list' | 'edit';
type LineStyleKey = 'solid' | 'dashed' | 'dotted' | 'dashdot';
type VisibilityScope = 'personal' | 'campaign' | 'mission' | 'sortie';

const PRESET_COLORS = [
  '#3388ff',
  '#ef4444',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ffffff',
  '#000000',
];

function getDashArrayFromStyle(style: LineStyleKey): string | null {
  switch (style) {
    case 'dashed':
      return '12, 12';
    case 'dotted':
      return '3, 8';
    case 'dashdot':
      return '16, 6, 3, 6';
    default:
      return null;
  }
}

function inferLineStyleFromDashArray(dashArray?: string | null): LineStyleKey {
  if (!dashArray) return 'solid';
  if (dashArray.includes('3, 8') || dashArray.includes('3,8')) return 'dotted';
  if (dashArray.includes('16') || dashArray.includes('dashdot')) return 'dashdot';
  return 'dashed';
}

interface EditDraftState {
  id: number;
  label: string;
  notes: string;
  color: string;
  fillColor: string;
  syncFillColor: boolean;
  lineStyle: LineStyleKey;
  weight: number;
  fillOpacity: number;
  icon: string | null;
  visibility: VisibilityScope;
  mission_id: number | null;
  sortie_id: number | null;
  shape: string;
  raw: CampaignMapTacticalMarking;
}

/**
 * Exact 1-for-1 Member Portal Tactical Markings floating drawer
 * (`tactical-markings-drawer.blade.php`).
 */
export const TacticalMarkingsDrawer: React.FC<TacticalMarkingsDrawerProps> = ({
  isOpen,
  onClose,
  zIndex,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  unit,
  selectedMissionId,
  selectedSortieId,
  isDrawingActive,
  activeDrawingType,
  editingMarking,
  onSelectEditingMarking,
  onStartDraw,
  onUpdateDrawOptions,
  onFinishDraw,
  onCancelDraw,
  onUpdateEditingStyle,
  onFlyToMarking,
  onMarkingsChange,
  onScopeChange,
  onAorAssigned,
  onNotify,
}) => {
  const permissions = mapData.permissions;
  const missions = mapData.missions || [];
  const markingsList = mapData.tacticalMarkings || [];
  const iconCatalog = useMemo(() => normalizeTacticalIcons(mapData.tacticalIcons), [mapData.tacticalIcons]);

  const [activeTab, setActiveTab] = useState<DrawerTab>('shapes');
  const [activeShape, setActiveShape] = useState<Exclude<TacticalShapeType, 'icon'>>('line');
  const [lineStyle, setLineStyle] = useState<LineStyleKey>('solid');
  const [activeWeight, setActiveWeight] = useState<number>(3);
  const [activeColor, setActiveColor] = useState<string>('#3388ff');
  const [fillOpacity, setFillOpacity] = useState<number>(0.2);

  const [shapeLabel, setShapeLabel] = useState('');
  const [textInput, setTextInput] = useState('Tactical Label');
  const [textFontSize, setTextFontSize] = useState<number>(12);
  const [textBoxBg, setTextBoxBg] = useState<boolean>(true);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    iconCatalog.categories[0] || 'Ground Units'
  );
  const [selectedIcon, setSelectedIcon] = useState<string>(iconCatalog.list[0]?.id || 'armored');
  const [iconLabel, setIconLabel] = useState('');

  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('personal');
  const [targetMissionId, setTargetMissionId] = useState<number | null>(
    selectedMissionId ?? missions[0]?.id ?? null
  );
  const [targetSortieId, setTargetSortieId] = useState<number | null>(selectedSortieId ?? null);

  const [editDraft, setEditDraft] = useState<EditDraftState | null>(null);
  const [aorTargetMissionId, setAorTargetMissionId] = useState<number | null>(
    selectedMissionId ?? missions[0]?.id ?? null
  );
  const [aorTargetSelection, setAorTargetSelection] = useState<string>('mission');
  const [isBusy, setIsBusy] = useState(false);

  // Ensure selectedCategory stays valid when icons catalog updates
  useEffect(() => {
    if (iconCatalog.categories.length > 0 && !iconCatalog.categories.includes(selectedCategory)) {
      setSelectedCategory(iconCatalog.categories[0]);
    }
    if (iconCatalog.list.length > 0 && !iconCatalog.byId[selectedIcon]) {
      setSelectedIcon(iconCatalog.list[0].id);
    }
  }, [iconCatalog, selectedCategory, selectedIcon]);

  // Sync default mission/sortie target when map filter changes
  useEffect(() => {
    if (selectedMissionId) {
      setTargetMissionId(selectedMissionId);
      setAorTargetMissionId(selectedMissionId);
    } else if (!targetMissionId && missions.length > 0) {
      setTargetMissionId(missions[0].id);
      setAorTargetMissionId(missions[0].id);
    }
    if (selectedSortieId) {
      setTargetSortieId(selectedSortieId);
    }
  }, [selectedMissionId, selectedSortieId, missions, targetMissionId]);

  // Auto-select first sortie of targetMissionId when needed
  const availableSorties = useMemo(() => {
    if (!targetMissionId) return [];
    return missions.find((m) => Number(m.id) === Number(targetMissionId))?.sorties || [];
  }, [missions, targetMissionId]);

  useEffect(() => {
    if (availableSorties.length > 0) {
      if (!targetSortieId || !availableSorties.some((s) => Number(s.id) === Number(targetSortieId))) {
        setTargetSortieId(availableSorties[0].id);
      }
    } else {
      setTargetSortieId(null);
    }
  }, [availableSorties, targetSortieId]);

  // Sync incoming editingMarking from map click or list click -> populate Edit tab
  useEffect(() => {
    if (!editingMarking) {
      setEditDraft(null);
      return;
    }
    const props = editingMarking.properties || {};
    const shape = String(props.shape || 'marking').toLowerCase();
    const color = String(props.color || '#3388ff');
    const fillColor = String(props.fillColor || color);
    const syncFillColor = props.fillColor === undefined || props.fillColor === color;
    const vis = (editingMarking.visibility || 'personal') as VisibilityScope;
    const defaultMissionId =
      editingMarking.mission_id ||
      ((vis === 'mission' || vis === 'sortie') && missions.length > 0 ? missions[0].id : null);

    setEditDraft({
      id: editingMarking.id,
      label: String(props.label || props.text || ''),
      notes: String(props.notes || ''),
      color,
      fillColor,
      syncFillColor,
      lineStyle: inferLineStyleFromDashArray(props.dashArray),
      weight: props.weight !== undefined ? Number(props.weight) : 3,
      fillOpacity: props.fillOpacity !== undefined ? Number(props.fillOpacity) : 0.2,
      icon: shape === 'icon' ? String(props.icon || props.icon_id || 'armored') : null,
      visibility: vis,
      mission_id: defaultMissionId,
      sortie_id: editingMarking.sortie_id || null,
      shape,
      raw: editingMarking,
    });
    setAorTargetMissionId(
      editingMarking.mission_id || targetMissionId || selectedMissionId || missions[0]?.id || null
    );
    setAorTargetSelection('mission');
    setActiveTab('edit');
  }, [editingMarking, missions, selectedMissionId, targetMissionId]);

  // Helper: validate visibility scope against user permissions
  const resolveValidatedScope = (scope: VisibilityScope): VisibilityScope => {
    if (scope === 'campaign' && !permissions.canManageCampaignTacticalMarkings) return 'personal';
    if (scope === 'mission' && !permissions.canManageMissionTacticalMarkings) return 'personal';
    if (scope === 'sortie' && !permissions.canManageSortieTacticalMarkings) return 'personal';
    return scope;
  };

  // Export selected draw metadata onto global/local callback via parent CampaignMapTab
  const triggerDraw = (shape: Exclude<TacticalShapeType, 'icon'>) => {
    if (!permissions.canCreateTacticalMarkings) return;
    setActiveShape(shape);
    onStartDraw({
      shape,
      color: activeColor,
      fillColor: activeColor,
      weight: activeWeight,
      dashArray: getDashArrayFromStyle(lineStyle),
      fillOpacity,
      label: shapeLabel,
      text: textInput,
      fontSize: textFontSize,
      boxBg: textBoxBg,
      unit,
    });
  };

  const triggerIconPlacement = (iconId: string) => {
    if (!permissions.canCreateTacticalMarkings) return;
    setSelectedIcon(iconId);
    onStartDraw({
      shape: 'icon',
      iconId,
      color: activeColor,
      fillColor: activeColor,
      weight: activeWeight,
      dashArray: null,
      fillOpacity: 1,
      label: iconLabel,
      unit,
    });
  };

  // Save current scope params on parent ref cleanly through global/prop bridge
  // (We persist scope/mission/sortie via custom window state or prop callback? Let's expose via dataset / window-free callback? Actually CampaignMapTab owns handleCompleteDraw!)
  // Wait: parent needs visibilityScope, targetMissionId, targetSortieId when onCompleteDraw fires! Let's keep them synced via a callback prop OR pass window? No — better: attach directly to `TacticalMarkingsDrawer` via `onScopeConfigChange` prop OR let parent store scope! Let's check: writing a clean `scopeConfig` or reading from `window.__gtfoTmScope` avoids extra prop churn while still allowing CampaignMapTab's `onCompleteDraw` to always know the latest scope at draw-finish time! Let's declare a clean prop on `TacticalMarkingsDrawerProps`? No, even cleaner: let's add optional `onScopeChange?: (scope: { visibility: VisibilityScope; missionId: number | null; sortieId: number | null }) => void` OR keep it on `useEffect` in `TacticalMarkingsDrawer`! Wait: I am editing `CampaignMapTab.tsx` in Phase 4 anyway, so adding `onScopeChange` prop is completely type-safe and clean! Let's include `onScopeChange` below and wire it in `CampaignMapTab.tsx`.

  const handleSelectColorSwatch = (color: string) => {
    setActiveColor(color);
    if (isDrawingActive) {
      onUpdateDrawOptions({ color, fillColor: color });
    }
  };

  const handleSelectLineStyle = (nextStyle: LineStyleKey) => {
    setLineStyle(nextStyle);
    if (isDrawingActive) {
      onUpdateDrawOptions({ dashArray: getDashArrayFromStyle(nextStyle) });
    }
  };

  const categoryIcons = useMemo(
    () => iconCatalog.list.filter((i) => i.category === selectedCategory),
    [iconCatalog.list, selectedCategory]
  );

  const editSorties = useMemo(() => {
    if (!editDraft?.mission_id) return [];
    return missions.find((m) => Number(m.id) === Number(editDraft.mission_id))?.sorties || [];
  }, [editDraft?.mission_id, missions]);

  const aorObjectives = useMemo(() => {
    const mId = aorTargetMissionId || editDraft?.mission_id || targetMissionId || missions[0]?.id;
    if (!mId) return [];
    return missions.find((m) => Number(m.id) === Number(mId))?.objectives || [];
  }, [aorTargetMissionId, editDraft?.mission_id, targetMissionId, missions]);

  const mutateEditDraft = (
    updater: (prev: EditDraftState) => EditDraftState,
    liveStylePatch?: Record<string, any>
  ) => {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (liveStylePatch) {
        onUpdateEditingStyle(next.id, liveStylePatch);
      }
      return next;
    });
  };

  const handleSaveEditedMarking = async () => {
    if (!editDraft || isBusy) return;
    setIsBusy(true);
    try {
      const latestItem = markingsList.find((m) => m.id === editDraft.id);
      const latestGeometry = latestItem?.geometry || editDraft.raw.geometry;
      const dashArray = getDashArrayFromStyle(editDraft.lineStyle);

      const updatedProps: Record<string, any> = {
        ...(editDraft.raw.properties || {}),
        label: editDraft.label,
        notes: editDraft.notes,
        color: editDraft.color,
        fillColor: editDraft.fillColor || editDraft.color,
        weight: Number(editDraft.weight || 3),
        dashArray,
        fillOpacity: Number(editDraft.fillOpacity ?? 0.2),
      };

      if (editDraft.shape === 'text') {
        updatedProps.text = editDraft.label;
      }
      if (editDraft.shape === 'icon' && editDraft.icon) {
        updatedProps.icon = editDraft.icon;
      } else if (editDraft.shape !== 'icon') {
        delete updatedProps.icon;
      }

      const validScope = resolveValidatedScope(editDraft.visibility);
      const isMissionOrSortie = validScope === 'mission' || validScope === 'sortie';

      const payload = {
        id: editDraft.id,
        geometry: latestGeometry,
        properties: updatedProps,
        visibility: validScope,
        mission_id: isMissionOrSortie ? editDraft.mission_id || null : null,
        sortie_id: validScope === 'sortie' ? editDraft.sortie_id || null : null,
        marking_type: editDraft.raw.marking_type || 'drawing',
      };

      const updated = await saveCampaignTacticalMarking(
        apiBaseUrl,
        mapData.campaign.id,
        payload,
        { discordId, token }
      );
      onMarkingsChange(updated);
      onSelectEditingMarking(null);
      setActiveTab('list');
      onNotify('success', 'Tactical marking updated.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update tactical marking.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteMarking = async (id: number) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const updated = await deleteCampaignTacticalMarking(
        apiBaseUrl,
        mapData.campaign.id,
        id,
        { discordId, token }
      );
      onMarkingsChange(updated);
      if (editDraft?.id === id) {
        onSelectEditingMarking(null);
        setActiveTab('list');
      }
      onNotify('info', 'Tactical marking deleted.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete tactical marking.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyAorAssignment = async () => {
    if (!editDraft || isBusy) return;
    const mId =
      aorTargetMissionId || editDraft.mission_id || targetMissionId || missions[0]?.id || null;
    if (!mId) {
      onNotify('warning', 'Please select a target mission first.');
      return;
    }

    const isObjective = aorTargetSelection.startsWith('obj_');
    const objIdx = isObjective ? parseInt(aorTargetSelection.replace('obj_', ''), 10) : null;
    if (isObjective && (objIdx === null || Number.isNaN(objIdx))) {
      onNotify('warning', 'Please select a valid objective.');
      return;
    }

    setIsBusy(true);
    try {
      const res = await assignCampaignTacticalMarkingAsAor(
        apiBaseUrl,
        mapData.campaign.id,
        editDraft.id,
        {
          mission_id: Number(mId),
          target_type: isObjective ? 'objective' : 'mission',
          objective_index: isObjective ? objIdx : null,
        },
        { discordId, token }
      );
      onAorAssigned(res);
      onSelectEditingMarking(null);
      setActiveTab('list');
      onNotify(
        'success',
        isObjective
          ? `Marking assigned as AOR for Objective #${(objIdx ?? 0) + 1}.`
          : 'Marking assigned as Primary Mission AOR.'
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to assign marking as AOR.');
    } finally {
      setIsBusy(false);
    }
  };

  const scopeBadge = isDrawingActive ? (
    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-bold animate-pulse flex items-center gap-1">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      <span>Drawing: {activeDrawingType}</span>
    </span>
  ) : undefined;

  const headerActions = isDrawingActive ? (
    <div className="flex items-center gap-1">
      {(activeDrawingType === 'polygon' || activeDrawingType === 'line') && (
        <button
          type="button"
          onClick={onFinishDraw}
          className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors border border-emerald-400/50 shadow-sm flex items-center gap-1 cursor-pointer"
          title="Finish and close shape"
        >
          <Check className="w-3 h-3" weight="bold" />
          <span>Finish</span>
        </button>
      )}
      <button
        type="button"
        onClick={onCancelDraw}
        className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-[11px] font-semibold transition-colors border border-stone-700/60 cursor-pointer"
      >
        Cancel Draw
      </button>
    </div>
  ) : undefined;

  // Store active creation scope parameters on a data attribute / event so parent's onCompleteDraw can read current values without race conditions:
  // Better yet, let's also write a tiny helper hook via window/callback? We'll attach current scope onto `onStartDraw` OR sync through `useEffect`!
  // Let's keep current scope synced on `window` OR pass an explicit `scopeState` prop? Wait: let's add an optional prop right below `onScopeChange`! We will keep the component clean by storing it in `data-`? No, let's add `onScopeChange` prop cleanly!
  const onScopeChangeRef = React.useRef(onScopeChange);
  onScopeChangeRef.current = onScopeChange;

  useEffect(() => {
    const valid = resolveValidatedScope(visibilityScope);
    onScopeChangeRef.current?.({
      visibility: valid,
      missionId: valid === 'mission' || valid === 'sortie' ? targetMissionId : null,
      sortieId: valid === 'sortie' ? targetSortieId : null,
    });
  }, [visibilityScope, targetMissionId, targetSortieId, permissions]);

  return (
    <FloatingToolWindow
      title="Tactical Markings"
      titleClassName="text-amber-400"
      icon={<PencilSimpleLine className="w-4 h-4 text-amber-400" weight="duotone" />}
      badge={scopeBadge}
      headerActions={headerActions}
      isOpen={isOpen}
      onClose={() => {
        onCancelDraw();
        onClose();
      }}
      initialPos={{
        x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 440) : 760,
        y: 120,
      }}
      widthClass="w-[410px] max-w-[95vw]"
      maxHeightClass="max-h-[88vh]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-stone-800 bg-stone-950/60 px-2 py-1 text-xs shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('shapes')}
          className={`flex-1 py-1.5 px-2 rounded-md border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'shapes'
              ? 'bg-stone-800 text-amber-400 font-bold border-stone-700'
              : 'text-stone-400 hover:text-stone-200 border-transparent'
          }`}
        >
          <Shapes className="w-3.5 h-3.5" weight="duotone" />
          <span>Shapes</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('icons')}
          className={`flex-1 py-1.5 px-2 rounded-md border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'icons'
              ? 'bg-stone-800 text-amber-400 font-bold border-stone-700'
              : 'text-stone-400 hover:text-stone-200 border-transparent'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" weight="duotone" />
          <span>Tactical Icons</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-1.5 px-2 rounded-md border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'list'
              ? 'bg-stone-800 text-amber-400 font-bold border-stone-700'
              : 'text-stone-400 hover:text-stone-200 border-transparent'
          }`}
        >
          <ListBullets className="w-3.5 h-3.5" weight="duotone" />
          <span>Active ({markingsList.length})</span>
        </button>
        {editDraft && (
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-1.5 px-2 rounded-md border text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-amber-500/20 text-amber-300 font-bold border-amber-500 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 border-transparent'
            }`}
          >
            <PencilSimpleLine className="w-3.5 h-3.5" weight="duotone" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="p-3 text-xs text-stone-200 bg-stone-900/95 overflow-y-auto flex-1 space-y-3.5">
        {/* TAB 1: DRAW SHAPES */}
        {activeTab === 'shapes' && (
          <div className="space-y-3">
            {!permissions.canCreateTacticalMarkings && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <Lock className="w-4 h-4 shrink-0 text-amber-400" weight="duotone" />
                <span>You do not have permission to create tactical markings.</span>
              </div>
            )}

            <div
              className={`space-y-1.5 ${
                !permissions.canCreateTacticalMarkings ? 'opacity-40 pointer-events-none select-none' : ''
              }`}
            >
              {visibilityScope === 'mission' && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-300 mb-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" weight="duotone" />
                  <span>
                    Drawing on <strong>Mission layer</strong>. Click any drawn shape and select{' '}
                    <strong>AOR Integration</strong> to bind it as the mission or objective
                    operational boundary.
                  </span>
                </div>
              )}

              <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Select Shape to Draw
              </label>

              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { key: 'line', label: 'Line', icon: <LineSegment className="w-4 h-4" weight="duotone" /> },
                    { key: 'polygon', label: 'Polygon', icon: <Polygon className="w-4 h-4" weight="duotone" /> },
                    { key: 'rectangle', label: 'Box', icon: <Square className="w-4 h-4" weight="duotone" /> },
                    { key: 'circle', label: 'Circle', icon: <Circle className="w-4 h-4" weight="duotone" /> },
                    { key: 'text', label: 'Text', icon: <TextT className="w-4 h-4" weight="duotone" /> },
                  ] as const
                ).map((item) => {
                  const isActive =
                    (isDrawingActive && activeDrawingType === item.key) ||
                    (!isDrawingActive && activeShape === item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={!permissions.canCreateTacticalMarkings}
                      onClick={() => triggerDraw(item.key)}
                      className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all text-center cursor-pointer ${
                        isActive && isDrawingActive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm ring-1 ring-amber-500/40'
                          : isActive
                            ? 'bg-stone-800/80 text-amber-300 border-amber-500/50'
                            : 'bg-stone-950 text-stone-300 hover:bg-stone-800 border-stone-800'
                      }`}
                    >
                      {item.icon}
                      <span className="text-[11px] font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shape Label vs Text Box Content */}
            {activeShape !== 'text' ? (
              <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-1">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Shape Label (Permanent on Map)
                </label>
                <input
                  type="text"
                  value={shapeLabel}
                  onChange={(e) => {
                    setShapeLabel(e.target.value);
                    if (isDrawingActive) onUpdateDrawOptions({ label: e.target.value });
                  }}
                  placeholder="e.g. FLOT, Phase Line Alpha, Killbox West, LZ Hawk..."
                  className="w-full bg-stone-900 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>
            ) : (
              <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-2">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Text Box Content
                </label>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    if (isDrawingActive) onUpdateDrawOptions({ text: e.target.value });
                  }}
                  placeholder="Enter map annotation text..."
                  className="w-full bg-stone-900 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 font-sans"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-stone-400">Size:</label>
                    <select
                      value={textFontSize}
                      onChange={(e) => {
                        const sz = Number(e.target.value);
                        setTextFontSize(sz);
                        if (isDrawingActive) onUpdateDrawOptions({ fontSize: sz });
                      }}
                      className="bg-stone-900 text-stone-200 border border-stone-700 rounded px-1.5 py-0.5 text-xs"
                    >
                      <option value={10}>Small (10px)</option>
                      <option value={12}>Medium (12px)</option>
                      <option value={14}>Large (14px)</option>
                      <option value={16}>Header (16px)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={textBoxBg}
                      onChange={(e) => {
                        setTextBoxBg(e.target.checked);
                        if (isDrawingActive) onUpdateDrawOptions({ boxBg: e.target.checked });
                      }}
                      className="rounded border-stone-700 bg-stone-900 accent-amber-500 w-3.5 h-3.5"
                    />
                    <span>Background Card</span>
                  </label>
                </div>
              </div>
            )}

            {/* Line Style */}
            <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-1.5">
              <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Line Style
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['solid', 'Solid —'],
                    ['dashed', 'Dashed – –'],
                    ['dotted', 'Dotted · · ·'],
                    ['dashdot', 'Dash-Dot –·–'],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleSelectLineStyle(k)}
                    className={`py-1 px-1.5 rounded border text-[11px] font-semibold text-center transition-all cursor-pointer ${
                      lineStyle === k
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Thickness & Fill Opacity */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-1">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Thickness
                </label>
                <select
                  value={activeWeight}
                  onChange={(e) => {
                    const w = parseInt(e.target.value, 10);
                    setActiveWeight(w);
                    if (isDrawingActive) onUpdateDrawOptions({ weight: w });
                  }}
                  className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded-md px-2 py-1 text-xs"
                >
                  <option value={1}>1 px (Fine)</option>
                  <option value={2}>2 px</option>
                  <option value={3}>3 px (Standard)</option>
                  <option value={4}>4 px (Bold)</option>
                  <option value={5}>5 px</option>
                  <option value={6}>6 px (Heavy)</option>
                  <option value={8}>8 px (Thick)</option>
                </select>
              </div>
              <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Fill Opacity
                  </label>
                  <span className="text-[11px] font-mono tabular-nums text-amber-400 font-bold">
                    {Math.round(fillOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={fillOpacity}
                  onChange={(e) => {
                    const op = parseFloat(e.target.value);
                    setFillOpacity(op);
                    if (isDrawingActive) onUpdateDrawOptions({ fillOpacity: op });
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TACTICAL SVG ICONS */}
        {activeTab === 'icons' && (
          <div className="space-y-3">
            {!permissions.canCreateTacticalMarkings && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <Lock className="w-4 h-4 shrink-0 text-amber-400" weight="duotone" />
                <span>You do not have permission to place tactical markings.</span>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex items-center gap-1 bg-stone-950/80 p-1 rounded-lg border border-stone-800 text-[11px] overflow-x-auto">
              {iconCatalog.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded text-center whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-stone-800 text-amber-300 font-bold shadow-sm'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Icon Badge / Label */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Icon Badge / Label (Optional)
              </label>
              <input
                type="text"
                value={iconLabel}
                onChange={(e) => {
                  setIconLabel(e.target.value);
                  if (isDrawingActive && activeDrawingType === 'icon') {
                    onUpdateDrawOptions({ label: e.target.value });
                  }
                }}
                disabled={!permissions.canCreateTacticalMarkings}
                placeholder="e.g. 1st Tank Plt, CP Alpha, Depot 4..."
                className="w-full bg-stone-950 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 disabled:opacity-40"
              />
            </div>

            {/* Icon Palette Grid */}
            <div
              className={`space-y-1 ${
                !permissions.canCreateTacticalMarkings ? 'opacity-40 pointer-events-none select-none' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Click Icon to Place on Map
                </label>
                <span className="text-[11px] text-stone-500 tabular-nums">
                  {categoryIcons.length} icons
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                {categoryIcons.map((ic) => (
                  <button
                    key={ic.id}
                    type="button"
                    disabled={!permissions.canCreateTacticalMarkings}
                    onClick={() => triggerIconPlacement(ic.id)}
                    className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition-all group relative cursor-pointer ${
                      selectedIcon === ic.id
                        ? 'border-amber-500 bg-stone-800/80'
                        : 'border-stone-800 bg-stone-950/80 hover:bg-stone-900'
                    }`}
                  >
                    <div
                      className="w-7 h-7 flex items-center justify-center group-hover:scale-110 transition-transform [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                      style={{ color: activeColor || ic.defaultColor || '#f59e0b' }}
                      dangerouslySetInnerHTML={{ __html: ic.svg }}
                    />
                    <span className="text-[11px] font-semibold text-stone-300 text-center leading-tight truncate max-w-full px-0.5">
                      {ic.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PLACED MARKINGS LIST */}
        {activeTab === 'list' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-stone-400 font-semibold uppercase">
              <span>Active Tactical Annotations</span>
              <span className="tabular-nums">{markingsList.length} total</span>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {markingsList.length === 0 ? (
                <div className="text-center py-8 text-stone-500 text-xs italic">
                  No markings placed on the map yet.
                </div>
              ) : (
                markingsList.map((m) => {
                  const visColorClass =
                    m.visibility === 'personal'
                      ? 'text-emerald-400'
                      : m.visibility === 'campaign'
                        ? 'text-purple-400'
                        : m.visibility === 'mission'
                          ? 'text-sky-400'
                          : 'text-amber-400';
                  return (
                    <div
                      key={m.id}
                      className="bg-stone-950/80 border border-stone-800 rounded-lg p-2.5 hover:border-stone-700 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: m.properties?.color || '#3388ff' }}
                          />
                          <span className="font-bold text-xs text-stone-200 truncate">
                            {m.properties?.label ||
                              m.properties?.text ||
                              `${m.properties?.shape || 'Marking'} #${m.id}`}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[11px] font-bold uppercase tracking-wider bg-stone-800 text-stone-400 border border-stone-700 shrink-0">
                            {m.properties?.shape || 'Shape'}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>By: {m.creator_name || 'User'}</span>
                          <span>&bull;</span>
                          <span className={`capitalize ${visColorClass}`}>{m.visibility}</span>
                          {m.mission_name && (
                            <span className="text-stone-500 truncate">({m.mission_name})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onFlyToMarking(m.id);
                            if (m.can_edit) {
                              onSelectEditingMarking(m);
                            }
                          }}
                          title="Center on Map"
                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-sky-400 border border-stone-800 transition-colors cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" weight="duotone" />
                        </button>
                        {m.can_edit && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSelectEditingMarking(m)}
                              title="Edit Marking"
                              className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-amber-400 border border-stone-800 transition-colors cursor-pointer"
                            >
                              <PencilSimpleLine className="w-3.5 h-3.5" weight="duotone" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMarking(m.id)}
                              disabled={isBusy}
                              title="Delete Marking"
                              className="p-1 rounded bg-stone-900 hover:bg-red-950 text-stone-400 hover:text-red-400 border border-stone-800 transition-colors cursor-pointer"
                            >
                              <Trash className="w-3.5 h-3.5" weight="duotone" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: EDIT SELECTED MARKING */}
        {activeTab === 'edit' && editDraft && (
          <div className="space-y-3 bg-stone-950/90 border border-amber-500/40 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {editDraft.shape}
                </span>
                <span className="text-xs font-bold text-stone-200">Editing #{editDraft.id}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectEditingMarking(null);
                  setActiveTab('list');
                }}
                className="text-xs text-stone-400 hover:text-stone-200 hover:underline cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <ArrowsOutCardinal className="w-4 h-4 shrink-0 text-amber-400" weight="duotone" />
              <span>
                Drag this icon or grab shape vertex handles directly on the map to reposition or
                resize.
              </span>
            </div>

            {/* Label */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Label / Annotation
              </label>
              <input
                type="text"
                value={editDraft.label}
                onChange={(e) => {
                  const val = e.target.value;
                  mutateEditDraft(
                    (prev) => ({ ...prev, label: val }),
                    editDraft.shape === 'text' ? { label: val, text: val } : { label: val }
                  );
                }}
                placeholder="Annotation label..."
                className="w-full bg-stone-900 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 font-sans"
              />
            </div>

            {/* Change Icon (when shape === 'icon') */}
            {(editDraft.shape === 'icon' || editDraft.icon) && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Change Icon
                </label>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-stone-900/80 border border-stone-800 rounded-lg">
                  {iconCatalog.list.map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      title={ic.label}
                      onClick={() =>
                        mutateEditDraft((prev) => ({ ...prev, icon: ic.id }), { icon: ic.id })
                      }
                      className={`p-1 rounded flex flex-col items-center justify-center cursor-pointer border transition-all ${
                        editDraft.icon === ic.id
                          ? 'bg-amber-500/20 border-amber-400 shadow ring-1 ring-amber-400/50'
                          : 'bg-stone-950 border-stone-800 hover:border-stone-600'
                      }`}
                    >
                      <div
                        className="w-5 h-5 flex items-center justify-center text-amber-400 [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: ic.svg }}
                      />
                      <span className="text-[11px] truncate w-full text-center text-stone-400 mt-0.5">
                        {ic.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Intel / Tactical Notes
              </label>
              <textarea
                value={editDraft.notes}
                onChange={(e) =>
                  mutateEditDraft((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={2}
                placeholder="Add tactical notes or instructions..."
                className="w-full bg-stone-900 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-400 font-sans resize-y"
              />
            </div>

            {/* Visibility Scope Redefinition */}
            <div className="space-y-1.5 p-2 rounded-lg bg-stone-900/60 border border-stone-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                <span>Marking Layer / Visibility</span>
                <span className="text-[11px] text-amber-400 font-normal normal-case">
                  Change layer
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => mutateEditDraft((prev) => ({ ...prev, visibility: 'personal' }))}
                  className={`py-1 px-1 rounded border text-[11px] text-center transition-all cursor-pointer ${
                    editDraft.visibility === 'personal'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold'
                      : 'bg-stone-900 text-stone-400 border-stone-800'
                  }`}
                >
                  Personal
                </button>
                {(
                  [
                    [
                      'campaign',
                      'Campaign',
                      permissions.canManageCampaignTacticalMarkings,
                      'bg-purple-500/20 text-purple-300 border-purple-500 font-bold',
                      'Requires Manage:OpCampaignTacticalMarkings permission',
                    ],
                    [
                      'mission',
                      'Mission',
                      permissions.canManageMissionTacticalMarkings,
                      'bg-sky-500/20 text-sky-300 border-sky-500 font-bold',
                      'Requires Manage:OpMissionTacticalMarkings permission',
                    ],
                    [
                      'sortie',
                      'Sortie',
                      permissions.canManageSortieTacticalMarkings,
                      'bg-amber-500/20 text-amber-300 border-amber-500 font-bold',
                      'Requires Manage:OpSortieTacticalMarkings permission',
                    ],
                  ] as const
                ).map(([scopeKey, lbl, allowed, activeCls, lockedTitle]) => (
                  <button
                    key={scopeKey}
                    type="button"
                    disabled={!allowed}
                    title={allowed ? `${lbl} layer` : lockedTitle}
                    onClick={() => {
                      if (!allowed) return;
                      mutateEditDraft((prev) => {
                        const nextMId = prev.mission_id || missions[0]?.id || null;
                        const firstSortie =
                          missions.find((m) => Number(m.id) === Number(nextMId))?.sorties?.[0]
                            ?.id ?? null;
                        return {
                          ...prev,
                          visibility: scopeKey,
                          mission_id: nextMId,
                          sortie_id: scopeKey === 'sortie' ? prev.sortie_id || firstSortie : null,
                        };
                      });
                    }}
                    className={`py-1 px-1 rounded border text-[11px] text-center transition-all flex items-center justify-center gap-0.5 ${
                      editDraft.visibility === scopeKey
                        ? activeCls
                        : 'bg-stone-900 text-stone-400 border-stone-800'
                    } ${
                      !allowed
                        ? 'opacity-30 cursor-not-allowed pointer-events-none select-none'
                        : 'cursor-pointer'
                    }`}
                  >
                    {!allowed && <Lock className="w-2.5 h-2.5 text-stone-500 shrink-0" />}
                    <span>{lbl}</span>
                  </button>
                ))}
              </div>

              {(editDraft.visibility === 'mission' || editDraft.visibility === 'sortie') && (
                <div className="space-y-1 mt-1">
                  <label className="block text-[11px] text-stone-400">Assigned Mission:</label>
                  <select
                    value={editDraft.mission_id ?? ''}
                    onChange={(e) => {
                      const mId = e.target.value ? Number(e.target.value) : null;
                      const firstSortie =
                        missions.find((m) => Number(m.id) === Number(mId))?.sorties?.[0]?.id ?? null;
                      mutateEditDraft((prev) => ({
                        ...prev,
                        mission_id: mId,
                        sortie_id:
                          prev.visibility === 'sortie' ? firstSortie : null,
                      }));
                      setAorTargetMissionId(mId);
                      setAorTargetSelection('mission');
                    }}
                    className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                  >
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editDraft.visibility === 'sortie' && (
                <div className="space-y-1 mt-1">
                  <label className="block text-[11px] text-stone-400">Assigned Sortie:</label>
                  <select
                    value={editDraft.sortie_id ?? ''}
                    onChange={(e) =>
                      mutateEditDraft((prev) => ({
                        ...prev,
                        sortie_id: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                  >
                    {editSorties.length === 0 ? (
                      <option value="" disabled>
                        No sorties in this mission
                      </option>
                    ) : (
                      editSorties.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Line Style, Thickness & Opacity (for Line, Polygon, Box, Circle) */}
            {editDraft.shape !== 'icon' && editDraft.shape !== 'text' && (
              <>
                <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800 space-y-1.5">
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Line Style
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        ['solid', 'Solid —'],
                        ['dashed', 'Dashed – –'],
                        ['dotted', 'Dotted · · ·'],
                        ['dashdot', 'Dash-Dot –·–'],
                      ] as const
                    ).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          mutateEditDraft((prev) => ({ ...prev, lineStyle: k }), {
                            dashArray: getDashArrayFromStyle(k),
                          })
                        }
                        className={`py-1 px-1.5 rounded border text-[11px] text-center transition-all cursor-pointer ${
                          editDraft.lineStyle === k
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                            : 'bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800 space-y-1">
                    <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      Thickness
                    </label>
                    <select
                      value={editDraft.weight}
                      onChange={(e) => {
                        const w = parseInt(e.target.value, 10);
                        mutateEditDraft((prev) => ({ ...prev, weight: w }), { weight: w });
                      }}
                      className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded-md px-2 py-1 text-xs"
                    >
                      <option value={1}>1 px (Fine)</option>
                      <option value={2}>2 px</option>
                      <option value={3}>3 px (Standard)</option>
                      <option value={4}>4 px (Bold)</option>
                      <option value={5}>5 px</option>
                      <option value={6}>6 px (Heavy)</option>
                      <option value={8}>8 px (Thick)</option>
                    </select>
                  </div>

                  <div
                    className={`bg-stone-900/60 p-2.5 rounded-lg border border-stone-800 space-y-1 ${
                      editDraft.shape === 'line' ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Fill Opacity
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-amber-400 font-bold">
                        {editDraft.shape === 'line'
                          ? 'N/A'
                          : `${Math.round(editDraft.fillOpacity * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={editDraft.shape === 'line'}
                      value={editDraft.fillOpacity}
                      onChange={(e) => {
                        const op = parseFloat(e.target.value);
                        mutateEditDraft((prev) => ({ ...prev, fillOpacity: op }), {
                          fillOpacity: op,
                        });
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Stroke & Fill Color Palette */}
            <div className="space-y-2 bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    {editDraft.shape === 'icon' ? 'Icon Color' : 'Stroke / Line Color'}
                  </label>
                  <span className="font-mono text-[11px] text-amber-400 font-bold">
                    {editDraft.color}
                  </span>
                </div>
                <div className="flex gap-1.5 items-center flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={`edit-stroke-${c}`}
                      type="button"
                      onClick={() => {
                        const nextFill = editDraft.syncFillColor ? c : editDraft.fillColor;
                        mutateEditDraft(
                          (prev) => ({
                            ...prev,
                            color: c,
                            fillColor: prev.syncFillColor ? c : prev.fillColor,
                          }),
                          { color: c, fillColor: nextFill }
                        );
                      }}
                      className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${
                        editDraft.color === c ? 'border-amber-400 scale-110 shadow' : 'border-stone-700'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {editDraft.shape !== 'line' &&
                editDraft.shape !== 'icon' &&
                editDraft.shape !== 'text' && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-800">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Fill Color
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDraft.syncFillColor}
                          onChange={(e) => {
                            const synced = e.target.checked;
                            mutateEditDraft(
                              (prev) => ({
                                ...prev,
                                syncFillColor: synced,
                                fillColor: synced ? prev.color : prev.fillColor,
                              }),
                              synced ? { fillColor: editDraft.color } : undefined
                            );
                          }}
                          className="rounded border-stone-700 bg-stone-900 accent-amber-500 w-3 h-3"
                        />
                        <span>Same as stroke</span>
                      </label>
                    </div>
                    {!editDraft.syncFillColor && (
                      <div className="flex gap-1.5 items-center flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={`edit-fill-${c}`}
                            type="button"
                            onClick={() =>
                              mutateEditDraft((prev) => ({ ...prev, fillColor: c }), {
                                fillColor: c,
                              })
                            }
                            className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${
                              editDraft.fillColor === c
                                ? 'border-amber-400 scale-110 shadow'
                                : 'border-stone-700'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Area of Responsibility (AOR) Assignment Card */}
            {(editDraft.shape === 'polygon' ||
              editDraft.shape === 'rectangle' ||
              editDraft.shape === 'circle') &&
              permissions.canEditMissionAor &&
              missions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-sky-950/50 border border-sky-500/40 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-sky-400" weight="duotone" />
                      <span>Area of Responsibility (AOR)</span>
                    </span>
                    <span className="text-stone-400 text-[11px]">Bind boundary</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-stone-400 font-semibold">
                      Target Mission:
                    </label>
                    <select
                      value={aorTargetMissionId ?? ''}
                      onChange={(e) => {
                        setAorTargetMissionId(e.target.value ? Number(e.target.value) : null);
                        setAorTargetSelection('mission');
                      }}
                      className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-sky-400 focus:outline-none"
                    >
                      {missions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] text-stone-400 font-semibold">
                      Assign Boundary To:
                    </label>
                    <select
                      value={aorTargetSelection}
                      onChange={(e) => setAorTargetSelection(e.target.value)}
                      className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-sky-400 focus:outline-none"
                    >
                      <option value="mission">⚔️ Mission Primary AOR</option>
                      {aorObjectives.map((obj) => (
                        <option key={obj.index} value={`obj_${obj.index}`}>
                          🎯 OBJ #{obj.index + 1}: {obj.objective}
                          {obj.aor ? ' (Replaces AOR)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyAorAssignment}
                    disabled={isBusy}
                    className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-sky-400 shadow-md ring-1 ring-sky-400/40 cursor-pointer"
                    title="Set this shape as an Area of Responsibility boundary"
                  >
                    <CheckCircle className="w-4 h-4" weight="duotone" />
                    <span>
                      {aorTargetSelection === 'mission'
                        ? 'Set as Primary Mission AOR'
                        : `Set as OBJ #${
                            parseInt(aorTargetSelection.replace('obj_', ''), 10) + 1
                          } AOR`}
                    </span>
                  </button>
                </div>
              )}

            {/* Save & Delete Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={handleSaveEditedMarking}
                disabled={isBusy}
                className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FloppyDisk className="w-3.5 h-3.5" weight="duotone" />
                <span>{isBusy ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMarking(editDraft.id)}
                disabled={isBusy}
                className="py-1.5 px-3 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/80 font-bold text-xs transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* SHARED BOTTOM SECTIONS (Visible when on Shapes or Tactical Icons) */}
        {(activeTab === 'shapes' || activeTab === 'icons') && (
          <>
            {/* Color Swatches */}
            <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  Color Swatches
                </span>
                <span className="font-mono text-[11px] text-stone-300 font-bold">
                  {activeColor}
                </span>
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleSelectColorSwatch(color)}
                    title={color}
                    className={`w-6 h-6 rounded-md cursor-pointer border-2 transition-all ${
                      activeColor === color
                        ? 'border-amber-400 scale-110 shadow-md ring-1 ring-amber-400/50'
                        : 'border-stone-700 hover:border-stone-400'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label
                  className="w-6 h-6 rounded-md cursor-pointer border-2 border-stone-700 hover:border-stone-400 flex items-center justify-center bg-stone-900 relative overflow-hidden"
                  title="Custom Color"
                >
                  <Palette className="w-3.5 h-3.5 text-stone-300" weight="duotone" />
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => handleSelectColorSwatch(e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>
            </div>

            {/* Marking Visibility Scope */}
            <div className="bg-stone-950/80 p-2.5 rounded-lg border border-stone-800 space-y-2">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" weight="duotone" />
                <span>Marking Visibility Scope</span>
              </label>

              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  disabled={!permissions.canCreateTacticalMarkings}
                  onClick={() => {
                    if (permissions.canCreateTacticalMarkings) setVisibilityScope('personal');
                  }}
                  className={`py-1 px-1 rounded border text-[11px] text-center transition-all ${
                    visibilityScope === 'personal'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800'
                  } ${
                    !permissions.canCreateTacticalMarkings
                      ? 'opacity-30 cursor-not-allowed pointer-events-none select-none'
                      : 'cursor-pointer'
                  }`}
                >
                  Personal
                </button>
                {(
                  [
                    [
                      'campaign',
                      'Campaign',
                      permissions.canManageCampaignTacticalMarkings,
                      'bg-purple-500/20 text-purple-300 border-purple-500 font-bold',
                      'Requires Manage:OpCampaignTacticalMarkings permission',
                      'Campaign-wide layer',
                    ],
                    [
                      'mission',
                      'Mission',
                      permissions.canManageMissionTacticalMarkings,
                      'bg-sky-500/20 text-sky-300 border-sky-500 font-bold',
                      'Requires Manage:OpMissionTacticalMarkings permission',
                      'Mission-specific layer',
                    ],
                    [
                      'sortie',
                      'Sortie',
                      permissions.canManageSortieTacticalMarkings,
                      'bg-amber-500/20 text-amber-300 border-amber-500 font-bold',
                      'Requires Manage:OpSortieTacticalMarkings permission',
                      'Sortie-specific layer',
                    ],
                  ] as const
                ).map(([scopeKey, lbl, allowed, activeCls, lockedTitle, okTitle]) => (
                  <button
                    key={scopeKey}
                    type="button"
                    disabled={!allowed}
                    title={allowed ? okTitle : lockedTitle}
                    onClick={() => {
                      if (allowed) setVisibilityScope(scopeKey);
                    }}
                    className={`py-1 px-1 rounded border text-[11px] text-center transition-all flex items-center justify-center gap-0.5 ${
                      visibilityScope === scopeKey
                        ? activeCls
                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border-stone-800'
                    } ${
                      !allowed
                        ? 'opacity-30 cursor-not-allowed pointer-events-none select-none'
                        : 'cursor-pointer'
                    }`}
                  >
                    {!allowed && <Lock className="w-2.5 h-2.5 text-stone-500 shrink-0" />}
                    <span>{lbl}</span>
                  </button>
                ))}
              </div>

              {(visibilityScope === 'mission' || visibilityScope === 'sortie') && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-stone-400">Target Mission:</label>
                  <select
                    value={targetMissionId ?? ''}
                    onChange={(e) =>
                      setTargetMissionId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                  >
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {visibilityScope === 'sortie' && (
                <div className="space-y-1">
                  <label className="block text-[11px] text-stone-400">Target Sortie:</label>
                  <select
                    value={targetSortieId ?? ''}
                    onChange={(e) =>
                      setTargetSortieId(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full bg-stone-900 text-stone-200 border border-stone-700 rounded px-2 py-1 text-xs focus:border-amber-400 focus:outline-none"
                  >
                    {availableSorties.length === 0 ? (
                      <option value="" disabled>
                        No sorties in this mission
                      </option>
                    ) : (
                      availableSorties.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <p className="text-[11px] text-stone-500 italic">
                {visibilityScope === 'personal'
                  ? 'Visible only to you on this campaign map.'
                  : visibilityScope === 'campaign'
                    ? 'Visible to all campaign participants across all missions & sorties.'
                    : visibilityScope === 'mission'
                      ? 'Visible to participants viewing the targeted mission.'
                      : 'Visible to pilots assigned/viewing the targeted sortie.'}
              </p>
            </div>
          </>
        )}
      </div>
    </FloatingToolWindow>
  );
};
