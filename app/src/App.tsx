import { useState, useCallback } from "react";
import { WalletProvider } from "./providers/WalletProvider";
import { Header } from "./components/Header";
import { VillageScreen } from "./components/VillageScreen";
import { DungeonScreen } from "./components/DungeonScreen";
import { CombatScreen } from "./components/CombatScreen";
import { MAX_HEALTH } from "./game/constants";

// ============================================
// GAME SCREENS
// ============================================

type GameScreen = "village" | "dungeon" | "combat";

// ============================================
// ENEMY TYPE (shared between screens)
// ============================================

interface Enemy {
  position: { x: number; y: number };
  health: number;
  type: "skeleton" | "demon" | "boss";
}

// ============================================
// GAME STATE
// ============================================

interface GameState {
  playerHealth: number;
  gold: number;
  currentEnemy: Enemy | null;
}

// ============================================
// MAIN GAME CONTENT
// ============================================

function GameContent() {
  const [screen, setScreen] = useState<GameScreen>("village");
  const [gameState, setGameState] = useState<GameState>({
    playerHealth: MAX_HEALTH,
    gold: 0,
    currentEnemy: null,
  });

  // Handle entering dungeon from village
  const handleEnterDungeon = useCallback(() => {
    setScreen("dungeon");
  }, []);

  // Handle exiting dungeon back to village
  const handleExitDungeon = useCallback(() => {
    setScreen("village");
  }, []);

  // Handle combat encounter
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
        />
      );

    case "village":
    default:
      return <VillageScreen onEnterDungeon={handleEnterDungeon} />;
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
