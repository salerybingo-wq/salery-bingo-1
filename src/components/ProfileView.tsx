import React from 'react';
import { UserProfile, GameSettings } from '../types';
import { Wallet, Trophy, Users, TrendingUp, Volume2, VolumeX, Globe, ShieldCheck, ChevronRight, Share2 } from 'lucide-react';
import { sounds } from '../utils/audio';

interface ProfileViewProps {
  user: UserProfile;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onRefreshBalance?: () => void;
  isRefreshingBalance?: boolean;
  onOpenAdminPanel?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  settings,
  onUpdateSettings,
  onOpenAdminPanel,
}) => {
  const isAdmin =
    String(user.telegramId) === '5873620165' ||
    String(user.telegramId) === '908336796' ||
    user.role === 'admin';
  const rawDisplayName = user.firstName || user.username || 'Player';
  const initial = rawDisplayName.charAt(0).toUpperCase();
  const displayName = user.firstName ? user.firstName : (user.username ? `@${user.username}` : 'Player');
  const userHandle = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@player_${String(user.telegramId).slice(-4)}`;
  const playerUniqueId = user.playerCode || ('SB-' + (((Math.abs(Number(user.telegramId)) * 17) % 90000) + 10000));
  const [copiedId, setCopiedId] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [shareError, setShareError] = React.useState('');

  const handleCopyId = () => {
    navigator.clipboard.writeText(playerUniqueId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleShare = async () => {
    setIsSharing(true);
    setShareError('');
    try {
      const shareData = {
        title: 'Salery Bingo',
        text: 'Join me for a game of Salery Bingo!',
        url: window.location.href,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      } else {
        throw new Error('Sharing is not available in this browser');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Could not share the game link:', error);
        setShareError('Could not share the game link. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Language cycle: am -> om -> en -> am
  const handleToggleLanguage = () => {
    let nextLang: 'am' | 'om' | 'en' = 'am';
    if (settings.language === 'am') nextLang = 'om';
    else if (settings.language === 'om') nextLang = 'en';
    else nextLang = 'am';

    onUpdateSettings({ language: nextLang });
    if (settings.soundEnabled) {
      sounds.playBeep();
    }
  };

  const getLanguageLabel = () => {
    if (settings.language === 'am') return 'አማርኛ';
    if (settings.language === 'om') return 'Afaan Oromoo';
    return 'English';
  };

  // Sound toggle handler with real immediate sound engine update and test beep
  const handleToggleSound = () => {
    const nextSoundState = !settings.soundEnabled;
    sounds.soundEnabled = nextSoundState;
    sounds.voiceEnabled = nextSoundState;
    onUpdateSettings({
      soundEnabled: nextSoundState,
      voiceEnabled: nextSoundState,
    });

    if (nextSoundState) {
      sounds.playDaub();
    }
  };

  return (
    <div className="min-h-full pb-20 select-none animate-fadeIn bg-gradient-to-b from-[#2e1058] via-[#1b0c38] to-[#0e0622]">
      {/* Top Profile Header with large circle avatar, username, and distinct ID */}
      <div className="pt-6 pb-4 flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#3b2575] to-[#5b3da8] border-2 border-purple-400/50 flex items-center justify-center text-white text-2xl font-black shadow-xl">
          {initial}
        </div>
        <h1 className="mt-2.5 text-xl font-black text-white tracking-wide">
          {displayName}
        </h1>

        {/* Local Player Username Badge */}
        <div className="mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#1e293b]/80 border border-[#38bdf8]/40 shadow-sm">
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Player</span>
          <span className="text-xs text-sky-300 font-mono font-bold">{userHandle}</span>
        </div>

        {/* Unique Player Personal ID Badge */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleCopyId}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#281a4e] hover:bg-[#342266] border border-amber-500/40 text-amber-300 text-xs font-mono font-black shadow transition-all active:scale-95 cursor-pointer"
            title="የተጫዋች መለያ ኮድ (Click to copy)"
          >
            <span>መለያ ID:</span>
            <span className="text-white font-bold">{playerUniqueId}</span>
            <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-400">
              {copiedId ? '✓ Copied' : 'Copy'}
            </span>
          </button>

          <span className="text-[11px] text-slate-400 font-mono">
            ID: {String(user.telegramId).slice(-4)}
          </span>
        </div>

        {user.phoneNumber && (
          <span className="text-xs text-slate-400 font-mono mt-1">
            📱 {user.phoneNumber}
          </span>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* 2x2 Grid of cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Main Wallet */}
          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex flex-col justify-between shadow-md h-24">
            <div className="flex items-center gap-2 text-slate-300">
              <Wallet className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-semibold">Main Wallet</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {(user.mainWallet ?? user.balance).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
            </div>
          </div>

          {/* Card 2: Play Wallet */}
          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex flex-col justify-between shadow-md h-24">
            <div className="flex items-center gap-2 text-slate-300">
              <Wallet className="w-4 h-4 text-[#10b981]" />
              <span className="text-xs font-semibold">Play Wallet</span>
            </div>
            <div className="text-2xl font-black text-[#10b981] font-mono">
              {(user.playWallet ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
            </div>
          </div>

          {/* Card 3: Games Won */}
          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex flex-col justify-between shadow-md h-24">
            <div className="flex items-center gap-2 text-slate-300">
              <Trophy className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold">Games Won (ድሎች)</span>
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">
              {user.totalWins || 0}
            </div>
          </div>

          {/* Card 4: Total Games Played */}
          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex flex-col justify-between shadow-md h-24">
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold">Total Games (ተጫወቱ)</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {user.totalGames || 0}
            </div>
          </div>
        </div>

        {/* Card 5: Total Earning / ደራሽ ያገኙት (Full Width) */}
        <div className="bg-gradient-to-r from-[#211442] via-[#2a1754] to-[#211442] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-md h-24">
          <div className="flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">Total Earning (ያሸነፉት ጠቅላላ ደራሽ)</span>
            </div>
            <span className="text-[10px] text-amber-400/80 font-mono font-bold">ETB</span>
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono drop-shadow">
            {(user.totalWonAmount || 0).toLocaleString()} ETB
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-[#1c1236] p-4 shadow-md">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <Share2 className="h-4 w-4" />
            {isSharing ? 'Sharing...' : 'Share game'}
          </button>
          {shareError && <p className="mt-2 text-center text-xs text-rose-300">{shareError}</p>}
        </div>

        {/* Settings Section: Clean & Focused (Only Language & Sound) */}
        <div className="pt-1">
          <h2 className="text-base font-bold text-white tracking-wide mb-3">
            Settings (ቅንብሮች)
          </h2>

          <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl divide-y divide-[#2a1854] overflow-hidden shadow-md">
            {/* 1. Language switch (አማርኛ / Afaan Oromoo / English) */}
            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-amber-400" />
                Language (ቋንቋ / Afaan)
              </span>
              <button
                onClick={handleToggleLanguage}
                className="px-3 py-1.5 bg-[#281850] hover:bg-[#342066] text-amber-300 text-xs font-bold rounded-xl border border-[#3b2474] active:scale-95 transition-all shadow-sm"
              >
                {getLanguageLabel()}
              </button>
            </div>

            {/* 2. Sound Effects Toggle */}
            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-2.5">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                Sound Effects (ድምፅ / Sagalee)
              </span>
              <button
                onClick={handleToggleSound}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  settings.soundEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Admin Panel Quick Access */}
        {isAdmin && onOpenAdminPanel && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="w-full p-3.5 bg-gradient-to-r from-[#174677] to-[#123862] hover:from-[#1d528b] hover:to-[#174677] border-2 border-[#388de0]/80 rounded-2xl flex items-center justify-between text-white shadow-lg active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2481cc] to-[#229ED9] flex items-center justify-center text-white shadow-md shadow-[#2481cc]/40 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black flex items-center gap-1.5">
                    <span>አድሚን ፓነል (Admin Panel)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#229ED9] text-white font-mono font-bold">
                      /admin
                    </span>
                  </div>
                  <div className="text-[11px] text-[#b4d9ff]">የተጫዋቾች፣ የዲፖዚት፣ የዊዝድሮዋል እና የቦት መቆጣጠሪያ</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#7cc4ff] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
