import React, { useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';

export const LoginGateView: React.FC = () => {
  const { userSession, loginWithDiscordOAuth, logoutDiscord } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithDiscordOAuth();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const isGuestSession =
    userSession && (!userSession.isGuildMember || userSession.tier === 'guest');

  return (
    <div className="h-screen w-screen bg-stone-950 bg-topo flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Subtle Ambient KB Glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[320px] bg-amber-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md rounded-2xl bg-stone-900/95 backdrop-blur-md border border-stone-800 shadow-2xl overflow-hidden z-10">
        {/* Top Branding Section */}
        <div className="p-8 pb-6 text-center border-b border-stone-800/80 bg-gradient-to-b from-stone-950/60 to-transparent">
          <div className="size-48 mx-auto mb-4 rounded-2xl flex items-center justify-center">
            <img
              src={STATIC_CONFIG.logoUrl}
              alt={STATIC_CONFIG.fullName}
              className="w-full h-full object-contain"
            />
          </div>

          <h1 className="font-display font-bold tracking-tight text-2xl bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            {STATIC_CONFIG.appTitle}
          </h1>
          <div className="text-xs font-mono uppercase tracking-widest text-stone-300 mt-1">
            {STATIC_CONFIG.fullName}
          </div>
          {/* <p className="text-xs text-stone-400 mt-2">
            Membership Dossier &amp; Asset Hub
          </p> */}
        </div>

        {/* Auth Body */}
        <div className="p-7 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Authentication Failed</p>
                <p className="text-red-300/90 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Case 1: Signed in to Discord, but lacks required GTFO Server Role */}
          {isGuestSession ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Insufficient Server Clearance</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Authenticated as{' '}
                  <strong className="text-white">
                    {userSession.globalName} (@{userSession.username})
                  </strong>
                  , but your Discord account does not currently hold a verified{' '}
                  <strong className="text-amber-300">Community Member</strong> or{' '}
                  <strong className="text-amber-400">CORE Roster</strong> role in the Global Task
                  Force Overlord Discord server.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking Discord Roles...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Re-Verify Discord Roles</span>
                    </>
                  )}
                </button>

                <button
                  onClick={logoutDiscord}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-red-300 text-xs font-mono flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out / Switch Discord Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* Case 2: No cached session -> Standard Discord Sign-In Gate */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800/90 space-y-2">
                <div className="flex items-center gap-2 text-xs font-display font-semibold text-amber-400">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Member Authentication Required</span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Sign in with Discord to verify your Global Task Force Overlord membership, access
                  your Member Dossier, download ATC flight plans, and synchronize DCS liveries &amp;
                  modifications.
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-display font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Waiting for Discord Browser Sign-In...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Sign in with Discord</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-stone-950 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-500">
          <span>GTFO COMPANION APP</span>
          <span>DISCORD OAUTH2</span>
        </div>
      </div>
    </div>
  );
};
