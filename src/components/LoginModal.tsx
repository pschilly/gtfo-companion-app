import React, { useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  Shield,
  ShieldCheck,
  Sparkle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { LogoutConfirmModal } from './LogoutConfirmModal';

export const LoginModal: React.FC = () => {
  const {
    loginModalOpen,
    setLoginModalOpen,
    userSession,
    effectiveTier,
    memberProfile,
    loginWithDiscordOAuth,
    logoutDiscord,
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!loginModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLoginModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginModalOpen]);

  if (!loginModalOpen) return null;

  const handleOAuthClick = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithDiscordOAuth();
      setLoginModalOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const hasCommunityRole =
    userSession?.roleIds.includes(STATIC_CONFIG.communityRoleId) ?? false;
  const hasCoreRole = userSession?.roleIds.includes(STATIC_CONFIG.coreRoleId) ?? false;

  return (
    <div
      onClick={() => setLoginModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={STATIC_CONFIG.logoUrl}
              alt="GTFO"
              className="size-24 rounded-xl object-contain p-1"
            />
            <div>
              <h2 className="font-display text-base font-bold text-stone-100">
                {STATIC_CONFIG.appTitle}
              </h2>
              <p className="text-xs font-mono text-stone-400">
                Discord OAuth2 &amp; Member Dossier Verification
              </p>
            </div>
          </div>
          <button
            onClick={() => setLoginModalOpen(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
              <WarningCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Authentication Error</p>
                <p className="text-red-300/90 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {userSession ? (
            <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {userSession.avatarUrl && (
                    <img
                      src={userSession.avatarUrl}
                      alt={userSession.globalName}
                      className="w-11 h-11 rounded-xl border border-stone-700"
                    />
                  )}
                  <div>
                    <span className="text-[10px] font-mono uppercase text-stone-400">
                      Authenticated Pilot ({memberProfile.grade})
                    </span>
                    <h4 className="font-display text-sm font-bold text-stone-100">
                      {userSession.globalName} (@{userSession.username})
                    </h4>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
                    effectiveTier === 'core'
                      ? 'bg-amber-500 text-stone-950'
                      : effectiveTier === 'community'
                      ? 'bg-stone-800 border border-stone-700 text-stone-200'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {effectiveTier === 'core'
                    ? 'CORE ROSTER'
                    : effectiveTier === 'community'
                    ? 'COMMUNITY MEMBER'
                    : 'UNVERIFIED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-800">
                <div
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                    hasCommunityRole
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-500'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">Community Role</div>
                    <div className="text-[10px]">{hasCommunityRole ? 'VERIFIED' : 'NOT PRESENT'}</div>
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                    hasCoreRole
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-stone-900 border-stone-800 text-stone-500'
                  }`}
                >
                  <Sparkle className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-bold">CORE Roster Role</div>
                    <div className="text-[10px]">{hasCoreRole ? 'VERIFIED' : 'NOT PRESENT'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-display font-semibold text-amber-400">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Role-Based Asset Access</span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Sign in with your Discord account to verify your membership in{' '}
                  <strong className="text-stone-200">Global Task Force Overlord</strong>. Your
                  assigned server roles automatically unlock Community and CORE Roster packages.
                </p>
              </div>

              <button
                onClick={handleOAuthClick}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-display font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all"
              >
                {isLoading ? (
                  <>
                    <CircleNotch className="w-4 h-4 animate-spin" />
                    <span>Waiting for Discord Authorization...</span>
                  </>
                ) : (
                  <>
                    <ArrowSquareOut className="w-4 h-4" />
                    <span>Sign in with Discord</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
          {userSession ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleOAuthClick}
                disabled={isLoading}
                className="text-xs font-mono text-amber-400 hover:underline flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Re-verify Roles
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="text-xs font-mono text-red-400 hover:underline"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-stone-500">
              {STATIC_CONFIG.appTitle} // Discord OAuth2
            </span>
          )}
          <button
            onClick={() => setLoginModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-mono text-stone-200"
          >
            Close
          </button>
        </div>
      </div>

      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          logoutDiscord();
          setLoginModalOpen(false);
        }}
        callsign={userSession?.globalName || userSession?.username || 'Pilot'}
        avatarUrl={userSession?.avatarUrl}
      />
    </div>
  );
};
