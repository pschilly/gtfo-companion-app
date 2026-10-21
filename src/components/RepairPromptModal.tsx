import React, { useEffect } from 'react';
import {
  DownloadSimple,
  FileX,
  ShieldWarning,
  Warning,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { AssetItem } from '../types';

export const RepairPromptModal: React.FC = () => {
  const { repairPrompt, setRepairPrompt, installAsset } = useApp();

  useEffect(() => {
    if (!repairPrompt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRepairPrompt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [repairPrompt, setRepairPrompt]);

  if (!repairPrompt) return null;

  const { asset, record, result } = repairPrompt;
  const missingFiles = result.missingFiles || [];
  const modifiedFiles = result.modifiedFiles || [];
  const totalIssues = missingFiles.length + modifiedFiles.length;

  const handleConfirmRepair = async () => {
    const targetAsset: AssetItem | null =
      asset ||
      (record
        ? {
            id: record.assetId,
            name: record.name,
            description: '',
            category: record.category as any,
            aircraftOrModule: record.aircraftOrModule,
            version: record.installedVersion,
            author: 'GTFO Logistics',
            imagePreviewUrl: '',
            targetFolder: record.targetFolder,
            installFolderName: record.installFolderName,
            requiredTier: 'community',
            requirementLevel: 'optional',
            downloadUrl: '',
            sha256: '',
            fileSizeBytes: 0,
            updatedAt: record.installedAt,
          }
        : null);

    setRepairPrompt(null);
    if (targetAsset) {
      await installAsset(targetAsset);
    }
  };

  return (
    <div
      onClick={() => setRepairPrompt(null)}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-stone-900 border border-amber-500/50 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950 border-b border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
              <ShieldWarning className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-stone-100">
                Issues Detected — DownloadSimple &amp; Fix?
              </h3>
              <p className="text-xs font-mono text-amber-400">
                {record.name} (v{record.installedVersion})
              </p>
            </div>
          </div>

          <button
            onClick={() => setRepairPrompt(null)}
            className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-stone-200 leading-relaxed flex items-start gap-3">
            <Warning className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-stone-100">
                We found <span className="text-amber-300 font-bold">{totalIssues} issue{totalIssues === 1 ? '' : 's'}</span> with your local installation:
              </p>
              <p className="text-stone-300">
                {missingFiles.length > 0 && (
                  <span className="text-red-400 font-semibold">{missingFiles.length} missing file{missingFiles.length === 1 ? '' : 's'}</span>
                )}
                {missingFiles.length > 0 && modifiedFiles.length > 0 && ', '}
                {modifiedFiles.length > 0 && (
                  <span className="text-amber-400 font-semibold">{modifiedFiles.length} modified or corrupted file{modifiedFiles.length === 1 ? '' : 's'}</span>
                )}
                {' in your DCS Saved Games folder.'}
              </p>
              <p className="text-amber-200 font-medium pt-1">
                Do you want to download and fix {totalIssues === 1 ? 'it' : 'them'} now?
              </p>
            </div>
          </div>

          {missingFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <FileX className="w-3.5 h-3.5" />
                Missing Files ({missingFiles.length})
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl bg-stone-950 border border-stone-800 p-3 space-y-1 font-mono text-[11px] text-stone-300">
                {missingFiles.map((f, idx) => (
                  <div key={idx} className="truncate text-red-300/90" title={f}>
                    • {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {modifiedFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <FileX className="w-3.5 h-3.5" />
                Modified / Corrupted Files ({modifiedFiles.length})
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl bg-stone-950 border border-stone-800 p-3 space-y-1 font-mono text-[11px] text-stone-300">
                {modifiedFiles.map((f, idx) => (
                  <div key={idx} className="truncate text-amber-300/90" title={f}>
                    • {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3">
          <button
            onClick={() => setRepairPrompt(null)}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmRepair}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <DownloadSimple className="w-4 h-4" />
            DownloadSimple &amp; Fix Now ({totalIssues} issue{totalIssues === 1 ? '' : 's'})
          </button>
        </div>
      </div>
    </div>
  );
};
