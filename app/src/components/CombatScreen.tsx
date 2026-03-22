// ============================================
// COMBAT SCREEN - Turn-based PvP combat
// Select actions, watch animations, see damage
// ============================================

import { FC, useRef, useEffect, useState, useCallback } from "react";
import { CombatRenderer, CombatActionType } from "../game/combatRenderer";
import { CombatAction } from "../types/game";

// ============================================
// TYPES
// ============================================

interface Enemy {
  health: number;
  type: "skeleton" | "demon" | "boss";
}

interface CombatScreenProps {
  onEnd: (victory: boolean, playerHealth: number, goldEarned: number) => void;
  playerHealth: number;
  enemy?: Enemy;
}

// ============================================
// COMBAT LOGIC
// ============================================

const ACTION_DAMAGE: Record<CombatActionType, number> = {
  attack: 15,
  heavy: 30,
  block: 5,
  dodge: 0,
};

const ENEMY_ACTIONS: CombatActionType[] = [
  "attack",
  "attack",
  "heavy",
  "block",
];

function resolveAction(
  playerAction: CombatActionType,
  enemyAction: CombatActionType
): {
  playerDamage: number;
  enemyDamage: number;
  playerCrit: boolean;
  enemyCrit: boolean;
  playerBlocked: boolean;
  enemyBlocked: boolean;
  playerDodged: boolean;
  enemyDodged: boolean;
} {
  let playerDamage = 0;
  let enemyDamage = 0;
  const playerCrit = Math.random() < 0.1;
  const enemyCrit = Math.random() < 0.1;
  let playerBlocked = false;
  let enemyBlocked = false;
  let playerDodged = false;
  let enemyDodged = false;

  // Calculate enemy damage to player
  const enemyBaseDamage = ACTION_DAMAGE[enemyAction];
  if (playerAction === "block" && enemyBaseDamage > 0) {
    playerBlocked = true;
    playerDamage = Math.floor(enemyBaseDamage * 0.2);
  } else if (playerAction === "dodge" && Math.random() < 0.7) {
    playerDodged = true;
    playerDamage = 0;
  } else {
    playerDamage = enemyCrit ? enemyBaseDamage * 2 : enemyBaseDamage;
  }

  // Calculate player damage to enemy
  const playerBaseDamage = ACTION_DAMAGE[playerAction];
  if (enemyAction === "block" && playerBaseDamage > 0) {
    enemyBlocked = true;
    enemyDamage = Math.floor(playerBaseDamage * 0.2);
  } else if (enemyAction === "dodge" && Math.random() < 0.5) {
    enemyDodged = true;
    enemyDamage = 0;
  } else {
    enemyDamage = playerCrit ? playerBaseDamage * 2 : playerBaseDamage;
  }

  return {
    playerDamage,
    enemyDamage,
    playerCrit,
    enemyCrit,
    playerBlocked,
    enemyBlocked,
    playerDodged,
    enemyDodged,
  };
}

// ============================================
// COMBAT SCREEN COMPONENT
// ============================================

