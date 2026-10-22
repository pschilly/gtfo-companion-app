import React, { useState } from 'react';
import {
  ArrowCircleUp,
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  DownloadSimple,
  Sparkle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { downloadAndInstallUpdate, relaunchApp } from '../services/updaterService';
import { STATIC_CONFIG } from '../config/constants';
import { formatBytes } from '../utils/formatters';

export const AppUpdateModal: React.FC = () => {
  const { appUpdate, isUpdateModalOpen, setIsUpdateModalOpen, addLog, currentAppVersion } = useApp();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [isReadyToRelaunch, setIsReadyToRelaunch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isUpdateModalOpen || !appUpdate?.available || !appUpdate.rawUpdate) {
    return null;
  }

  const handleStartUpdate = async () => {
    if (!appUpdate.rawUpdate) return;
    setIsDownloading(true);
    setErrorMsg(null);
    setDownloadPercent(0);

    try {
      addLog('info', 'SYSTEM', `Starting download for Companion App v${appUpdate.version}...`);
      await downloadAndInstallUpdate(appUpdate.rawUpdate, (percent, downloaded, total) => {
        setDownloadPercent(percent);
        setDownloadedBytes(downloaded);
        setTotalBytes(total);
      });

      setIsReadyToRelaunch(true);
      addLog('success', 'SYSTEM', `Companion App v${appUpdate.version} installed successfully. Ready to relaunch.`);
    } catch (err: any) {
      console.error('Update error:', err);
      const msg = err?.message || String(err);
      setErrorMsg(msg);
      addLog('error', 'SYSTEM', `Update installation failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRelaunch = async () => {
    try {
      await relaunchApp();
    } catch (err) {
      console.error('Failed to relaunch:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl p-6 space-y-5 text-stone-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-stone-100">
                  Application Update Available
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  v{appUpdate.version}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Current: v{appUpdate.currentVersion || currentAppVersion} &bull; Published: {appUpdate.date || 'Recent'}
              </p>
            </div>
          </div>

          {!isDownloading && (
            <button
              onClick={() => setIsUpdateModalOpen(false)}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Release Notes / Description */}
        <div className="space-y-3">
          <p className="text-xs text-stone-300">
            A new version of the GTFO Companion App is ready to install.
          </p>

          {appUpdate.body && (
            <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80 max-h-48 overflow-y-auto space-y-1.5 text-xs text-stone-300 font-mono">
              <div className="text-[10px] uppercase font-bold text-stone-500 pb-1 border-b border-stone-800">
                Release Notes
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-stone-300">
                {appUpdate.body}
              </div>
            </div>
          )}

          {/* Progress Bar when Downloading */}
          {isDownloading && (
            <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-stone-300 font-semibold flex items-center gap-2">
                  <ArrowsClockwise className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  Downloading update package...
                </span>
                <span className="text-amber-400 font-bold">{downloadPercent}%</span>
              </div>

              <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full"
                  style={{ width: `${downloadPercent}%` }}
                />
              </div>

              {totalBytes > 0 && (
                <div className="text-[11px] font-mono text-stone-500 text-right">
                  {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center gap-2 text-xs text-red-300">
              <WarningCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ready to Relaunch State */}
          {isReadyToRelaunch && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Update installed successfully! Click below to relaunch and start using <strong>v{appUpdate.version}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-800">
          <span className="text-[11px] font-mono text-stone-500">
            Cryptographically signed with Minisign
          </span>

          <div className="flex items-center gap-2">
            {!isReadyToRelaunch ? (
              <>
                <button
                  onClick={() => setIsUpdateModalOpen(false)}
                  disabled={isDownloading}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 font-mono text-xs transition-colors"
                >
                  Later
                </button>

                <button
                  onClick={handleStartUpdate}
                  disabled={isDownloading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20"
                >
                  {isDownloading ? (
                    <>
                      <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <>
                      <DownloadSimple className="w-3.5 h-3.5" />
                      <span>Install &amp; Update</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleRelaunch}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 animate-pulse"
              >
                <ArrowCircleUp className="w-4 h-4" />
                <span>Relaunch Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
