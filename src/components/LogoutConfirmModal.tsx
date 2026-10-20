import React, { useEffect } from 'react';
import { AlertTriangle, LogOut, X } from 'lucide-react';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  callsign: string;
  avatarUrl?: string | null;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  callsign,
  avatarUrl,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-stone-100">
                Confirm Sign Out
              </h3>
              <p className="text-[11px] font-mono text-stone-400">
                Global Task Force Overlord
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-stone-950/70 border border-stone-800/80">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={callsign}
                className="w-10 h-10 rounded-lg object-cover border border-stone-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center font-display font-bold text-amber-400 text-sm shrink-0">
                {callsign.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-stone-400">Signed in as:</div>
              <div className="font-display font-bold text-sm text-stone-100 truncate">
                {callsign}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-stone-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Are you sure you want to sign out? This will clear your Discord authorization token and cached membership profile from this client.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-stone-950 border-t border-stone-800 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-mono font-medium text-stone-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-red-950 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Yes, Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
