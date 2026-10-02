// ============================================
// DUNGEON SCREEN - Explore the dungeon with fog of war
// WASD movement, treasure collection, enemy encounters
// ============================================

import { FC, useRef, useEffect, useState, useCallback } from "react";
import { PixelDungeonRenderer } from "../game/pixelRenderer";
import { TileType, Position, positionToKey, Direction } from "../types/game";
import { GRID_SIZE, MAX_HEALTH } from "../game/constants";
import { getShadowDelveClient } from "../game/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// ============================================
// TYPES
// ============================================

interface Treasure {
  position: Position;
  amount: number;
  collected: boolean;
}

interface Enemy {
  position: Position;
  health: number;
  type: "skeleton" | "demon" | "boss";
}

interface DungeonState {
  playerPos: Position;
  opponentPos?: Position;
  health: number;
  gold: number;
  explored: Set<string>;
  visible: Set<string>;
  treasures: Treasure[];
  enemies: Enemy[];
  gameOver: boolean;
  victory: boolean;
  dungeonGrid: TileType[][];
}

interface DungeonScreenProps {
  onExit: () => void;
  onCombat: (enemy: Enemy) => void;
  initialHealth?: number;
  initialGold?: number;
  matchId?: string | null; // TEE match ID for PvP
  opponentPubkey?: string | null;
  isHost?: boolean;
}

// ============================================
// DUNGEON SCREEN COMPONENT
// ============================================

