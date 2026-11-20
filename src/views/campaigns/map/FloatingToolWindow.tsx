import React, { useEffect, useRef, useState } from 'react';
import { ArrowsOutSimple, X } from '@phosphor-icons/react';

interface FloatingToolWindowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  initialPos?: { x: number; y: number };
  widthClass?: string;
  maxHeightClass?: string;
  zIndex?: number;
  onFocus?: () => void;
  children: React.ReactNode;
}

/**
 * Replicates the Member Portal's floating draggable tool windows (`x-data` drag containers
 * with header mousedown drag + viewport clamping) so multiple planners/converters can
 * float cleanly over the full-bleed Leaflet canvas.
 */
export const FloatingToolWindow: React.FC<FloatingToolWindowProps> = ({
  title,
  subtitle,
  icon,
  badge,
  isOpen,
  onClose,
  initialPos = { x: 24, y: 68 },
  widthClass = 'w-[420px] max-w-[94vw]',
  maxHeightClass = 'max-h-[calc(100%-84px)]',
  zIndex = 1100,
  onFocus,
  children,
}) => {
  const [pos, setPos] = useState(initialPos);
  const [minimized, setMinimized] = useState(false);
  const dragStateRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });
  const winRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      const parent = winRef.current?.offsetParent as HTMLElement | null;
      const winWidth = winRef.current?.offsetWidth || 380;
      const maxW = parent ? parent.clientWidth : window.innerWidth;
      const maxH = parent ? parent.clientHeight : window.innerHeight;
      const maxX = Math.max(8, maxW - Math.min(winWidth, 240));
      const maxY = Math.max(8, maxH - 60);
      setPos((prev) => {
        const clampedX = Math.max(8, Math.min(maxX, prev.x));
        const clampedY = Math.max(8, Math.min(maxY, prev.y));
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    });

    const handleMove = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      const parent = winRef.current?.offsetParent as HTMLElement | null;
      const parentRect = parent?.getBoundingClientRect();
      const winWidth = winRef.current?.offsetWidth || 380;
      const maxW = parent ? parent.clientWidth : window.innerWidth;
      const maxH = parent ? parent.clientHeight : window.innerHeight;
      const rawX = parentRect
        ? e.clientX - parentRect.left - dragStateRef.current.offsetX
        : e.clientX - dragStateRef.current.offsetX;
      const rawY = parentRect
        ? e.clientY - parentRect.top - dragStateRef.current.offsetY
        : e.clientY - dragStateRef.current.offsetY;
      const nextX = Math.max(8, Math.min(Math.max(8, maxW - Math.min(winWidth, 240)), rawX));
      const nextY = Math.max(8, Math.min(Math.max(8, maxH - 60), rawY));
      setPos({ x: nextX, y: nextY });
    };
    const handleUp = () => {
      dragStateRef.current.active = false;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={winRef}
      onMouseDown={() => onFocus?.()}
      style={{ left: pos.x, top: pos.y, zIndex }}
      className={`absolute ${widthClass} bg-stone-900/95 backdrop-blur-md border border-stone-700/90 rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden ${
        minimized ? '' : maxHeightClass
      }`}
    >
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onFocus?.();
          const winRect = winRef.current?.getBoundingClientRect();
          dragStateRef.current = {
            active: true,
            offsetX: winRect ? e.clientX - winRect.left : e.clientX - pos.x,
            offsetY: winRect ? e.clientY - winRect.top : e.clientY - pos.y,
          };
        }}
        className="px-3.5 py-2.5 bg-stone-950/85 border-b border-stone-800 flex items-center justify-between gap-2 cursor-move select-none shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-100 truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[10px] text-stone-400 truncate font-mono">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {badge}
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800"
            title={minimized ? 'Expand Window' : 'Minimize Window'}
          >
            <ArrowsOutSimple className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>}
    </div>
  );
};