export const CombatScreen: FC<CombatScreenProps> = ({
  onEnd,
  playerHealth: initialPlayerHealth,
  enemy,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CombatRenderer | null>(null);
  const animationRef = useRef<number>(0);

  const [isLoaded, setIsLoaded] = useState(false);
  const [turnPhase, setTurnPhase] = useState<"select" | "resolve" | "result">(
    "select"
  );
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAction, setSelectedAction] = useState<CombatActionType | null>(
    null
  );

  const [playerHealth, setPlayerHealth] = useState(initialPlayerHealth);
  const [enemyHealth, setEnemyHealth] = useState(enemy?.health ?? 100);
  const [goldEarned, setGoldEarned] = useState(0);

  const [resultText, setResultText] = useState("");
  const [combatEnded, setCombatEnded] = useState(false);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new CombatRenderer(canvasRef.current);
    rendererRef.current = renderer;

    renderer.loadAssets().then(() => {
      renderer.resize(window.innerWidth, window.innerHeight);
      setIsLoaded(true);
    });

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !isLoaded) return;

    const render = (time: number) => {
      renderer.update(time);
      renderer.render();
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLoaded]);

  // Turn timer
  useEffect(() => {
    if (turnPhase !== "select" || combatEnded) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-select block if time runs out
          handleAction("block");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [turnPhase, combatEnded]);

  // Handle action selection
  const handleAction = useCallback(
    (action: CombatActionType) => {
      if (turnPhase !== "select" || combatEnded) return;

      setSelectedAction(action);
      setTurnPhase("resolve");

      const renderer = rendererRef.current;
      if (!renderer) return;

      // Pick enemy action
      const enemyAction =
        ENEMY_ACTIONS[Math.floor(Math.random() * ENEMY_ACTIONS.length)];

      // Play animations
      renderer.setPlayerAction(action);
      renderer.setEnemyAction(enemyAction);

      // Resolve after animation (600ms)
      setTimeout(() => {
        const result = resolveAction(action, enemyAction);

        // Show effects
        if (result.playerBlocked) {
          renderer.showBlock(true);
        }
        if (result.enemyBlocked) {
          renderer.showBlock(false);
        }
        if (result.playerDodged) {
          renderer.showDodge(true);
        }
        if (result.enemyDodged) {
          renderer.showDodge(false);
        }

        // Show damage with delays
        setTimeout(() => {
          if (result.enemyDamage > 0 && !result.enemyDodged) {
            renderer.showDamage(result.enemyDamage, false, result.playerCrit);
            setEnemyHealth((prev) => Math.max(0, prev - result.enemyDamage));
          }
        }, 200);

        setTimeout(() => {
          if (result.playerDamage > 0 && !result.playerDodged) {
            renderer.showDamage(result.playerDamage, true, result.enemyCrit);
            setPlayerHealth((prev) => Math.max(0, prev - result.playerDamage));
          }
        }, 500);

        // Check for combat end
        setTimeout(() => {
          setEnemyHealth((currentEnemyHealth) => {
            setPlayerHealth((currentPlayerHealth) => {
              if (currentEnemyHealth <= 0) {
                // Victory
                const gold = 50 + Math.floor(Math.random() * 100);
                setGoldEarned(gold);
                setResultText(`VICTORY! +${gold} GOLD`);
                renderer.playDeathAnimation(false);
                setCombatEnded(true);
                setTurnPhase("result");
              } else if (currentPlayerHealth <= 0) {
                // Defeat
                setResultText("DEFEAT!");
                renderer.playDeathAnimation(true);
                setCombatEnded(true);
                setTurnPhase("result");
              } else {
                // Next turn
                setTurnPhase("select");
                setTimeLeft(10);
                setSelectedAction(null);
              }
              return currentPlayerHealth;
            });
            return currentEnemyHealth;
          });
        }, 1000);
      }, 600);
    },
    [turnPhase, combatEnded]
  );

  // Handle combat end
  const handleCombatEnd = useCallback(() => {
    const victory = enemyHealth <= 0;
    onEnd(victory, playerHealth, victory ? goldEarned : 0);
  }, [onEnd, enemyHealth, playerHealth, goldEarned]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-ember-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "12px",
              color: "#ff6b35",
            }}
          >
            LOADING COMBAT... (If stuck, check console)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Combat Header */}
      <div className="flex justify-between items-center p-4 relative z-10">
        {/* Player health */}
        <div className="flex-1">
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "10px",
              color: "#ff6b35",
              marginBottom: "4px",
            }}
          >
            YOU
          </p>
          <div className="flex items-center gap-2">
            <div className="w-40 h-6 bg-gray-900 border-2 border-gray-700">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${playerHealth}%`,
                  background:
                    playerHealth > 50
                      ? "#4ade80"
                      : playerHealth > 25
                      ? "#fbbf24"
                      : "#ef4444",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#fff",
              }}
            >
              {playerHealth}/100
            </span>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center px-8">
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "24px",
              color: timeLeft <= 3 ? "#ff4444" : "#fff",
            }}
          >
            {turnPhase === "select" ? timeLeft : "-"}
          </p>
        </div>

        {/* Enemy health */}
        <div className="flex-1 text-right">
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "10px",
              color: "#8b3a75",
              marginBottom: "4px",
            }}
          >
            {enemy?.type?.toUpperCase() || "ENEMY"}
          </p>
          <div className="flex items-center gap-2 justify-end">
            <span
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#fff",
              }}
            >
              {enemyHealth}/{enemy?.health || 100}
            </span>
            <div className="w-40 h-6 bg-gray-900 border-2 border-gray-700">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${(enemyHealth / (enemy?.health || 100)) * 100}%`,
                  background: "#8b3a75",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Combat Arena */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Result overlay */}
        {turnPhase === "result" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div
              className="px-10 py-8 text-center"
              style={{
                background: enemyHealth <= 0 ? "#1a2a1a" : "#2a1a1a",
                border: `4px solid ${enemyHealth <= 0 ? "#4ade80" : "#ef4444"}`,
                boxShadow: `0 0 40px ${
                  enemyHealth <= 0
                    ? "rgba(74, 222, 128, 0.4)"
                    : "rgba(239, 68, 68, 0.4)"
                }`,
              }}
            >
              <p
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "24px",
                  color: enemyHealth <= 0 ? "#4ade80" : "#ef4444",
                  textShadow: "2px 2px 0 #000",
                }}
              >
                {resultText}
              </p>
              <button
                onClick={handleCombatEnd}
                className="mt-6 px-8 py-3 transition-transform hover:scale-105 active:scale-95"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "12px",
                  background:
                    enemyHealth <= 0
                      ? "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)"
                      : "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)",
                  color: "#000",
                  border: "3px solid #000",
                  boxShadow: "4px 4px 0 #000",
                }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={() => onEnd(false, playerHealth, 0)}
          className="px-4 py-2 hover:opacity-80 transition-opacity"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "10px",
            background: "#2a2a3a",
            color: "#ff6b35",
            border: "2px solid #ff6b35",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          FLEE
        </button>
      </div>

      {/* Action Buttons */}
      <div className="p-4 relative z-10">
        <div className="grid grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            {
              action: "attack" as CombatActionType,
              icon: "\u2694",
              label: "ATTACK",
              desc: "15 DMG",
              color: "#ff6b35",
            },
            {
              action: "block" as CombatActionType,
              icon: "\uD83D\uDEE1",
              label: "BLOCK",
              desc: "-80% DMG",
              color: "#4a90d9",
            },
            {
              action: "dodge" as CombatActionType,
              icon: "\uD83D\uDCA8",
              label: "DODGE",
              desc: "70% EVADE",
              color: "#9b59b6",
            },
            {
              action: "heavy" as CombatActionType,
              icon: "\uD83D\uDCA5",
              label: "HEAVY",
              desc: "30 DMG",
              color: "#e74c3c",
            },
          ].map(({ action, icon, label, desc, color }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={turnPhase !== "select" || combatEnded}
              className={`p-4 transition-all duration-200 ${
                selectedAction === action
                  ? "scale-95 opacity-100"
                  : turnPhase !== "select"
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:scale-105 hover:brightness-110"
              }`}
              style={{
                background: selectedAction === action ? color : "#1a1a2a",
                border: `4px solid ${
                  selectedAction === action ? "#fff" : color
                }`,
                boxShadow:
                  selectedAction === action
                    ? `0 0 20px ${color}`
                    : "4px 4px 0 #000",
              }}
            >
              <span className="text-3xl block mb-1">{icon}</span>
              <p
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  color: selectedAction === action ? "#000" : color,
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "8px",
                  color: selectedAction === action ? "#333" : "#666",
                  marginTop: "4px",
                }}
              >
                {desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10 z-0"
        style={{
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
};

export default CombatScreen;
