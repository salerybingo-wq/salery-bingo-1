import React, { useState, useEffect, useRef } from 'react';
import { WinValidationResult, BingoCardModel, UserProfile } from '../types';
import { Trophy, Star, Award } from 'lucide-react';
import { generateCartelaByNumber } from '../utils/bingoLogic';

interface WinModalProps {
  user: UserProfile;
  winResult: WinValidationResult | null;
  winningCard: BingoCardModel | null;
  wonAmount: number;
  language: 'am' | 'en' | 'om';
  winnerId?: string;
  winnerName?: string;
  cardId?: number;
  isMe?: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  user,
  winResult,
  winningCard,
  wonAmount,
  winnerId,
  winnerName,
  cardId,
  isMe = true,
  onPlayAgain,
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const hasTriggeredRef = useRef(false);
  const onPlayAgainRef = useRef(onPlayAgain);
  onPlayAgainRef.current = onPlayAgain;

  // Automatically count down 5 seconds and navigate to game selection
  useEffect(() => {
    setCountdown(5);
    hasTriggeredRef.current = false;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        onPlayAgainRef.current();
      }
    }
  }, [countdown]);

  const activeWinningCard = winningCard || (cardId ? generateCartelaByNumber(cardId) : null);
  if (!activeWinningCard) return null;

  const displayWinnerName = winnerName || (isMe ? (user.firstName || user.username || 'YOU') : 'ተጫዋች');
  const displayWinnerId = winnerId || (isMe && user.telegramId ? String(user.telegramId) : '');

  const winningCoordsSet = new Set(
    (winResult?.winningCoordinates || []).map((c) => `${c.row}-${c.col}`)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#0b0817]/85 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-[340px] bg-[#140f28] border-2 border-amber-500/50 rounded-3xl p-4 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center flex flex-col justify-between overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Winner Banner */}
        <div className="space-y-1.5 mb-2.5">
          <div className="text-3xl animate-bounce">👑</div>
          <h2 className="text-2xl font-black tracking-wider uppercase flex items-center justify-center gap-1.5">
            <span>🎉</span>
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow">
              {isMe ? 'ቢንጎ አሸንፈዋል!' : 'ቢንጎ ተጠናቋል!'}
            </span>
            <span>🎉</span>
          </h2>

          {/* Prize Amount Showcase */}
          <div className="my-2 bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-500/20 border border-amber-500/50 rounded-2xl py-2 px-3 shadow-inner">
            <span className="block text-[10px] font-black uppercase text-amber-300/80 tracking-wider">
              {isMe ? 'ያሸነፉት ደራሽ ሽልማት' : 'የአሸናፊ ደራሽ ሽልማት'} (WON PRIZE)
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400 drop-shadow-md">
              {isMe ? `+${wonAmount}` : `${wonAmount}`} ETB
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full text-amber-400 text-[11px] font-black tracking-wider uppercase">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{winResult?.patternName || 'BINGO WIN!'}</span>
          </div>

          {/* Player Badge */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="bg-[#1f183d] border border-[#372b6b] px-3 py-1 rounded-xl text-center shadow-inner min-w-[100px]">
              <span className="block text-xs font-black text-amber-300 uppercase truncate">
                {displayWinnerName}
              </span>
              <span className="block text-[10px] font-mono text-slate-400 font-bold">
                ካርቴላ #{activeWinningCard.cardIndex}
                {displayWinnerId && ` • ID #${displayWinnerId.slice(-4)}`}
              </span>
            </div>
          </div>
        </div>

        {/* WINNING CARTEL VIEW Subheading */}
        <div className="mb-1.5 flex items-center justify-center gap-1 text-[10px] font-black text-amber-400 tracking-widest uppercase">
          <Award className="w-3.5 h-3.5" />
          <span>የአሸናፊ ካርቴላ እይታ</span>
        </div>

        {/* 5x5 Winning Cartel Grid */}
        <div className="bg-[#1a1433] border border-[#2e2354] rounded-2xl p-2 shadow-xl mb-3">
          {/* Header B-I-N-G-O Row */}
          <div className="grid grid-cols-5 gap-1 mb-1">
            <div className="bg-[#2563eb] text-white font-black text-xs py-0.5 rounded-lg uppercase tracking-wider text-center">
              B
            </div>
            <div className="bg-[#3b82f6] text-white font-black text-xs py-0.5 rounded-lg uppercase tracking-wider text-center">
              I
            </div>
            <div className="bg-[#a855f7] text-white font-black text-xs py-0.5 rounded-lg uppercase tracking-wider text-center">
              N
            </div>
            <div className="bg-[#10b981] text-white font-black text-xs py-0.5 rounded-lg uppercase tracking-wider text-center">
              G
            </div>
            <div className="bg-[#f97316] text-white font-black text-xs py-0.5 rounded-lg uppercase tracking-wider text-center">
              O
            </div>
          </div>

          {/* 5x5 Cells Grid */}
          <div className="grid grid-cols-5 gap-1">
            {activeWinningCard.cells.map((rowCells, rIdx) =>
              rowCells.map((cell, cIdx) => {
                const isWinCell = winningCoordsSet.has(`${rIdx}-${cIdx}`);
                const isCenter = rIdx === 2 && cIdx === 2;

                if (isCenter) {
                  return (
                    <div
                      key={`win-cell-${rIdx}-${cIdx}`}
                      className="h-6 sm:h-7 bg-[#0d9488] border border-[#14b8a6] rounded-lg flex items-center justify-center text-white shadow-sm"
                    >
                      <Star className="w-3 h-3 fill-white text-white animate-pulse" />
                    </div>
                  );
                }

                if (isWinCell) {
                  let bgStyle = 'bg-[#ea580c] border-[#f97316] text-white ring-2 ring-amber-400';
                  if (cIdx === 1 || cIdx === 3) {
                    bgStyle = 'bg-[#0d9488] border-[#14b8a6] text-white ring-2 ring-amber-400';
                  } else if (cIdx === 2) {
                    bgStyle = 'bg-[#ea580c] border-[#f97316] text-white ring-2 ring-amber-400';
                  }

                  return (
                    <div
                      key={`win-cell-${rIdx}-${cIdx}`}
                      className={`h-6 sm:h-7 ${bgStyle} border rounded-lg flex items-center justify-center font-black text-xs font-mono shadow-sm animate-pulse`}
                    >
                      {cell.number}
                    </div>
                  );
                }

                return (
                  <div
                    key={`win-cell-${rIdx}-${cIdx}`}
                    className="h-6 sm:h-7 bg-white text-[#181230] border border-slate-200 rounded-lg flex items-center justify-center font-black text-xs font-mono shadow-sm"
                  >
                    {cell.number}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 5-Second Auto Progress Bar to Game/Cartela Selection */}
        <div className="mt-1 pt-2 border-t border-[#2e2354] space-y-1.5">
          <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
            <span>ወደ ጨዋታ መምረጫ በመሄድ ላይ...</span>
            <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-mono text-[11px] font-black shadow">
              {countdown}s
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#1b1534] h-2 rounded-full overflow-hidden border border-[#2e2354] p-0.5">
            <div
              className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              style={{ width: `${(countdown / 5) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
