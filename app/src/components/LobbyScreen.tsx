// ============================================
// LOBBY SCREEN - Match creation and joining
// PvP matchmaking with TEE delegation setup
// ============================================

import { FC, useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  getShadowDelveClient,
  anchorStatusToEnum,
  MatchStateAccount,
} from "../game/anchor";
import { MatchStatus } from "../types/game";
import { useAnchorWallet } from "../hooks/useAnchorWallet";

// ============================================
// TYPES
// ============================================

interface LobbyScreenProps {
  onClose: () => void;
  onMatchStart: (
    matchId: string,
    opponentPubkey: string | null,
    isHost: boolean
  ) => void;
}

type LobbyState =
  | "idle"
  | "creating"
  | "waiting"
  | "joining"
  | "delegating"
  | "ready"
  | "error";

interface MatchInfo {
  matchId: BN;
  player1: string;
  player2: string | null;
  status: MatchStatus;
  isHost: boolean;
}

// ============================================
// LOBBY SCREEN COMPONENT
// ============================================

export const LobbyScreen: FC<LobbyScreenProps> = ({
  onClose,
  onMatchStart,
}) => {
  const { connected, signMessage } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [lobbyState, setLobbyState] = useState<LobbyState>("idle");
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinMatchId, setJoinMatchId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Set wallet on client when available
  useEffect(() => {
    if (anchorWallet) {
      const client = getShadowDelveClient();
      client.setWallet(anchorWallet);
    }
  }, [anchorWallet]);

  // Poll for match updates when waiting
  useEffect(() => {
    if (!matchInfo || lobbyState !== "waiting") return;

    const pollMatch = async () => {
      try {
        const client = getShadowDelveClient();
        const match = await client.getMatchState(matchInfo.matchId);
        if (match) {
          const status = anchorStatusToEnum(match.status);
          if (status === MatchStatus.Ready || status === MatchStatus.Active) {
            setMatchInfo((prev) =>
              prev
                ? {
                    ...prev,
                    player2: match.player2?.toBase58() || null,
                    status,
                  }
                : null
            );
            setLobbyState("ready");
            setStatusMessage("OPPONENT FOUND! PREPARING DUNGEON...");
          }
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollMatch, 2000);
    return () => clearInterval(interval);
  }, [matchInfo, lobbyState]);

  // Create new match
  const handleCreateMatch = useCallback(async () => {
    if (!anchorWallet) return;

    setLobbyState("creating");
    setError(null);
    setStatusMessage("CREATING MATCH ON DEVNET...");

    try {
      const client = getShadowDelveClient();
      const matchId = client.generateMatchId();

      // Create match on L1
      await client.createMatch(matchId);
      setStatusMessage("MATCH CREATED! GENERATING DUNGEON...");

      // Generate dungeon
      const vrfSeed = client.generateVRFSeed();
      await client.generateDungeon(matchId, vrfSeed);
      setStatusMessage("DUNGEON READY! INITIALIZING TEE...");

      // Initialize TEE connection
      if (signMessage) {
        await client.initTEEConnection(signMessage);
      } else {
        throw new Error("Wallet does not support signMessage");
      }
      setStatusMessage("WAITING FOR OPPONENT TO JOIN...");

      setMatchInfo({
        matchId,
        player1: anchorWallet.publicKey.toBase58(),
        player2: null,
        status: MatchStatus.Waiting,
        isHost: true,
      });
      setLobbyState("waiting");
    } catch (err) {
      console.error("Create match error:", err);
      setError(err instanceof Error ? err.message : "Failed to create match");
      setLobbyState("error");
    }
  }, [anchorWallet, signMessage]);

  // Join existing match
  const handleJoinMatch = useCallback(async () => {
    if (!anchorWallet || !joinMatchId) return;

    setLobbyState("joining");
    setError(null);
    setStatusMessage("JOINING MATCH ON DEVNET...");

    try {
      const matchId = new BN(joinMatchId);
      const client = getShadowDelveClient();

      // Check match exists on L1 Devnet first!
      const match = await client.getMatchState(matchId);
      if (!match) {
        throw new Error("Match not found");
      }

      const status = anchorStatusToEnum(match.status);
      if (status !== MatchStatus.Waiting) {
        throw new Error("Match is not available to join");
      }

      // Join match on L1 (Devnet) BEFORE connecting to TEE
      // We do this on L1 because the match_state shouldn't be delegated yet
      await client.joinMatch(matchId);
      setStatusMessage("JOINED! CONNECTING TO TEE...");

      // Now connect to TEE for the actual gameplay
      if (signMessage) {
        await client.initTEEConnection(signMessage);
      } else {
        throw new Error("Wallet does not support signMessage");
      }
      setStatusMessage("TEE CONNECTED! WAITING FOR HOST TO START...");

      setMatchInfo({
        matchId,
        player1: match.player1.toBase58(),
        player2: anchorWallet.publicKey.toBase58(),
        status: MatchStatus.Ready, // Ready state, waiting for host to start
        isHost: false,
      });

    } catch (err) {
      console.error("Join match error:", err);
      setError(err instanceof Error ? err.message : "Failed to join match");
      setLobbyState("error");
    }
  }, [anchorWallet, joinMatchId, signMessage]);

  // Start game when ready
  const handleStartGame = useCallback(async () => {
    if (!matchInfo || !anchorWallet) return;

    if (matchInfo.isHost) {
      setLobbyState("delegating");
      setStatusMessage("DELEGATING MATCH TO TEE...");

      try {
        const client = getShadowDelveClient();
        
        // Host delegates the match state to the TEE AFTER player 2 joins
        await client.delegateDungeon(matchInfo.matchId);
        await client.delegateMatch(matchInfo.matchId);
        
        setStatusMessage("MATCH DELEGATED! STARTING...");
        
        // Wait a moment for TEE sync
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        await client.startMatch(matchInfo.matchId);
        
        onMatchStart(
          matchInfo.matchId.toString(),
          matchInfo.player2,
          matchInfo.isHost
        );
      } catch (err) {
        console.error("Start match error:", err);
        setError(err instanceof Error ? err.message : "Failed to start match");
        setLobbyState("error");
      }
    } else {
      // Player 2 just waits for host to start
      onMatchStart(
        matchInfo.matchId.toString(),
        matchInfo.player2,
        matchInfo.isHost
      );
    }
  }, [matchInfo, anchorWallet, onMatchStart]);

  // Reset state
  const handleReset = useCallback(() => {
    setLobbyState("idle");
    setMatchInfo(null);
    setError(null);
    setJoinMatchId("");
    setStatusMessage("");
  }, []);

  if (!connected) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center">
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "12px",
              color: "#ff6b35",
            }}
          >
            WALLET NOT CONNECTED
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-3"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "10px",
              background: "#2a2a3a",
              color: "#888",
              border: "3px solid #000",
            }}
          >
            BACK TO VILLAGE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #1a0a1f 0%, #0a0a10 50%, #050508 100%)",
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              background: i % 2 === 0 ? "#ff6b35" : "#9b59b6",
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 100}%`,
              opacity: 0.3 + (i % 5) * 0.1,
              animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className="relative z-10 w-full max-w-2xl mx-4 p-8"
        style={{
          background: "rgba(10, 10, 20, 0.95)",
          border: "4px solid #333",
          boxShadow: "0 0 60px rgba(138, 43, 226, 0.3), 8px 8px 0 #000",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-3xl md:text-4xl tracking-wider mb-2"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              color: "#ff6b35",
              textShadow: "4px 4px 0 #000, 0 0 20px rgba(255, 107, 53, 0.5)",
            }}
          >
            DUNGEON ARENA
          </h1>
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "8px",
              color: "#9b59b6",
              letterSpacing: "2px",
            }}
          >
            PRIVATE EPHEMERAL ROLLUP (TEE)
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className="text-center mb-6 py-3 animate-pulse"
            style={{
              background: "rgba(138, 43, 226, 0.2)",
              border: "2px solid rgba(138, 43, 226, 0.5)",
            }}
          >
            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#9b59b6",
              }}
            >
              {statusMessage}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            className="text-center mb-6 py-3"
            style={{
              background: "rgba(239, 68, 68, 0.2)",
              border: "2px solid #ef4444",
            }}
          >
            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#ef4444",
              }}
            >
              ERROR: {error}
            </p>
          </div>
        )}

        {/* Idle State - Show Options */}
        {lobbyState === "idle" && (
          <div className="space-y-6">
            {/* Create Match */}
            <div className="text-center">
              <button
                onClick={handleCreateMatch}
                className="w-full py-4 transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "14px",
                  background:
                    "linear-gradient(180deg, #ff6b35 0%, #c44d1c 100%)",
                  color: "#000",
                  border: "4px solid #000",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                CREATE MATCH
              </button>
              <p
                className="mt-2"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "8px",
                  color: "#666",
                }}
              >
                HOST A NEW DUNGEON ARENA
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-700" />
              <span
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  color: "#666",
                }}
              >
                OR
              </span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Join Match */}
            <div>
              <input
                type="text"
                value={joinMatchId}
                onChange={(e) => setJoinMatchId(e.target.value)}
                placeholder="ENTER MATCH ID..."
                className="w-full px-4 py-3 mb-3 focus:outline-none"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  background: "#1a1a2a",
                  color: "#fff",
                  border: "3px solid #333",
                }}
              />
              <button
                onClick={handleJoinMatch}
                disabled={!joinMatchId}
                className="w-full py-4 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "14px",
                  background:
                    "linear-gradient(180deg, #9b59b6 0%, #6b3d7a 100%)",
                  color: "#fff",
                  border: "4px solid #000",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                JOIN MATCH
              </button>
            </div>
          </div>
        )}

        {/* Waiting State */}
        {lobbyState === "waiting" && matchInfo && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />

            <div
              className="py-4 px-6"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "2px solid #333",
              }}
            >
              <p
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "8px",
                  color: "#888",
                  marginBottom: "8px",
                }}
              >
                MATCH ID (SHARE WITH OPPONENT)
              </p>
              <p
                className="select-all cursor-pointer"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "14px",
                  color: "#ff6b35",
                  wordBreak: "break-all",
                }}
              >
                {matchInfo.matchId.toString()}
              </p>
            </div>

            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#666",
              }}
            >
              CLICK TO COPY • WAITING FOR PLAYER 2...
            </p>
          </div>
        )}

        {/* Ready State */}
        {lobbyState === "ready" && matchInfo && (
          <div className="text-center space-y-6">
            <div
              className="flex items-center justify-center gap-2 py-2"
              style={{
                background: "rgba(34, 197, 94, 0.2)",
                border: "2px solid #4ade80",
              }}
            >
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "12px",
                  color: "#4ade80",
                }}
              >
                OPPONENT FOUND!
              </span>
            </div>

            <div className="flex justify-around">
              <div className="text-center">
                <p
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "8px",
                    color: "#888",
                  }}
                >
                  PLAYER 1 (YOU)
                </p>
                <p
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "10px",
                    color: "#ff6b35",
                    marginTop: "4px",
                  }}
                >
                  {matchInfo.player1.slice(0, 4)}...
                  {matchInfo.player1.slice(-4)}
                </p>
              </div>
              <div
                className="text-2xl"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#666",
                }}
              >
                VS
              </div>
              <div className="text-center">
                <p
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "8px",
                    color: "#888",
                  }}
                >
                  PLAYER 2
                </p>
                <p
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "10px",
                    color: "#9b59b6",
                    marginTop: "4px",
                  }}
                >
                  {matchInfo.player2
                    ? `${matchInfo.player2.slice(
                        0,
                        4
                      )}...${matchInfo.player2.slice(-4)}`
                    : "???"}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartGame}
              className="w-full py-4 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "16px",
                background: "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",
                color: "#000",
                border: "4px solid #000",
                boxShadow: "4px 4px 0 #000, 0 0 30px rgba(74, 222, 128, 0.4)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              ENTER DUNGEON
            </button>
          </div>
        )}

        {/* Creating/Delegating/Joining States */}
        {["creating", "delegating", "joining"].includes(lobbyState) && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#888",
              }}
            >
              {lobbyState === "creating" && "CREATING MATCH..."}
              {lobbyState === "delegating" && "DELEGATING TO TEE..."}
              {lobbyState === "joining" && "JOINING MATCH..."}
            </p>
          </div>
        )}

        {/* Error State */}
        {lobbyState === "error" && (
          <div className="text-center">
            <button
              onClick={handleReset}
              className="px-8 py-3 transition-all duration-200 hover:scale-105"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                background: "#2a2a3a",
                color: "#888",
                border: "3px solid #333",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 px-3 py-2 transition-all duration-200 hover:scale-105"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "10px",
            background: "#1a1a2a",
            color: "#666",
            border: "2px solid #333",
          }}
        >
          X
        </button>
      </div>

      {/* Privacy Info */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "8px",
            color: "#666",
          }}
        >
          POSITIONS HIDDEN VIA TRUSTED EXECUTION ENVIRONMENT
        </p>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default LobbyScreen;
