import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsOutSimple, X } from '@phosphor-icons/react';

interface FloatingToolWindowProps {
  title: string;
  titleClassName?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
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
 * with header mousedown drag + viewport clamping) rendered via portal so drawers can float
 * freely anywhere across the app window above the isolated Leaflet canvas.
 */
export const FloatingToolWindow: React.FC<FloatingToolWindowProps> = ({
  title,
  titleClassName = 'text-stone-100',
  subtitle,
  icon,
  badge,
  headerActions,
  isOpen,
  onClose,
  initialPos = { x: 24, y: 68 },
  widthClass = 'w-[420px] max-w-[94vw]',
  maxHeightClass = 'max-h-[calc(100vh-88px)]',
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

    const clampToViewport = () => {
      const winWidth = winRef.current?.offsetWidth || 380;
      const maxX = Math.max(8, window.innerWidth - Math.min(winWidth, 240));
      const maxY = Math.max(8, window.innerHeight - 52);
      setPos((prev) => {
        const clampedX = Math.max(8, Math.min(maxX, prev.x));
        const clampedY = Math.max(8, Math.min(maxY, prev.y));
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    };

    const rafId = window.requestAnimationFrame(clampToViewport);

    const handleMove = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      const winWidth = winRef.current?.offsetWidth || 380;
      const maxX = Math.max(8, window.innerWidth - Math.min(winWidth, 240));
      const maxY = Math.max(8, window.innerHeight - 52);
      const nextX = Math.max(8, Math.min(maxX, e.clientX - dragStateRef.current.offsetX));
      const nextY = Math.max(8, Math.min(maxY, e.clientY - dragStateRef.current.offsetY));
      setPos({ x: nextX, y: nextY });
    };
    const handleUp = () => {
      dragStateRef.current.active = false;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('resize', clampToViewport);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('resize', clampToViewport);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={winRef}
      onMouseDown={() => onFocus?.()}
      style={{ left: pos.x, top: pos.y, zIndex }}
      className={`fixed ${widthClass} bg-stone-900/95 backdrop-blur-md border border-stone-700/90 rounded-xl shadow-[0_18px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden ${
        minimized ? '' : maxHeightClass
      }`}
    >
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onFocus?.();
          dragStateRef.current = {
            active: true,
            offsetX: e.clientX - pos.x,
            offsetY: e.clientY - pos.y,
          };
        }}
        className="px-3.5 py-2.5 bg-stone-950/85 border-b border-stone-800 flex items-center justify-between gap-2 cursor-move select-none shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <div className={`text-xs font-bold uppercase tracking-wider truncate ${titleClassName}`}>
              {title}
            </div>
            {subtitle && (
              <div className="text-[10px] text-stone-400 truncate font-mono">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerActions}
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
    </div>,
    document.body
  );
};