export const DungeonScreen: FC<DungeonScreenProps> = ({
  onExit,
  onCombat,
  initialHealth = MAX_HEALTH,
  initialGold = 0,
  matchId,
  opponentPubkey,
  isHost,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixelDungeonRenderer | null>(null);
  const animationRef = useRef<number>(0);
  const client = getShadowDelveClient();

  const [state, setState] = useState<DungeonState>(() => ({
    playerPos: { x: 1, y: 1 },
    health: initialHealth,
    gold: initialGold,
    explored: new Set<string>(),
    visible: new Set<string>(),
    treasures: [],
    enemies: [],
    gameOver: false,
    victory: false,
    dungeonGrid: Array(15).fill(null).map(() => Array(15).fill(TileType.Wall)),
  }));

  const [isCombatTriggered, setIsCombatTriggered] = useState(false);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new PixelDungeonRenderer(canvasRef.current);
    rendererRef.current = renderer;

    renderer.init().then(() => {
      renderer.setGridSize(15, 15);
      renderer.resize(window.innerWidth, window.innerHeight);
      renderer.setPlayerPosition(1, 1, true);
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

  // Poll TEE state
  useEffect(() => {
    const wallet = client.getWallet();
    if (!matchId || !wallet) return;

    let isPolling = true;

    const pollState = async () => {
      if (!isPolling || isCombatTriggered || state.gameOver) return;

      try {
        const matchBn = new BN(matchId);
        
        // Fetch all states concurrently
        const [dungeonState, playerState, opponentState] = await Promise.all([
          client.getDungeonStateTEE(matchBn),
          client.getPlayerStateTEE(matchBn, wallet.publicKey),
          opponentPubkey ? client.getPlayerStateTEE(matchBn, new PublicKey(opponentPubkey)) : Promise.resolve(null)
        ]);

        if (dungeonState && playerState) {
          // Parse dungeon grid from contract state
          const newGrid = Array(15).fill(null).map(() => Array(15).fill(TileType.Wall));
          // Assuming dungeonState.grid is a flattened array or 2D array
          // Based on type: { floor?: {}; wall?: {}; exit?: {} }[][]
          if (dungeonState.grid && dungeonState.grid.length > 0) {
            // Check if it's 1D or 2D
            const is1D = !Array.isArray(dungeonState.grid[0]);
            
            for (let y = 0; y < 15; y++) {
              for (let x = 0; x < 15; x++) {
                let tileVal;
                if (is1D) {
                  // Fallback if somehow it's flat
                  const flatGrid = dungeonState.grid as unknown as any[];
                  tileVal = flatGrid[y * 15 + x];
                } else {
                  tileVal = dungeonState.grid[y][x];
                }
                
                if (tileVal && typeof tileVal === 'object') {
                  if ('floor' in tileVal) newGrid[y][x] = TileType.Floor;
                  else if ('wall' in tileVal) newGrid[y][x] = TileType.Wall;
                  else if ('exit' in tileVal) newGrid[y][x] = TileType.Exit;
                }
              }
            }
          }

          const pState = playerState as any;
          const playerPos: Position = { 
            x: pState.position?.x ?? pState.position_x ?? pState.x ?? 1, 
            y: pState.position?.y ?? pState.position_y ?? pState.y ?? 1 
          };
          let oppPos: Position | undefined;

          if (opponentState) {
            const oState = opponentState as any;
            oppPos = { 
              x: oState.position?.x ?? oState.position_x ?? oState.x ?? 1, 
              y: oState.position?.y ?? oState.position_y ?? oState.y ?? 1 
            };
          }

          console.log("[TEE Poll] Player position:", playerPos, "Opponent:", oppPos);

          setState(prev => {
            const newState = {
              ...prev,
              playerPos,
              opponentPos: oppPos,
              health: playerState.health,
              gold: playerState.gold ? playerState.gold.toNumber() : prev.gold,
              dungeonGrid: dungeonState.grid ? newGrid : prev.dungeonGrid,
            };
            
            // Check for combat proximity
            if (oppPos && !isCombatTriggered && !prev.gameOver && opponentState) {
              const dx = Math.abs(playerPos.x - oppPos.x);
              const dy = Math.abs(playerPos.y - oppPos.y);
              if (dx <= 1 && dy <= 1) { // 1 tile radius
                setIsCombatTriggered(true);
                // Trigger combat
                
                // If we are host, initialize combat on-chain before transitioning
                if (isHost) {
                  client.initCombat(matchBn).then(() => {
                    console.log("Combat initialized on L1");
                    onCombat({
                      position: oppPos,
                      health: opponentState.health,
                      type: "boss" // Opponent
                    });
                  }).catch((e: any) => {
                    console.error("Failed to init combat", e);
                    // Still transition, maybe it was already initialized
                    onCombat({
                      position: oppPos,
                      health: opponentState.health,
                      type: "boss" // Opponent
                    });
                  });
                } else {
                  // Guest just transitions
                  onCombat({
                    position: oppPos,
                    health: opponentState.health,
                    type: "boss" // Opponent
                  });
                }
              }
            }
            
            return newState;
          });

          // Update renderer
          if (rendererRef.current) {
             const isFirstUpdate = rendererRef.current.getPlayerWorldPos().x === 0 && rendererRef.current.getPlayerWorldPos().y === 0;
             rendererRef.current.setPlayerPosition(playerPos.x, playerPos.y, isFirstUpdate);
          }
        }
      } catch (err) {
        console.error("Error polling TEE state:", err);
      }

      if (isPolling) {
        setTimeout(pollState, 500); // Poll every 500ms
      }
    };

    pollState();

    return () => {
      isPolling = false;
    };
  }, [matchId, client, opponentPubkey, isCombatTriggered, state.gameOver, onCombat, isHost]);

  // Update visibility when player moves
  useEffect(() => {
    const newVisible = new Set<string>();
    const newExplored = new Set(state.explored);
    const radius = 3;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = state.playerPos.x + dx;
        const y = state.playerPos.y + dy;
        if (x >= 0 && x < 15 && y >= 0 && y < 15) {
          // Simple distance check for circular visibility
          if (dx * dx + dy * dy <= radius * radius + 1) {
            const key = positionToKey({ x, y });
            newVisible.add(key);
            newExplored.add(key);
          }
        }
      }
    }

    setState((prev) => ({
      ...prev,
      visible: newVisible,
      explored: newExplored,
    }));
  }, [state.playerPos]);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const render = (time: number) => {
      renderer.update(time);
      renderer.clear();

      // Draw all tiles
      for (let y = 0; y < 15; y++) {
        for (let x = 0; x < 15; x++) {
          const key = positionToKey({ x, y });
          const isVisible = state.visible.has(key);
          const isExplored = state.explored.has(key);

          renderer.drawTile(state.dungeonGrid[y][x], x, y, isVisible, isExplored, time);

          // Draw exit
          if (state.dungeonGrid[y][x] === TileType.Exit && isVisible) {
            renderer.drawExit(x, y, time);
          }
        }
      }

      // Draw opponent if visible
      if (state.opponentPos) {
        const key = positionToKey(state.opponentPos);
        if (state.visible.has(key)) {
          renderer.drawPlayer(state.opponentPos.x, state.opponentPos.y, time, true); // True for enemy color
        }
      }

      // Draw player
      renderer.drawPlayer(state.playerPos.x, state.playerPos.y, time, false);

      // Draw fog of war overlay
      renderer.drawFogOfWar(state.visible, state.explored);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [state]);

  // Keyboard controls
  useEffect(() => {
    let isMoving = false;
    let lastMoveTime = 0;
    const MOVE_COOLDOWN = 300; // ms to prevent wallet spam

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (state.gameOver || isCombatTriggered || !matchId || !opponentPubkey || isMoving) return;
      
      const now = Date.now();
      if (now - lastMoveTime < MOVE_COOLDOWN) return;

      const key = e.key.toLowerCase();
      let direction: Direction | null = null;
      let dx = 0;
      let dy = 0;

      switch (key) {
        case "w":
        case "arrowup":
          direction = Direction.Up;
          dy = -1;
          break;
        case "s":
        case "arrowdown":
          direction = Direction.Down;
          dy = 1;
          break;
        case "a":
        case "arrowleft":
          direction = Direction.Left;
          dx = -1;
          break;
        case "d":
        case "arrowright":
          direction = Direction.Right;
          dx = 1;
          break;
        default:
          return;
      }

      if (direction) {
        e.preventDefault();
        
        // Optimistic UI update
        const newX = state.playerPos.x + dx;
        const newY = state.playerPos.y + dy;
        
        // Simple collision check before updating optimistically
        if (newX >= 0 && newX < 15 && newY >= 0 && newY < 15 && 
            state.dungeonGrid[newY][newX] !== TileType.Wall) {
          
          if (state.dungeonGrid[newY][newX] === TileType.Exit) {
            console.log("Found exit, escaping!");
            try {
              await client.escape(matchId);
              onExit();
              return;
            } catch (err) {
              console.error("Failed to escape:", err);
            }
          }

          setState(prev => ({
            ...prev,
            playerPos: { x: newX, y: newY }
          }));
          
          if (rendererRef.current) {
            rendererRef.current.setPlayerPosition(newX, newY, false);
          }
        }

        isMoving = true;
        lastMoveTime = now;
        
        try {
          await client.movePlayer(new BN(matchId), direction, new PublicKey(opponentPubkey));
        } catch (err) {
          console.error("Move error:", err);
          // Revert optimistic update if transaction fails
          setState(prev => ({
             ...prev,
             playerPos: state.playerPos // Revert to old position
          }));
          if (rendererRef.current) {
             rendererRef.current.setPlayerPosition(state.playerPos.x, state.playerPos.y, false);
          }
        } finally {
          isMoving = false;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.gameOver, isCombatTriggered, matchId, opponentPubkey, client]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black flex items-center justify-center">
      <canvas ref={canvasRef} className="absolute max-w-full max-h-full" style={{ objectFit: "contain", margin: "auto" }} />

      {/* HUD */}
      <div className="absolute top-20 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* Health */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "3px solid #333",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          <span
            style={{
              color: "#ff4444",
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "12px",
            }}
          >
            HP
          </span>
          <div className="w-32 h-4 bg-gray-900 border border-gray-700">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${state.health}%`,
                background:
                  state.health > 50
                    ? "#4ade80"
                    : state.health > 25
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
            {state.health}
          </span>
        </div>

        {/* Gold */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "3px solid #333",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          <span
            style={{
              color: "#ffd700",
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "12px",
            }}
          >
            G
          </span>
          <span
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "12px",
              color: "#ffd700",
            }}
          >
            {state.gold}
          </span>
        </div>
      </div>

      {/* Controls hint */}
      <div
        className="absolute bottom-4 left-4 px-3 py-2"
        style={{
          background: "rgba(0,0,0,0.85)",
          border: "2px solid #333",
        }}
      >
        <p
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "8px",
            color: "#666",
          }}
        >
          WASD - MOVE | FIND THE OPPONENT
        </p>
      </div>

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-20 px-3 py-1 pointer-events-auto hover:opacity-80"
        style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "10px",
          background: "#2a2a3a",
          color: "#888",
          border: "2px solid #444",
        }}
      >
        EXIT
      </button>

      {/* Victory screen */}
      {state.gameOver && state.victory && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80">
          <div
            className="text-center p-8"
            style={{
              background: "#1a1a2a",
              border: "4px solid #4ade80",
              boxShadow: "0 0 40px rgba(74, 222, 128, 0.3)",
            }}
          >
            <h2
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "24px",
                color: "#4ade80",
                textShadow: "2px 2px 0 #000",
              }}
            >
              VICTORY!
            </h2>
            <p
              className="mt-4"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                color: "#ffd700",
              }}
            >
              GOLD: {state.gold}
            </p>
            <button
              onClick={onExit}
              className="mt-6 px-6 py-2 hover:opacity-80"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                background: "#4ade80",
                color: "#000",
                border: "3px solid #000",
                boxShadow: "3px 3px 0 #000",
              }}
            >
              RETURN TO VILLAGE
            </button>
          </div>
        </div>
      )}

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-15"
        style={{
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
};

export default DungeonScreen;
