import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GameSettings, UserProfile, BingoCardModel } from '../types';
import { generateCartelaByNumber, getGlobalBingoCycle, GLOBAL_SELECTION_WINDOW_MS } from '../utils/bingoLogic';
import { ArrowLeft, RotateCw, Star, ChevronDown } from 'lucide-react';
import { sounds } from '../utils/audio';

interface CartelaSelectionViewProps {
  user: UserProfile;
  settings: GameSettings;
  onBack: () => void;
  onConfirmSelection: (
    selectedCards: BingoCardModel[],
    walletType?: 'main_wallet' | 'play_wallet'
  ) => boolean | Promise<boolean>;
  onUpdateSettings?: (newSettings: Partial<GameSettings>) => void;
  socket?: any;
  roomStartsAt?: number;
}

const TOTAL_CARTELAS = 400; // 1 to 400 tickets, 8 columns

const PLAYER_NAMES = [
  'Abebe B.', 'Tigist K.', 'Dawit M.', 'Helen G.', 'Solomon T.',
  'Bethel A.', 'Natnael Z.', 'Yonas E.', 'Kidus H.', 'Selam W.',
  'Marta D.', 'Biruk T.', 'Samrawit L.', 'Ermias F.', 'Liya S.',
  'Kalkidan N.', 'Henok A.', 'Tsion M.', 'Robel K.', 'Hanna B.'
];

