import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { Check, RotateCw, Link2, Trophy, Calendar, ShieldCheck, ArrowDownLeft, ArrowUpRight, Camera, X, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import { GameHistoryItem } from './HistoryView';
import { submitDepositRequest, submitWithdrawalRequest } from '../utils/api';

interface WalletViewProps {
  user: UserProfile;
  history?: GameHistoryItem[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const WalletView: React.FC<WalletViewProps> = ({
  user,
  history = [],
  onRefresh,
  isRefreshing,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'balance' | 'history'>('balance');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [depositScreenshot, setDepositScreenshot] = useState<string>('');
  const [depositRef, setDepositRef] = useState<string>('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState<number>(100);
  const [withdrawPhone, setWithdrawPhone] = useState<string>(user.phoneNumber || '');
  const [withdrawName, setWithdrawName] = useState<string>(user.firstName || '');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast('የፎቶው መጠን ከ 8MB መብለጥ የለበትም', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDepositScreenshot(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositScreenshot) {
      showToast('እባክዎ የከፈሉበትን ደረሰኝ ስክሪንሾት ያያይዙ!', 'error');
      return;
    }
    setIsSubmittingDeposit(true);
    try {
      const res = await submitDepositRequest({
        telegramId: user.telegramId,
        playerName: user.firstName || user.username || 'Player',
        playerCode: playerUniqueId,
        phoneNumber: user.phoneNumber,
        amount: Number(depositAmount),
        reference: depositRef || 'Telebirr Transfer',
        screenshotUrl: depositScreenshot,
      });
      if (res.ok) {
        showToast('🎉 የዲፖዚት ጥያቄዎ ከደረሰኝ ጋር ተልኳል! አድሚኑ እንደተመለከተው ወዲያውኑ ይጸድቃል።', 'success');
        setShowDepositModal(false);
        setDepositScreenshot('');
        setDepositRef('');
        if (onRefresh) onRefresh();
      } else {
        showToast('ጥያቄውን መላክ አልተቻለም፣ እባክዎ እንደገና ይሞክሩ', 'error');
      }
    } catch {
      showToast('ስህተት ተፈጥሯል፣ እባክዎ እንደገና ይሞክሩ', 'error');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  const handleSubmitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentBalance = user.mainWallet ?? user.balance;
    if (Number(withdrawAmount) < 50) {
      showToast('ዝቅተኛው የማውጣት መጠን 50 ETB ነው!', 'error');
      return;
    }
    if (Number(withdrawAmount) > currentBalance) {
      showToast('በቂ ቀሪ ሒሳብ የለዎትም!', 'error');
      return;
    }
    if (!withdrawPhone.trim()) {
      showToast('እባክዎ የ Telebirr ስልክ ቁጥርዎን ያስገቡ!', 'error');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const res = await submitWithdrawalRequest({
        telegramId: user.telegramId,
        playerName: user.firstName || user.username || 'Player',
        playerCode: playerUniqueId,
        phoneNumber: withdrawPhone.trim(),
        amount: Number(withdrawAmount),
        paymentMethod: 'Telebirr',
        recipientName: withdrawName.trim() || undefined,
      });
      if (res.ok) {
        showToast('🎉 የገንዘብ ማውጣት ጥያቄዎ ተልኳል! አድሚኑ አይቶ ወዲያውኑ ወደ Telebirr ቁጥርዎ ይልካል።', 'success');
        setShowWithdrawModal(false);
        if (onRefresh) onRefresh();
      } else {
        showToast('ጥያቄውን መላክ አልተቻለም፣ እባክዎ እንደገና ይሞክሩ', 'error');
      }
    } catch {
      showToast('ስህተት ተፈጥሯል፣ እባክዎ እንደገና ይሞክሩ', 'error');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const playerUniqueId = user.playerCode || ('SB-' + (((Math.abs(Number(user.telegramId)) * 17) % 90000) + 10000));
  const userHandle = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : `@player_${String(user.telegramId).slice(-4)}`;

  return (
    <div className="min-h-full pb-20 select-none animate-fadeIn bg-gradient-to-b from-[#2e1058] via-[#1b0c38] to-[#0e0622]">
      {/* Toast Alert */}
      {toastMsg && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold border transition-all animate-bounce ${
          toastMsg.type === 'error' ? 'bg-rose-950 border-rose-500 text-rose-200' : 'bg-emerald-950 border-emerald-500 text-emerald-200'
        }`}>
          {toastMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white tracking-tight">
          Wallet (ዋሌት)
        </h1>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white rounded-full transition-all active:scale-95 disabled:opacity-50"
            title="Refresh balance"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#38bdf8]' : ''}`} />
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* Verified User Identification Card with distinct ID */}
        <div className="bg-[#241747]/90 border border-[#37236a] rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3b2575] to-[#5b3da8] flex items-center justify-center text-white font-black text-sm shadow">
              {(user.firstName || user.username || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">{user.firstName || 'Player'}</span>
                <span className="text-xs text-sky-400 font-mono font-semibold">{userHandle}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                <span>መለያ ID: {playerUniqueId}</span>
                <span className="text-slate-400">· ID: {String(user.telegramId).slice(-4)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0c3c2b] text-[#10b981] border border-[#10b981]/30 text-xs font-bold">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Verified</span>
          </div>
        </div>

        {/* Balance vs History Sub-Tabs Segmented Bar */}
        <div className="bg-[#180f2d] p-1 rounded-2xl flex border border-[#2d1b54]">
          <button
            onClick={() => setActiveSubTab('balance')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'balance'
                ? 'bg-[#291b4f] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Balance (ቀሪ ሒሳብ)
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'history'
                ? 'bg-[#291b4f] text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History (እንቅስቃሴ)
          </button>
        </div>

        {activeSubTab === 'balance' ? (
          <div className="space-y-3">
            {/* Main Wallet Card */}
            <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex items-center justify-between shadow-md">
              <span className="text-sm font-semibold text-slate-300">
                Main Wallet (ዋና ሒሳብ)
              </span>
              <span className="text-2xl font-black text-white font-mono">
                {(user.mainWallet ?? user.balance).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
              </span>
            </div>

            {/* Play Wallet Card */}
            <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2 text-slate-300">
                <Link2 className="w-4 h-4 text-emerald-400 rotate-45" />
                <span className="text-sm font-semibold">Play Wallet (የቦነስ ሒሳብ)</span>
              </div>
              <span className="text-2xl font-black text-[#10b981] font-mono">
                {(user.playWallet ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ETB</span>
              </span>
            </div>

            {/* Direct Deposit & Withdrawal Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDepositModal(true)}
                className="py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-95 border border-emerald-400/40"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>ገንዘብ አስገባ (Deposit)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                className="py-3 px-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs rounded-2xl shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all active:scale-95 border border-rose-400/40"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>ገንዘብ አውጣ (Withdraw)</span>
              </button>
            </div>

            {/* Security Notice Card */}
            <div className="pt-2 space-y-2.5">
              <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-4 text-center space-y-2.5 shadow-md">
                <div className="w-10 h-10 rounded-full bg-[#271549] text-emerald-400 flex items-center justify-center mx-auto text-lg font-bold shadow-inner">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-xs font-bold text-white">
                  ደህንነቱ የተጠበቀ የ Telebirr እና CBE ዝውውር
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  ያስገቡት ደረሰኝ እና ያወጡት ገንዘብ በቀጥታ በአድሚኑ ተረጋግጦ በቅጽበት ይፈጸማል።
                </p>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="mt-1 w-full py-2 bg-[#281850] hover:bg-[#342066] text-[#38bdf8] text-xs font-bold rounded-xl border border-[#3b2474] flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>ሒሳብ ያድሱ (Sync Balance)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Transaction and Game Winnings history subtab */
          <div className="space-y-2.5 py-1">
            {history.length === 0 ? (
              <div className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-6 text-center text-slate-400 text-xs space-y-2">
                <div className="text-2xl">📋</div>
                <p className="font-bold text-white">እስካሁን ምንም የገንዘብ እንቅስቃሴ የለም</p>
                <p className="text-slate-400">ሲጫወቱና ሲያሸንፉ ያገኙት ደራሽ ሽልማት እና የገንዘብ እንቅስቃሴዎች እዚህ ይቀመጣሉ።</p>
              </div>
            ) : (
              history.map((item, idx) => {
                const isWon = item.result === 'won';
                const prize = item.totalPrize || (isWon ? item.wonAmount : Math.floor(Math.max(item.cardsCount + 1, 2) * item.stake * 0.8));
                const dateStr = new Date(item.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <div
                    key={item.id || idx}
                    className="bg-[#1c1236] border border-[#2f1c5c] rounded-2xl p-3.5 flex items-center justify-between shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          isWon ? 'bg-[#144434] text-emerald-300' : 'bg-[#401f3f] text-slate-400'
                        }`}
                      >
                        {isWon ? <Trophy className="w-4 h-4 text-emerald-400" /> : '🎮'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{isWon ? 'የቢንጎ ደራሽ ድል (Bingo Won)' : 'የጨዋታ ተሳትፎ (Round Played)'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                          <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{dateStr}</span>
                          <span>· Stake: {item.stake} ETB</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-black font-mono ${isWon ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {isWon ? `+${item.wonAmount} ETB` : `ደራሽ: ${prize} ETB`}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isWon ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {isWon ? 'የተከፈለ' : 'ተጠናቋል'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
