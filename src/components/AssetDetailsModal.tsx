import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  GitBranch,
  Hash,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { openExternalUrl } from '../services/tauriBridge';
import { formatBytes, formatShortDate } from '../utils/formatters';
import { MarkdownViewer } from './MarkdownViewer';

export const AssetDetailsModal: React.FC = () => {
  const {
    selectedAsset,
    setSelectedAsset,
    installedAssets,
    activeDownloads,
    canAccessAsset,
    isUpdateAvailable,
    installAsset,
    uninstallAsset,
    verifyAsset,
    setLoginModalOpen,
    settings,
    dcsEnv,
  } = useApp();

  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const handleClose = () => {
    setActiveImage(null);
    setSelectedAsset(null);
  };

  useEffect(() => {
    if (!selectedAsset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAsset]);

  if (!selectedAsset) return null;

  const installed = installedAssets[selectedAsset.id];
  const progress = activeDownloads[selectedAsset.id];
  const hasAccess = canAccessAsset(selectedAsset);
  const needsUpdate = isUpdateAvailable(selectedAsset);
  const isCore = selectedAsset.requiredTier === 'core';
  const isExternalTool = Boolean(selectedAsset.isExternal || selectedAsset.category === 'tool');

  const baseDcsPath =
    settings.dcsSavedGamesPath ||
    dcsEnv?.activeSavedGamesPath ||
    'C:\\Users\\Pilot\\Saved Games\\DCS';

  const fullTargetPath = selectedAsset.detectionPath
    ? `${baseDcsPath}\\${selectedAsset.detectionPath.replace(/\//g, '\\')}`
    : selectedAsset.installFolderName
    ? `${baseDcsPath}\\${selectedAsset.targetFolder.replace(/\//g, '\\')}\\${
        selectedAsset.installFolderName
      }`
    : selectedAsset.targetFolder
    ? `${baseDcsPath}\\${selectedAsset.targetFolder.replace(/\//g, '\\')}`
    : isExternalTool
    ? 'External Tool // Standalone Application'
    : baseDcsPath;

  const previewSrc = activeImage || selectedAsset.imagePreviewUrl;

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyStatus('idle');
    const ok = await verifyAsset(selectedAsset.id);
    setVerifying(false);
    setVerifyStatus(ok ? 'ok' : 'fail');
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Banner Image */}
        <div className="relative h-64 w-full bg-stone-950 shrink-0">
          <img
            src={previewSrc}
            alt={selectedAsset.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-stone-950/80 hover:bg-stone-900 text-stone-300 hover:text-white border border-stone-700/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {selectedAsset.aircraftOrModule &&
                  !selectedAsset.aircraftOrModule.toLowerCase().includes('agnostic') && (
                    <span className="px-2.5 py-0.5 rounded bg-stone-950/90 border border-stone-700 text-xs font-mono font-semibold text-amber-300">
                      {selectedAsset.aircraftOrModule}
                    </span>
                  )}

                {selectedAsset.requirementLevel === 'required_all' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-xs uppercase">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    REQUIRED FOR ALL
                  </span>
                ) : selectedAsset.requirementLevel === 'required_core' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500 text-stone-950 font-mono font-bold text-xs uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    REQUIRED FOR CORE
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300 font-mono text-xs uppercase">
                    OPTIONAL
                  </span>
                )}

                {isCore ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs uppercase">
                    CORE ROSTER TIER
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-stone-950/90 border border-stone-700 text-stone-300 font-mono font-semibold text-xs uppercase">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    COMMUNITY TIER
                  </span>
                )}
              </div>
              <h2 className="font-display text-xl font-bold text-stone-100">
                {selectedAsset.name}
              </h2>
            </div>

            <div className="text-right font-mono text-xs text-stone-300 bg-stone-950/80 px-3 py-1.5 rounded-xl border border-stone-800">
              <div>TREE REV: {selectedAsset.version}</div>
              <div className="text-stone-400">
                {selectedAsset.fileCount ? `${selectedAsset.fileCount} files • ` : ''}
                {isExternalTool || selectedAsset.fileSizeBytes === 0
                  ? 'External Tool'
                  : formatBytes(selectedAsset.fileSizeBytes)}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Details Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {selectedAsset.previewGallery && selectedAsset.previewGallery.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
                Preview Gallery (Click to inspect fixture)
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {selectedAsset.previewGallery.map((img) => {
                  const isCurrent = previewSrc === img.url;
                  return (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setActiveImage(img.url)}
                      className={`group relative h-14 rounded-lg overflow-hidden border transition-all ${
                        isCurrent
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-stone-800 hover:border-stone-600'
                      }`}
                      title={img.label}
                    >
                      <img
                        src={img.url}
                        alt={img.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <MarkdownViewer
            content={selectedAsset.description}
            className="bg-stone-950/40 p-4 rounded-xl border border-stone-800/80"
          />

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 space-y-1">
              <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                {selectedAsset.detectionPath
                  ? 'Detection Hook / Script Path'
                  : 'Target Extraction Directory'}
              </div>
              <p className="text-xs font-mono text-stone-200 break-all">{fullTargetPath}</p>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 space-y-1">
              <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                {selectedAsset.githubRepo ? (
                  <>
                    <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                    GitHub Source Repository &amp; Tree SHA
                  </>
                ) : (
                  <>
                    <Hash className="w-3.5 h-3.5 text-amber-400" />
                    Integrity Hash
                  </>
                )}
              </div>
              {selectedAsset.githubRepo ? (
                <div className="space-y-0.5">
                  <a
                    href={selectedAsset.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-amber-400 hover:underline inline-flex items-center gap-1"
                  >
                    {selectedAsset.githubRepo} ({selectedAsset.githubBranch || 'main'})
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-[11px] font-mono text-stone-400 break-all">
                    Tree SHA: {selectedAsset.sha256}
                  </p>
                </div>
              ) : (
                <p className="text-xs font-mono text-stone-300 break-all">{selectedAsset.sha256}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-stone-400 pt-1">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stone-500" />
              Author: <strong className="text-stone-200">{selectedAsset.author}</strong>
            </span>
            <span>Last Checked: {formatShortDate(selectedAsset.updatedAt)}</span>
            <span>Asset ID: {selectedAsset.id}</span>
          </div>

          {/* Tags */}
          {selectedAsset.tags && selectedAsset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedAsset.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-xs font-mono text-stone-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Changelog */}
          {selectedAsset.changelog && selectedAsset.changelog.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-stone-400">
                Deployment Specification &amp; Sync Notes
              </h4>
              <ul className="space-y-1.5 p-3.5 rounded-xl bg-stone-950/80 border border-stone-800/90 text-xs font-mono text-stone-300">
                {selectedAsset.changelog.map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Installed File Manifest (if installed) */}
          {installed && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  INSTALLED ON DISK (Rev {installed.installedVersion})
                </span>
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-700 text-[11px] font-mono text-stone-200"
                >
                  <RefreshCw className={`w-3 h-3 ${verifying ? 'animate-spin' : ''}`} />
                  Verify Local Files
                </button>
              </div>
              {verifyStatus === 'ok' && (
                <p className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" /> All {installed.extractedFiles.length}{' '}
                  tracked file(s) verified intact in DCS Saved Games.
                </p>
              )}
              {verifyStatus === 'fail' && (
                <p className="text-xs font-mono text-amber-400">
                  One or more files were modified or removed. Click Verify &amp; Repair below.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-4 shrink-0">
          {progress ? (
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-amber-300 truncate">{progress.message}</span>
                <span className="text-stone-300 shrink-0">{progress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setActiveImage(null);
                  setSelectedAsset(null);
                }}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300"
              >
                Close
              </button>

              <div className="flex items-center gap-2.5">
                {!hasAccess ? (
                  <button
                    onClick={() => {
                      setSelectedAsset(null);
                      setLoginModalOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Sign in with Discord
                  </button>
                ) : isExternalTool ? (
                  installed ? (
                    <>
                      {selectedAsset.externalUrl && (
                        <button
                          onClick={() => openExternalUrl(selectedAsset.externalUrl!)}
                          className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-white font-mono font-semibold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Releases &amp; Documentation
                        </button>
                      )}
                      <div className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-semibold text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        External Tool Active &amp; Verified
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        if (selectedAsset.externalUrl) {
                          openExternalUrl(selectedAsset.externalUrl);
                        }
                      }}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open External Installer ({selectedAsset.name})
                    </button>
                  )
                ) : installed ? (
                  <>
                    <button
                      onClick={() => uninstallAsset(selectedAsset.id)}
                      className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-mono font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      Uninstall Asset
                    </button>
                    <button
                      onClick={() => installAsset(selectedAsset)}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5"
                    >
                      {needsUpdate ? (
                        <>
                          <ArrowUpCircle className="w-4 h-4" />
                          Update to {selectedAsset.version}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Verify &amp; Repair from GitHub
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => installAsset(selectedAsset)}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10"
                  >
                    <Download className="w-4 h-4" />
                    Deploy to DCS Saved Games
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