export const CartelaSelectionView: React.FC<CartelaSelectionViewProps> = ({
  user,
  settings,
  onBack,
  onConfirmSelection,
  socket,
  roomStartsAt,
}) => {
  // Synchronized server timestamp target (strictly 35s global cycle)
  const [serverStartsAt, setServerStartsAt] = useState<number>(() => {
    if (typeof roomStartsAt === 'number' && roomStartsAt > Date.now()) {
      return roomStartsAt;
    }
    const cycle = getGlobalBingoCycle();
    return cycle.selectionEndsAt;
  });

  const serverClockOffsetRef = React.useRef(0);
  const computeRemaining = useCallback((targetTs: number) => {
    if (!targetTs) return 35;
    return Math.max(0, Math.ceil((targetTs - (Date.now() + serverClockOffsetRef.current)) / 1000));
  }, []);

  // Sync with roomStartsAt whenever the parent passes an updated timestamp
  useEffect(() => {
    if (typeof roomStartsAt === 'number' && roomStartsAt > Date.now() + serverClockOffsetRef.current) {
      setServerStartsAt(roomStartsAt);
      setTimeLeft(computeRemaining(roomStartsAt));
    }
  }, [roomStartsAt, computeRemaining]);

  // Countdown timer derived from server room timestamp
  const [timeLeft, setTimeLeft] = useState<number>(() => computeRemaining(serverStartsAt));
  const hasStartedRef = React.useRef<boolean>(false);
  const localEmptyResetStartsAtRef = React.useRef(0);

  // Taken cartelas by other active players (cartelaId -> username)
  const [remoteClaims, setRemoteClaims] = useState<Map<number, string>>(() => new Map<number, string>());
  const reservationRequestIdRef = React.useRef(0);

  // User selected cartela IDs (starts fresh each game)
  const [selectedCartelaIds, setSelectedCartelaIds] = useState<number[]>([]);
  const selectedCartelaIdsRef = React.useRef(selectedCartelaIds);
  selectedCartelaIdsRef.current = selectedCartelaIds;

  // Auto-select Play Wallet if bonus available, otherwise Main Wallet
  const mainWalletBalance = user.mainWallet ?? user.balance;
  const playWalletBalance = user.playWallet ?? 0;
  const [walletType, setWalletType] = useState<'main_wallet' | 'play_wallet'>(() => {
    return (user.playWallet ?? 0) >= settings.selectedStake ? 'play_wallet' : 'main_wallet';
  });

  // Automatically transition to Main Wallet when Play Wallet is depleted
  useEffect(() => {
    if (walletType === 'play_wallet' && playWalletBalance < settings.selectedStake) {
      setWalletType('main_wallet');
    }
  }, [playWalletBalance, settings.selectedStake, walletType]);

  // Currently previewed cartela ID (single tap preview when none selected)
  const [previewCartelaId, setPreviewCartelaId] = useState<number | null>(null);
  const previewCartelaIdRef = React.useRef<number | null>(null);
  previewCartelaIdRef.current = previewCartelaId;

  const selectedCount = selectedCartelaIds.length;
  const currentTotalStake = selectedCount * settings.selectedStake;
  const selectedWalletBalance = walletType === 'main_wallet' ? mainWalletBalance : playWalletBalance;
  const affordableTicketCount = Math.max(0, Math.floor(selectedWalletBalance / Math.max(settings.selectedStake, 1)));

  // Real-time Socket.io Cartela Reservation Sync across all players in room
  useEffect(() => {
    if (!socket) {
      // Fallback bot simulation if offline/not socket-connected
      const map = new Map<number, string>();
      const count = 10 + Math.floor(Math.random() * 12);
      const used = new Set<number>();
      for (let i = 0; i < count; i++) {
        const cid = 1 + Math.floor(Math.random() * TOTAL_CARTELAS);
        if (!used.has(cid)) {
          used.add(cid);
          const name = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
          map.set(cid, name);
        }
      }
      setRemoteClaims(map);

      const interval = setInterval(() => {
        setRemoteClaims((prev) => {
          const next = new Map(prev);
          if (next.size < 45) {
            const cid = 1 + Math.floor(Math.random() * TOTAL_CARTELAS);
            if (!next.has(cid) && !selectedCartelaIdsRef.current.includes(cid)) {
              const name = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
              next.set(cid, name);
            }
          }
          return next;
        });
      }, 4000);

      return () => clearInterval(interval);
    }

    const syncRoom = () => {
      socket.emit('cartela:room_enter', { stake: settings.selectedStake }, (res: any) => {
        if (res && res.ok && res.state) {
          if (typeof res.state.serverNow === 'number') {
            serverClockOffsetRef.current = res.state.serverNow - Date.now();
          }
          if (typeof res.state.startsAt === 'number' && res.state.status === 'waiting') {
            setServerStartsAt(res.state.startsAt);
            setTimeLeft(computeRemaining(res.state.startsAt));
            localEmptyResetStartsAtRef.current = 0;
          }
        }
      });
    };

    if (socket.connected) {
      syncRoom();
    }
    socket.on('connect', syncRoom);

    const handleReservedList = (data: {
      takenCartelas: Record<number, string>;
    }) => {
      if (data && data.takenCartelas) {
        const claimsMap = new Map<number, string>();
        for (const [cidStr, username] of Object.entries(data.takenCartelas)) {
          const cid = Number(cidStr);
          // If taken by another player, add to remoteClaims
          if (!selectedCartelaIdsRef.current.includes(cid)) {
            claimsMap.set(cid, username || 'Player');
          }
        }
        setRemoteClaims(claimsMap);
      }
    };

    const handleRoomState = (data: any) => {
      if (data) {
        if (typeof data.startsAt === 'number' && data.status === 'waiting') {
          if (typeof data.serverNow === 'number') {
            serverClockOffsetRef.current = data.serverNow - Date.now();
          }
          if (data.startsAt < localEmptyResetStartsAtRef.current) return;
          localEmptyResetStartsAtRef.current = 0;
          setServerStartsAt(data.startsAt);
          setTimeLeft(computeRemaining(data.startsAt));
          hasStartedRef.current = false;
        }
      }
    };

    const handleRoomTick = (data: { startsAt?: number; serverNow?: number; secondsRemaining?: number; status?: string }) => {
      if (typeof data?.serverNow === 'number') {
        serverClockOffsetRef.current = data.serverNow - Date.now();
      }
      if (
        typeof data?.startsAt === 'number' &&
        data.startsAt < localEmptyResetStartsAtRef.current
      ) {
        return;
      }
      if (typeof data?.startsAt === 'number') {
        localEmptyResetStartsAtRef.current = 0;
        setServerStartsAt(data.startsAt);
      }
      if (typeof data?.secondsRemaining === 'number') {
        setTimeLeft(Math.max(0, data.secondsRemaining));
      }
      if (data?.status === 'waiting' && (data.secondsRemaining || 0) > 0) {
        hasStartedRef.current = false;
      }
    };

    socket.on('cartela:reserved_list', handleReservedList);
    socket.on('room:selection_state', handleRoomState);
    socket.on('room:tick', handleRoomTick);

    return () => {
      socket.off('connect', syncRoom);
      socket.off('cartela:reserved_list', handleReservedList);
      socket.off('room:selection_state', handleRoomState);
      socket.off('room:tick', handleRoomTick);
      socket.emit('cartela:release', { stake: settings.selectedStake });
    };
  }, [socket, settings.selectedStake]);

  // Broadcast user selections to server via Socket
  const broadcastMySelection = (ids: number[]) => {
    if (socket?.connected) {
      const requestId = ++reservationRequestIdRef.current;
      socket.emit('cartela:reserve', {
        stake: settings.selectedStake,
        cardIds: ids,
      }, (result: { ok?: boolean; acceptedIds?: number[]; rejectedIds?: number[] }) => {
        if (requestId !== reservationRequestIdRef.current || !result?.ok || !result.rejectedIds?.length) return;
        const acceptedIds = result.acceptedIds || [];
        selectedCartelaIdsRef.current = acceptedIds;
        setSelectedCartelaIds(acceptedIds);
        setPreviewCartelaId(acceptedIds[acceptedIds.length - 1] ?? null);
        sounds.playBeep(false);
      });
    }
  };

  // Determine which cartela IDs to render in the bottom view:
  const activeDisplayIds = useMemo(() => {
    if (selectedCartelaIds.length > 0) {
      return selectedCartelaIds;
    }
    if (previewCartelaId !== null) {
      return [previewCartelaId];
    }
    return [];
  }, [selectedCartelaIds, previewCartelaId]);

  // Generate card models for all displayed cartelas
  const activeCards = useMemo(() => {
    return activeDisplayIds.map((id) => ({
      id,
      card: generateCartelaByNumber(id),
    }));
  }, [activeDisplayIds]);

  const handleJoinGame = useCallback(async () => {
    const effectiveIds = [...selectedCartelaIdsRef.current];
    if (effectiveIds.length === 0) return;
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let activeW = walletType;
    if (activeW === 'play_wallet' && playWalletBalance < settings.selectedStake) {
      activeW = 'main_wallet';
    }
    const currentBal = activeW === 'main_wallet' ? mainWalletBalance : playWalletBalance;
    const affordable = Math.max(0, Math.floor(currentBal / Math.max(settings.selectedStake, 1)));

    if (affordable <= 0 && currentBal < settings.selectedStake) {
      sounds.playBeep(false);
      hasStartedRef.current = false;
      return;
    }

    const finalCards = effectiveIds.map((id) => generateCartelaByNumber(id));

    try {
      const joined = await onConfirmSelection(finalCards, activeW);
      if (!joined) {
        hasStartedRef.current = false;
      }
    } catch {
      hasStartedRef.current = false;
    }
  }, [
    walletType,
    playWalletBalance,
    mainWalletBalance,
    settings.selectedStake,
    remoteClaims.size,
    onConfirmSelection,
  ]);

  // Join automatically at expiry only when the player has selected cartelas.
  useEffect(() => {
    const timer = setInterval(() => {
      let target = serverStartsAt;
      if (typeof roomStartsAt === 'number' && roomStartsAt > Date.now() + serverClockOffsetRef.current) {
        target = roomStartsAt;
      } else if (!target) {
        const cycle = getGlobalBingoCycle(Date.now() + serverClockOffsetRef.current);
        target = cycle.selectionEndsAt;
        setServerStartsAt(target);
      }

      const remaining = Math.min(35, computeRemaining(target));
      const hasSelections = selectedCartelaIdsRef.current.length > 0;
      setTimeLeft(remaining);
      if (remaining === 0 && selectedCartelaIdsRef.current.length > 0) {
        void handleJoinGame();
      } else if (remaining === 0 && !socket?.connected && localEmptyResetStartsAtRef.current === 0) {
        const nextStartsAt = Date.now() + serverClockOffsetRef.current + GLOBAL_SELECTION_WINDOW_MS;
        localEmptyResetStartsAtRef.current = nextStartsAt;
        setServerStartsAt(nextStartsAt);
        setTimeLeft(Math.ceil(GLOBAL_SELECTION_WINDOW_MS / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [serverStartsAt, roomStartsAt, handleJoinGame, socket?.connected, computeRemaining]);

  // Handle cartel cell click
  const handleCartelaClick = (cartelaNum: number) => {
    sounds.playDaub();

    const isTakenByOther = remoteClaims.has(cartelaNum);
    const isSelected = selectedCartelaIds.includes(cartelaNum);

    const totalAvail = mainWalletBalance + playWalletBalance;
    if (totalAvail < settings.selectedStake) {
      sounds.playBeep(false);
      return;
    }

    let activeW = walletType;
    if (activeW === 'play_wallet' && playWalletBalance < settings.selectedStake) {
      activeW = 'main_wallet';
      setWalletType('main_wallet');
    }

    const currentBal = activeW === 'main_wallet' ? mainWalletBalance : playWalletBalance;
    const affordable = Math.max(0, Math.floor(currentBal / Math.max(settings.selectedStake, 1)));

    if (affordable <= 0) {
      sounds.playBeep(false);
      return;
    }

    setPreviewCartelaId(cartelaNum);

    if (!isSelected && selectedCartelaIds.length >= affordable) {
      if (activeW === 'play_wallet' && mainWalletBalance >= settings.selectedStake) {
        setWalletType('main_wallet');
      } else {
        sounds.playBeep(false);
        return;
      }
    }

    let updatedIds: number[] = [];
    if (isSelected) {
      // Toggle off
      updatedIds = selectedCartelaIds.filter((id) => id !== cartelaNum);
    } else {
      const maxSelectable = Math.max(1, Math.min(settings.cardsCount, affordable));
      if (selectedCartelaIds.length < maxSelectable) {
        updatedIds = [...selectedCartelaIds, cartelaNum];
      } else {
        updatedIds = [...selectedCartelaIds.slice(1), cartelaNum];
      }
    }

    setSelectedCartelaIds(updatedIds);
    selectedCartelaIdsRef.current = updatedIds;
    broadcastMySelection(updatedIds);
  };

  const handleRefresh = () => {
    sounds.playBeep(false);
    if (socket) {
      socket.emit('cartela:room_enter', { stake: settings.selectedStake }, (res: any) => {
        if (res && res.ok && res.state && typeof res.state.startsAt === 'number') {
          setServerStartsAt(res.state.startsAt);
          setTimeLeft(computeRemaining(res.state.startsAt));
        }
      });
    } else {
      const map = new Map<number, string>();
      const count = 10 + Math.floor(Math.random() * 12);
      const used = new Set<number>();
      for (let i = 0; i < count; i++) {
        const cid = 1 + Math.floor(Math.random() * TOTAL_CARTELAS);
        if (!used.has(cid) && !selectedCartelaIds.includes(cid)) {
          used.add(cid);
          const name = PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
          map.set(cid, name);
        }
      }
      setRemoteClaims(map);
    }
  };

  const displayedMainWallet = Math.max(0, mainWalletBalance - (walletType === 'main_wallet' ? currentTotalStake : 0));
  const displayedPlayWallet = Math.max(0, playWalletBalance - (walletType === 'play_wallet' ? currentTotalStake : 0));

  return (
    <div className="w-full max-w-[440px] mx-auto px-2.5 py-1.5 select-none animate-fadeIn flex flex-col justify-start">
      {/* Top Header Buttons: Back and Refresh */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#251f44] hover:bg-[#2f2756] text-slate-200 border border-[#3c336c] rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#251f44] hover:bg-[#2f2756] text-slate-200 border border-[#3c336c] rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>



      {/* 4 Status Info Cards: Main Wallet | Play Wallet | Stake | Timer */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {/* Main Wallet */}
        <button
          type="button"
          aria-pressed={walletType === 'main_wallet'}
          onClick={() => setWalletType('main_wallet')}
          className={`border rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner cursor-pointer ${walletType === 'main_wallet' ? 'bg-emerald-950/70 border-emerald-500' : 'bg-[#1f1938] border-[#322a57]'}`}
        >
          <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
            MAIN WALLET
          </span>
          <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
            {displayedMainWallet}
          </span>
        </button>

        {/* Play Wallet */}
        <button
          type="button"
          aria-pressed={walletType === 'play_wallet'}
          onClick={() => setWalletType('play_wallet')}
          className={`border rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner cursor-pointer ${walletType === 'play_wallet' ? 'bg-amber-950/70 border-amber-500' : 'bg-[#1f1938] border-[#322a57]'}`}
        >
          <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
            PLAY WALLET
          </span>
          <span className="font-mono text-xs sm:text-sm font-black text-[#10b981] mt-0.5">
            {displayedPlayWallet}
          </span>
        </button>

        {/* Stake */}
        <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
          <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
            STAKE
          </span>
          <span className="font-mono text-xs sm:text-sm font-black text-white mt-0.5">
            {settings.selectedStake}
          </span>
        </div>

        {/* Countdown Timer */}
        <div className="bg-[#1f1938] border border-[#322a57] rounded-xl py-1.5 px-0.5 text-center flex flex-col justify-center shadow-inner">
          <span className="text-[8px] font-bold text-slate-400 tracking-tight uppercase">
            TIMER
          </span>
          <span className="font-mono text-xs sm:text-sm font-black text-[#facc15] mt-0.5">
            {timeLeft}s
          </span>
        </div>
      </div>
      {walletType === 'play_wallet' ? (
        <p className="text-center text-[10px] text-emerald-300 font-semibold mb-2">
          🎁 የመመዝገቢያ 10 ብር ቦነስዎን በመጠቀም እየተጫወቱ ነው! ሲያሸንፉ ሽልማት ወደ Main Wallet ይገባል።
        </p>
      ) : (
        <p className="text-center text-[10px] text-slate-400 mb-2">
          💰 በ Main Wallet (እውነተኛ የገንዘብ ሂሳብ) እየተጫወቱ ነው።
        </p>
      )}

      {/* Cartela Numbers 8-Columns Grid (1 to 400) */}
      <div className="bg-[#1b1534] border border-[#2d2553] rounded-2xl p-2 shadow-2xl mb-2">
        <div
          className={`${
            activeCards.length > 0 ? 'max-h-[195px]' : 'max-h-[360px]'
          } overflow-y-auto pr-0.5 custom-scrollbar transition-all duration-200`}
        >
          <div className="grid grid-cols-8 gap-1 sm:gap-1.5">
            {Array.from({ length: TOTAL_CARTELAS }, (_, i) => i + 1).map((cartelaNum) => {
              const claimedBy = remoteClaims.get(cartelaNum);
              const isTakenByOther = !!claimedBy;
              const isSelected = selectedCartelaIds.includes(cartelaNum);
              const isCurrentlyPreviewed = previewCartelaId === cartelaNum;

              let cellStyle =
                'bg-[#28214a] hover:bg-[#32295d] text-white border border-[#382f65]';

              if (isSelected) {
                // User Selected -> Bright Green
                cellStyle =
                  'bg-[#10b981] text-white font-black shadow-md border border-[#059669] ring-1 ring-emerald-300';
              } else if (isTakenByOther) {
                // Taken by other real players -> Orange
                cellStyle =
                  'bg-[#f97316] text-white font-black shadow-md border border-[#ea580c] cursor-not-allowed';
              } else if (isCurrentlyPreviewed) {
                cellStyle =
                  'bg-[#372f5d] text-white font-black border border-amber-400 ring-1 ring-amber-400';
              }

              return (
                <button
                  key={cartelaNum}
                  onClick={() => handleCartelaClick(cartelaNum)}
                  title={claimedBy ? `Taken by ${claimedBy}` : `Cartel #${cartelaNum}`}
                  className={`h-7 sm:h-8 rounded-lg font-mono text-xs sm:text-sm font-bold flex items-center justify-center transition-all transform active:scale-95 ${cellStyle}`}
                >
                  {cartelaNum}
                </button>
              );
            })}
          </div>
        </div>
      </div>



      {/* Bottom Cartela Section: When 1 or more tickets are picked, shows cards side-by-side (ጎን ለጎን) */}
      {activeCards.length > 0 ? (
        <div className="w-full flex flex-col items-center animate-fadeIn">
          {/* Header info if multiple tickets selected */}
          {activeCards.length > 1 && (
            <div className="flex items-center justify-between w-full px-2 mb-1 text-[10px] text-amber-400 font-bold">
              <span>የተመረጡ ካርቴላዎች ({activeCards.length}):</span>
              <span className="text-slate-400 font-mono text-[9px]">ወደ ጎን ያንሸራትቱ / Scroll</span>
            </div>
          )}

          {/* Cards Side-by-Side Container (ጎን ለጎን) */}
          <div
            className={`w-full flex gap-2.5 overflow-x-auto pb-1 px-1 custom-scrollbar ${
              activeCards.length === 1 ? 'justify-center' : 'justify-start sm:justify-center'
            }`}
          >
            {activeCards.map(({ id: cartId, card }) => {
              const isSelected = selectedCartelaIds.includes(cartId);
              return (
                <div
                  key={cartId}
                  className={`shrink-0 flex flex-col items-center transition-all ${
                    activeCards.length > 1 ? 'w-[195px] sm:w-[210px]' : 'w-[230px]'
                  }`}
                >
                  {/* CARTEL #Number Golden Badge */}
                  <div className="mb-1 flex items-center justify-center gap-1">
                    <span
                      className={`px-3.5 py-0.5 font-black text-[11px] uppercase tracking-wider rounded-md shadow-md inline-block ${
                        isSelected
                          ? 'bg-[#10b981] text-white ring-1 ring-emerald-300'
                          : 'bg-[#f59e0b] text-slate-950'
                      }`}
                    >
                      CARTEL #{cartId}
                    </span>
                    {activeCards.length === 1 && (
                      <button
                        onClick={() => {
                          setPreviewCartelaId(null);
                          setSelectedCartelaIds([]);
                        }}
                        className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors"
                        title="Close Preview"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 5x5 Cartela Card */}
                  <div className="w-full bg-[#1a1434] border border-[#2d2553] rounded-xl p-1.5 shadow-2xl">
                    {/* Header B-I-N-G-O */}
                    <div className="grid grid-cols-5 gap-1 mb-1 text-center font-black text-[10px] sm:text-[11px]">
                      <div className="bg-[#0284c7] text-white py-0.5 rounded">B</div>
                      <div className="bg-[#2563eb] text-white py-0.5 rounded">I</div>
                      <div className="bg-[#9333ea] text-white py-0.5 rounded">N</div>
                      <div className="bg-[#10b981] text-white py-0.5 rounded">G</div>
                      <div className="bg-[#f97316] text-white py-0.5 rounded">O</div>
                    </div>

                    {/* 5x5 Number Grid */}
                    <div className="grid grid-cols-5 gap-1">
                      {card.cells.map((row, rIdx) =>
                        row.map((cell, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className={`h-5 sm:h-6 rounded font-mono font-black text-[11px] sm:text-xs flex items-center justify-center ${
                              cell.isFree
                                ? 'bg-[#10b981] text-white shadow-sm'
                                : 'bg-white text-slate-950 shadow-sm'
                            }`}
                          >
                            {cell.isFree ? (
                              <Star className="w-3 h-3 fill-white text-white" />
                            ) : (
                              cell.number
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* Small Compact "Cartela View" strip when no number is clicked yet */
        <div className="flex items-center justify-center mt-1 animate-fadeIn">
          <div className="px-4 py-1.5 bg-[#1f1938] border border-[#322a57] rounded-xl flex items-center gap-1.5 text-slate-300 shadow-md">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-300">Cartela View</span>
            <span className="text-[10px] text-slate-500 font-medium ml-1">
              (ቁጥር ይንኩ / Tap any ticket)
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
