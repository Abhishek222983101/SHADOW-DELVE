import { useState, useCallback } from "react";
import { WalletProvider } from "./providers/WalletProvider";
import { Header } from "./components/Header";
import { LandingPage } from "./components/LandingPage";
import { VillageScreen } from "./components/VillageScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { DungeonScreen } from "./components/DungeonScreen";
import { CombatScreen } from "./components/CombatScreen";
import { MAX_HEALTH } from "./game/constants";

// ============================================
// GAME SCREENS
// ============================================

type GameScreen = "landing" | "village" | "lobby" | "dungeon" | "combat";

// ============================================
// ENEMY TYPE (shared between screens)
// ============================================

interface Enemy {
  position: { x: number; y: number };
  health: number;
  type: "skeleton" | "demon" | "boss";
}

// ============================================
// MATCH STATE (for PvP)
// ============================================

interface MatchState {
  matchId: string | null;
  opponentPubkey: string | null;
  isHost: boolean;
}

// ============================================
// GAME STATE
// ============================================

interface GameState {
  playerHealth: number;
  gold: number;
  currentEnemy: Enemy | null;
  match: MatchState;
}

// ============================================
// MAIN GAME CONTENT
// ============================================

function GameContent() {
  const [screen, setScreen] = useState<GameScreen>("landing");
  const [gameState, setGameState] = useState<GameState>({
    playerHealth: MAX_HEALTH,
    gold: 0,
    currentEnemy: null,
    match: {
      matchId: null,
      opponentPubkey: null,
      isHost: false,
    },
  });

  // Handle entering game from landing page
  const handleEnterGame = useCallback(() => {
    setScreen("village");
  }, []);

  // Handle opening lobby from village (approaching dungeon gate)
  const handleOpenLobby = useCallback(() => {
    setScreen("lobby");
  }, []);

  // Handle closing lobby (back to village)
  const handleCloseLobby = useCallback(() => {
    setScreen("village");
  }, []);

  // Handle match start from lobby
  const handleMatchStart = useCallback(
    (matchId: string, opponentPubkey: string | null, isHost: boolean) => {
      setGameState((prev) => ({
        ...prev,
        match: {
          matchId,
          opponentPubkey,
          isHost,
        },
      }));
      setScreen("dungeon");
    },
    []
  );

  // Handle exiting dungeon back to village
  const handleExitDungeon = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      match: {
        matchId: null,
        opponentPubkey: null,
        isHost: false,
      },
    }));
    setScreen("village");
  }, []);

  // Handle combat encounter (PvP collision!)
  const handleCombatEncounter = useCallback((enemy: Enemy) => {
    setGameState((prev) => ({
      ...prev,
      currentEnemy: enemy,
    }));
    setScreen("combat");
  }, []);

  // Handle combat end
  const handleCombatEnd = useCallback(
    (victory: boolean, newHealth: number, goldEarned: number) => {
      setGameState((prev) => ({
        ...prev,
        playerHealth: newHealth,
        gold: prev.gold + goldEarned,
        currentEnemy: null,
      }));

      if (newHealth <= 0) {
        // Player died - return to village with reset health
        setGameState((prev) => ({
          ...prev,
          playerHealth: MAX_HEALTH,
          match: {
            matchId: null,
            opponentPubkey: null,
            isHost: false,
          },
        }));
        setScreen("village");
      } else {
        // Return to dungeon
        setScreen("dungeon");
      }
    },
    []
  );

  // Render current screen
  switch (screen) {
    case "landing":
      return <LandingPage onEnterGame={handleEnterGame} />;

    case "lobby":
      return (
        <LobbyScreen
          onClose={handleCloseLobby}
          onMatchStart={handleMatchStart}
        />
      );

    case "combat":
      return (
        <CombatScreen
          onEnd={handleCombatEnd}
          playerHealth={gameState.playerHealth}
          enemy={
            gameState.currentEnemy
              ? {
                  health: gameState.currentEnemy.health,
                  type: gameState.currentEnemy.type,
                }
              : undefined
          }
        />
      );

    case "dungeon":
      return (
        <DungeonScreen
          onExit={handleExitDungeon}
          onCombat={handleCombatEncounter}
          initialHealth={gameState.playerHealth}
          initialGold={gameState.gold}
          matchId={gameState.match.matchId}
        />
      );

    case "village":
    default:
      return <VillageScreen onEnterDungeon={handleOpenLobby} />;
  }
}

// ============================================
// APP WRAPPER
// ============================================

function App() {
  return (
    <WalletProvider>
      <div className="game-container min-h-screen bg-black overflow-hidden">
        <Header />
        <GameContent />
      </div>
    </WalletProvider>
  );
}

export default App;
