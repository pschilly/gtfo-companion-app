import React from 'react';
import {
  AirplaneLanding,
  AirplaneTakeoff,
  CrosshairSimple,
  MapPin,
  SealQuestion,
} from '@phosphor-icons/react';
import { CampaignMapPayload } from '../../../types';
import { FloatingToolWindow } from './FloatingToolWindow';

interface MapLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapData?: CampaignMapPayload | null;
  zIndex?: number;
  onFocus?: () => void;
}

/**
 * Replicates `partials/modals/legend-modal.blade.php` inside a floating draggable window,
 * rendering actual portal SVGs (`taskings.icon_html`, `threatTypes.icon`, `supportAssetTypes.icon`)
 * and theater symbology explanations.
 */
export const MapLegendModal: React.FC<MapLegendModalProps> = ({
  isOpen,
  onClose,
  mapData,
  zIndex = 1250,
  onFocus,
}) => {
  const threatGroups = (mapData?.threatTypes || []).reduce<
    Record<string, NonNullable<CampaignMapPayload['threatTypes']>>
  >((acc, t) => {
    const cat = t.category || 'Threats';
    (acc[cat] ||= []).push(t);
    return acc;
  }, {});

  return (
    <FloatingToolWindow
      title="Legend"
      subtitle="Campaign Symbology & Map Shortcuts"
      icon={<SealQuestion className="w-4 h-4 text-sky-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 480, y: 140 }}
      widthClass="w-[440px] max-w-[94vw]"
      maxHeightClass="max-h-[75vh]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 text-sm text-stone-200 bg-stone-900/90 overflow-y-auto space-y-4">
        {/* MISSION TASKINGS */}
        {mapData && mapData.taskings.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-700 pb-1">
              Mission Taskings
            </p>
            <p className="text-[10px] text-stone-400 mb-2">
              Missions appear as circular markers on the map. The border color and icon indicate the
              tasking type.
            </p>
            <div className="space-y-1.5">
              {mapData.taskings.map((task) => {
                const hex = task.color_hex || '#ef4444';
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <div
                      className="shrink-0 bg-stone-700/50 rounded-full w-7 h-7 flex items-center justify-center border-2 shadow"
                      style={{ borderColor: hex }}
                      dangerouslySetInnerHTML={{
                        __html:
                          task.icon_html ||
                          `<span style="color:${hex};font-weight:bold;font-size:11px;">★</span>`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-xs text-stone-100">{task.label}</span>
                      {task.description && (
                        <span className="text-[10px] text-stone-400 ml-1">
                          — {task.description}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AIRFIELDS & NAVIGATION */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-700 pb-1">
            Airfields &amp; Navigation
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center text-sky-400">
                <AirplaneTakeoff className="w-5 h-5" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs text-sky-400">
                  Departure Airfield (Home Plate)
                </span>
                <span className="text-[10px] text-stone-400 ml-1">
                  — Designated launch airfield for active flight plan.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center text-indigo-400">
                <AirplaneLanding className="w-5 h-5" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs text-indigo-400">
                  Destination Airfield (Recovery)
                </span>
                <span className="text-[10px] text-stone-400 ml-1">
                  — Designated recovery airfield for active flight plan.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center text-amber-400">
                <AirplaneLanding className="w-5 h-5" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs text-amber-400">Divert Airfield</span>
                <span className="text-[10px] text-stone-400 ml-1">
                  — Alternate recovery airfield.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center text-red-500">
                <CrosshairSimple className="w-5 h-5" weight="bold" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs text-stone-100">Bullseye</span>
                <span className="text-[10px] text-stone-400 ml-1">
                  — Reference point for BRAA calls (click footer box to cycle).
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center text-sky-500">
                <MapPin className="w-5 h-5" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-xs text-stone-100">Keyboard Shortcuts</span>
                <span className="text-[10px] text-stone-400 ml-1">
                  — Alt+F Flight Planner, Alt+C Converter, Alt+M Ruler, Alt+U Units, Alt+Enter Focus
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ENEMY THREATS */}
        {Object.keys(threatGroups).length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-700 pb-1">
              Enemy Threats <span className="text-red-400">(Red)</span>
            </p>
            <div className="space-y-2.5">
              {Object.entries(threatGroups).map(([category, list]) => (
                <div key={category} className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-400/80">
                    {category}
                  </span>
                  <div className="space-y-1 pl-1">
                    {list.map((t) => (
                      <div key={t.value} className="flex items-center gap-2">
                        <div
                          className="shrink-0 w-6 h-6 flex items-center justify-center"
                          dangerouslySetInnerHTML={{
                            __html:
                              t.icon ||
                              '<span class="w-4 h-4 rounded-full bg-red-500 inline-block"></span>',
                          }}
                        />
                        <span className="font-semibold text-xs text-stone-100">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <div className="shrink-0 w-7 h-7 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-red-500 opacity-60" />
                </div>
                <span className="text-[10px] text-stone-400">
                  Dashed ring / Patriot fan = threat engagement range
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SUPPORT ASSETS */}
        {mapData && mapData.supportAssetTypes.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 border-b border-stone-700 pb-1">
              Friendly Support Assets <span className="text-blue-400">(Blue)</span>
            </p>
            <div className="space-y-1.5">
              {mapData.supportAssetTypes.map((asset) => (
                <div key={asset.value} className="flex items-center gap-2">
                  <div
                    className="shrink-0 w-6 h-6 flex items-center justify-center"
                    dangerouslySetInnerHTML={{
                      __html:
                        asset.icon ||
                        '<span class="w-4 h-4 rounded-full bg-sky-500 inline-block"></span>',
                    }}
                  />
                  <span className="font-semibold text-xs text-stone-100">{asset.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FloatingToolWindow>
  );
};
