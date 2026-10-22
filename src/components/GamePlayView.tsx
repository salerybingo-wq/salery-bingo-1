import React, { useState, useEffect, useRef } from 'react';
import { BingoBall, BingoCardModel, GameSettings, UserProfile } from '../types';
import { Volume2, VolumeX, Star } from 'lucide-react';
import { sounds } from '../utils/audio';
import { clearLegacyLocalRoomId } from '../utils/roomStorage';
import { GLOBAL_BINGO_ROOM_ID } from '../utils/bingoSocket';

interface GamePlayViewProps {
  user: UserProfile;
  settings: GameSettings;
  currentBall: BingoBall | null;
  calledBalls: BingoBall[];
  calledSet: Set<number>;
  cards: BingoCardModel[];
  onCellClick: (cardIndex: number, row: number, col: number) => void;
  onClaimBingo: (winningCard: BingoCardModel) => void;
  onLeave: () => void;
  onRefresh?: () => void;
  onToggleAutoDaub?: (val: boolean) => void;
  onPlayAgain?: () => void;
  autoDaubEnabled: boolean;
  gameId?: string;
  roomPlayers?: Array<{ name: string; cardsCount: number; isOnline?: boolean }>;
  status?: string;
  spectatorMode?: boolean;
  winnerInfo?: { winnerId?: string; winnerName?: string; cardId?: number; prize?: number; isMe?: boolean } | null;
}

