import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Ban, ShieldAlert, RefreshCw, MessageCircle, AlertTriangle } from 'lucide-react';

interface BannedUserViewProps {
  user: UserProfile;
  onRefresh: () => Promise<void> | void;
}

export const BannedUserView: React.FC<BannedUserViewProps> = ({ user, onRefresh }) => {
  const [checking, setChecking] = useState(false);

  const handleRefreshClick = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  const banReason = user.ban_reason || 'የአገልግሎት ደንብ መጣስ (Terms of Service Violation)';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e1621] via-[#17212b] to-[#0e1621] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white font-sans">
      <div className="max-w-md w-full bg-[#17212b] border border-rose-600/40 rounded-3xl p-6 shadow-2xl space-y-5 text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-[#229ED9]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Ban Badge Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-rose-950/60 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-950">
          <Ban className="w-10 h-10 text-rose-400 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-[#17212b] flex items-center justify-center">
            <span className="text-[10px] font-black text-white">!</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider bg-rose-600/20 text-rose-400 border border-rose-500/40 uppercase">
            መለያዎ ታግዷል (Account Suspended)
          </span>
          <h1 className="text-xl font-black text-white pt-2">
            የጨዋታ አገልግሎት ተቋርጧል
          </h1>
          <p className="text-xs text-[#708499]">
            ይህ መለያ በአድሚን ውሳኔ ለጊዜው ከአገልግሎት ውጭ ተደርጓል።
          </p>
        </div>

        {/* Ban Reason Box */}
        <div className="bg-[#0e1621] border border-rose-700/40 rounded-2xl p-4 text-left space-y-1.5 shadow-inner">
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>የእገዳ ምክንያት (Suspension Reason)፦</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 pl-5">
            {banReason}
          </p>
        </div>

        {/* User Info Details */}
        <div className="bg-[#242f3d]/60 border border-[#2b5278]/40 rounded-2xl p-3 text-xs space-y-1.5">
          <div className="flex justify-between items-center text-[#708499]">
            <span>ተጠቃሚ፦</span>
            <span className="text-white font-bold">{user.firstName || 'Player'}</span>
          </div>
          <div className="flex justify-between items-center text-[#708499]">
            <span>Player Code፦</span>
            <span className="text-[#54a9eb] font-mono font-bold">{user.playerCode || 'SB0000'}</span>
          </div>
          <div className="flex justify-between items-center text-[#708499]">
            <span>Player ID፦</span>
            <span className="text-slate-300 font-mono">{String(user.telegramId).slice(-4)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {/* Refresh Status Button */}
          <button
            onClick={handleRefreshClick}
            disabled={checking}
            className="w-full py-3 bg-[#242f3d] hover:bg-[#2b5278] text-[#54a9eb] border border-[#2b5278]/60 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin text-[#229ED9]' : ''}`} />
            <span>{checking ? 'ሁኔታው እየተፈተሸ ነው...' : 'የእገዳ ሁኔታን እንደገና ፈትሽ (Refresh Status)'}</span>
          </button>

          {/* Contact Admin */}
          <a
            href="https://t.me/salery_admin"
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 bg-gradient-to-r from-[#2481cc] to-[#229ED9] hover:from-[#229ED9] hover:to-[#54a9eb] text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#2481cc]/25 transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>አድሚንን በቴሌግራም አነጋግር (@salery_admin)</span>
          </a>
        </div>

        <p className="text-[10px] text-[#708499] italic">
          ዕገዳው በስህተት እንደሆነ ካሰቡ እባክዎ ከላይ ያለውን አዝራር ተጭነው አድሚንን ያነጋግሩ።
        </p>
      </div>
    </div>
  );
};