export const GamePlayView: React.FC<GamePlayViewProps> = ({
  user,
  settings,
  currentBall,
  calledBalls,
  calledSet,
  cards,
  onCellClick,
  onClaimBingo,
  onLeave,
  onRefresh,
  onToggleAutoDaub,
  onPlayAgain,
  autoDaubEnabled,
  gameId = 'CONNECTING',
  roomPlayers = [],
  status,
  spectatorMode = false,
  winnerInfo,
}) => {
  const [muted, setMuted] = useState<boolean>(false);
  const [activeCardIdx, setActiveCardIdx] = useState<number>(0);

  useEffect(() => {
    clearLegacyLocalRoomId();
  }, []);

  // Start BGM on mount and stop on unmount cleanly
  React.useEffect(() => {
    sounds.startBGM();
    return () => {
      sounds.stopBGM();
    };
  }, []);

  const toggleSound = () => {
    const nextState = !muted;
    setMuted(nextState);
    sounds.soundEnabled = !nextState;
    sounds.voiceEnabled = !nextState;
  };

  const activeCard = cards[activeCardIdx] || cards[0];

  const participatingPlayers = roomPlayers.filter((player) => player.cardsCount > 0);
  const displayPlayersCount = participatingPlayers.length;
  const totalCardsInGame = participatingPlayers.reduce((total, player) => total + player.cardsCount, 0);
  const totalDerash = totalCardsInGame * settings.selectedStake * 0.8;

  const [gameOverCountdown, setGameOverCountdown] = useState<number>(5);
  const hasTriggeredGameOverRef = useRef(false);
  const onPlayAgainRef = useRef(onPlayAgain);
  onPlayAgainRef.current = onPlayAgain;

  // Auto redirect to game selection after 5 seconds when round concludes
  useEffect(() => {
    if (status === 'game_over' && !winnerInfo?.winnerId) {
      setGameOverCountdown(5);
      hasTriggeredGameOverRef.current = false;
      const interval = setInterval(() => {
        setGameOverCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, winnerInfo?.winnerId]);

  useEffect(() => {
    if (status === 'game_over' && !winnerInfo?.winnerId && gameOverCountdown === 0) {
      if (!hasTriggeredGameOverRef.current) {
        hasTriggeredGameOverRef.current = true;
        onPlayAgainRef.current?.();
      }
    }
  }, [status, winnerInfo?.winnerId, gameOverCountdown]);

  return (
    <div data-room-id={GLOBAL_BINGO_ROOM_ID} className="w-full max-w-[460px] mx-auto px-2 py-1.5 select-none animate-fadeIn flex flex-col justify-between min-h-[90vh]">
      <div>
        {spectatorMode && (
          <div className="mb-2 rounded-xl border border-sky-500/40 bg-sky-950/60 px-3 py-2 text-center text-xs font-bold text-sky-200">
            Spectator mode — you can watch this round, but need a cartela to play next round.
          </div>
        )}
        {/* 1. TOP HEADER BAR: 5 Stat Cards in 1 Row */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {/* Game ID */}
          <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
            <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
              Game ID
            </span>
            <span className="font-mono text-[10px] sm:text-xs font-black text-white truncate mt-0.5">
              {gameId.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {/* Players */}
          <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
            <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
              Players
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
              {totalCardsInGame}
            </span>
            <span className="text-[7px] font-bold text-slate-400 mt-0.5">
              {displayPlayersCount} active
            </span>
          </div>

          {/* Bet */}
          <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
            <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
              Bet
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
              {settings.selectedStake}
            </span>
          </div>

          {/* Derash */}
          <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
            <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
              Derash
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5 truncate">
              {totalDerash}
            </span>
          </div>

          {/* Called */}
          <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
            <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
              Called
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
              {calledSet.size}
            </span>
          </div>
        </div>



        {/* 2. MAIN BINGO ARENA (2 Columns: Left 75-Ball Board, Right Live Ball, Switch & Cartelas in same spot) */}
        <div className="grid grid-cols-12 gap-1.5 mb-2 items-stretch">
          {/* LEFT PANEL: 75-Ball Grid (5 columns: B, I, N, G, O x 15 rows) */}
          <div className="col-span-6 bg-[#1b1534] border border-[#2d2553] rounded-2xl p-1.5 shadow-2xl flex flex-col">
            {/* Header B-I-N-G-O Pills */}
            <div className="grid grid-cols-5 gap-0.5 sm:gap-1 mb-1 text-center font-black text-[11px]">
              <div className="bg-[#0284c7] text-white py-0.5 rounded">B</div>
              <div className="bg-[#2563eb] text-white py-0.5 rounded">I</div>
              <div className="bg-[#9333ea] text-white py-0.5 rounded">N</div>
              <div className="bg-[#10b981] text-white py-0.5 rounded">G</div>
              <div className="bg-[#f97316] text-white py-0.5 rounded">O</div>
            </div>

            {/* 15 Rows x 5 Columns Grid - Tight Seamless Fit */}
            <div className="grid grid-cols-5 gap-0.5 sm:gap-1 flex-1">
              {Array.from({ length: 15 }, (_, rowIdx) => {
                return (
                  <React.Fragment key={rowIdx}>
                    {[0, 1, 2, 3, 4].map((colIdx) => {
                      const num = colIdx * 15 + (rowIdx + 1);
                      const isCalled = calledSet.has(num);
                      const isLatest = currentBall?.number === num;

                      let cellBg = 'bg-[#28214a] text-white border-[#382f65]';
                      if (isLatest) {
                        cellBg = 'bg-[#facc15] text-slate-950 font-black ring-2 ring-amber-300 animate-pulse';
                      } else if (isCalled) {
                        // Called ball highlight
                        if (colIdx === 0) cellBg = 'bg-[#0284c7] text-white font-black';
                        else if (colIdx === 1) cellBg = 'bg-[#2563eb] text-white font-black';
                        else if (colIdx === 2) cellBg = 'bg-[#9333ea] text-white font-black';
                        else if (colIdx === 3) cellBg = 'bg-[#10b981] text-white font-black';
                        else cellBg = 'bg-[#f97316] text-white font-black';
                      }

                      return (
                        <div
                          key={num}
                          className={`h-5 sm:h-5.5 rounded font-mono text-[10px] sm:text-[11px] font-bold flex items-center justify-center border ${cellBg}`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL: Live Ball Announcement, Automatic Switch, & In-Place Scrollable Cartelas */}
          <div className="col-span-6 flex flex-col gap-1.5">
            {/* Top Bar: Recent Called Pills & Sound Toggle */}
            <div className="bg-[#1b1534] border border-[#2d2553] rounded-xl p-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pr-1">
                {calledBalls.slice(0, 2).map((ball, idx) => {
                  let pillColor = 'bg-[#0284c7]';
                  if (ball.letter === 'I') pillColor = 'bg-[#2563eb]';
                  if (ball.letter === 'N') pillColor = 'bg-[#9333ea]';
                  if (ball.letter === 'G') pillColor = 'bg-[#10b981]';
                  if (ball.letter === 'O') pillColor = 'bg-[#f97316]';

                  return (
                    <span
                      key={`called-ball-chip-${ball.letter}-${ball.number}-${idx}`}
                      className={`${pillColor} text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0`}
                    >
                      {ball.letter}-{ball.number}
                    </span>
                  );
                })}
              </div>

              <button
                onClick={toggleSound}
                className="text-slate-300 hover:text-white p-1 rounded-lg bg-[#251e44] hover:bg-[#2d2553] transition-colors"
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Center Big Ball Announcement Box */}
            <div className="bg-[#1b1534] border border-[#2d2553] rounded-2xl p-2.5 flex items-center justify-center shadow-2xl relative min-h-[80px]">
              {currentBall ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#facc15] border-4 border-[#120c29] shadow-[0_0_20px_rgba(250,204,21,0.5)] flex items-center justify-center transform transition-transform animate-bounce">
                  <span className="font-black font-mono text-slate-950 text-base sm:text-lg">
                    {currentBall.letter}-{currentBall.number}
                  </span>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#1e173b] border-2 border-dashed border-[#382f63] flex items-center justify-center text-slate-500 font-bold text-xs">
                  {status === 'starting' ? 'STARTING' : 'WAITING'}
                </div>
              )}
            </div>

            {/* AUTOMATIC Toggle Switch Row */}
            <div className="bg-[#1b1534] border border-[#2d2553] rounded-xl px-2.5 py-1 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider uppercase text-slate-200">
                AUTOMATIC
              </span>

              <button
                onClick={() => onToggleAutoDaub && onToggleAutoDaub(!autoDaubEnabled)}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  autoDaubEnabled ? 'bg-[#10b981]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoDaubEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* IN-PLACE CARTELAS */}
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5 max-h-[300px]">
              {cards.map((card, cIdx) => (
                  <div
                    key={card.id}
                    className="bg-[#1b1534] border border-[#2d2553] rounded-2xl p-1.5 shadow-2xl flex flex-col"
                  >
                    {/* Header B-I-N-G-O */}
                    <div className="grid grid-cols-5 gap-1 mb-1 text-center font-black text-[10px]">
                      <div className="bg-[#0284c7] text-white py-0.5 rounded">B</div>
                      <div className="bg-[#2563eb] text-white py-0.5 rounded">I</div>
                      <div className="bg-[#9333ea] text-white py-0.5 rounded">N</div>
                      <div className="bg-[#10b981] text-white py-0.5 rounded">G</div>
                      <div className="bg-[#f97316] text-white py-0.5 rounded">O</div>
                    </div>

                    {/* 5x5 Number Grid */}
                    <div className="grid grid-cols-5 gap-1">
                      {card.cells.map((row, rIdx) =>
                        row.map((cell, colIdx) => {
                          const isFree = cell.isFree;
                          const isDaubed = cell.isDaubed;

                          let cellStyle = 'bg-white text-slate-950 font-black shadow-sm';
                          if (isFree || isDaubed) {
                            cellStyle = 'bg-[#10b981] text-white font-black shadow-sm';
                          }

                          return (
                            <button
                              key={`${card.id}-${rIdx}-${colIdx}`}
                              onClick={() => onCellClick(cIdx, rIdx, colIdx)}
                              className={`h-5 sm:h-5.5 rounded font-mono text-[10px] sm:text-xs flex items-center justify-center transition-all ${cellStyle}`}
                            >
                              {isFree ? (
                                <Star className="w-3 h-3 fill-white text-white" />
                              ) : (
                                cell.number
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Card Title */}
                    <div className="text-center mt-1 flex items-center justify-center gap-1">
                      <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">
                        CARTELA #{card.id}
                      </span>
                      {card.hasWon && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[8px] uppercase animate-pulse">
                          BINGO!
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Quick Cartela Selector Pills if multiple tickets */}
        {cards.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mb-2 overflow-x-auto pb-1">
            {cards.map((c, idx) => (
              <span
                key={c.id}
                className="px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-[#1f1938] text-emerald-400 border border-[#2d2553]"
              >
                Cartela #{c.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. BOTTOM ACTION BUTTONS ROW: LEAVE | REFRESH | AUTOMATIC */}
      <div className="mt-2 space-y-2">
        {/* Instant Bingo Claim Action Banner if a card has reached winning pattern */}
        {status === 'in_progress' && cards.some((c) => c.hasWon) && (
          <button
            onClick={() => {
              const wonCard = cards.find((c) => c.hasWon) || cards[0];
              if (wonCard) onClaimBingo(wonCard);
            }}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500 hover:from-emerald-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg rounded-2xl uppercase tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.7)] border-2 border-amber-200 animate-bounce active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="text-xl">🏆</span>
            <span>ቢንጎ! BINGO! (አሸንፈዋል)</span>
            <span className="text-xl">🎉</span>
          </button>
        )}

        <div className="grid grid-cols-3 gap-2">
          {/* LEAVE Button */}
          <button
            onClick={onLeave}
            className="py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-black text-xs sm:text-sm rounded-2xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border-t border-red-300/30"
          >
            LEAVE
          </button>

          {/* REFRESH Button */}
          <button
            onClick={onRefresh || (() => {})}
            className="py-2.5 bg-[#28214a] hover:bg-[#32295d] text-white font-black text-xs sm:text-sm rounded-2xl uppercase tracking-wider shadow-lg transition-all active:scale-95 border border-[#3c336c]"
          >
            REFRESH
          </button>

          {/* AUTOMATIC Button */}
          <button
            onClick={() => onToggleAutoDaub && onToggleAutoDaub(!autoDaubEnabled)}
            className={`py-2.5 font-black text-xs sm:text-sm rounded-2xl uppercase tracking-wider shadow-lg transition-all active:scale-95 ${
              autoDaubEnabled
                ? 'bg-[#10b981] hover:bg-[#059669] text-slate-950 border-t border-emerald-300/40'
                : 'bg-[#22c55e]/30 text-slate-300 border border-[#22c55e]/40'
            }`}
          >
            AUTOMATIC
          </button>
        </div>

        {/* Game Over Banner Overlay when round finishes */}
        {status === 'game_over' && (
          <div className="bg-[#1b1534] border-2 border-amber-400/80 rounded-2xl p-3.5 shadow-2xl text-center space-y-2 animate-fadeIn">
            <div className="text-2xl animate-bounce">🏆</div>
            <h3 className="text-base font-black text-amber-400 uppercase tracking-wide">
              {winnerInfo?.isMe ? 'እንኳን ደስ አሎት! ቢንጎ አሸንፈዋል!' : 'ጨዋታው ተጠናቋል! (GAME OVER)'}
            </h3>
            <div className="bg-[#251e44] border border-[#3b3066] rounded-xl py-2 px-3">
              <p className="text-xs text-slate-300 font-bold">
                አሸናፊ: <span className="text-amber-300 font-black">{winnerInfo?.winnerName || 'ተጫዋች'}</span> (ካርቴላ #{winnerInfo?.cardId || '—'})
              </p>
              <p className="text-xs text-amber-400 font-black mt-0.5">
                ደራሽ ሽልማት: {winnerInfo?.prize || totalDerash} ETB
              </p>
            </div>
            {/* Auto redirect to game selection (5s countdown) */}
            <div className="pt-1 space-y-1">
              <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                <span>ወደ አዲስ ጨዋታ በመሄድ ላይ...</span>
                <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-mono text-[11px] font-black shadow">
                  {gameOverCountdown}s
                </span>
              </div>
              <div className="w-full bg-[#140f28] h-2 rounded-full overflow-hidden border border-[#2e2354] p-0.5">
                <div
                  className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${(gameOverCountdown / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
