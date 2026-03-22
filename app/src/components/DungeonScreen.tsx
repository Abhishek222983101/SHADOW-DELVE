// ============================================
// DUNGEON SCREEN - Explore the dungeon with fog of war
// WASD movement, treasure collection, enemy encounters
// ============================================

import { FC, useRef, useEffect, useState, useCallback } from "react";
import { PixelDungeonRenderer } from "../game/pixelRenderer";
import { TileType, Position, positionToKey } from "../types/game";
import { GRID_SIZE, MAX_HEALTH } from "../game/constants";

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
  health: number;
  gold: number;
  explored: Set<string>;
  visible: Set<string>;
  treasures: Treasure[];
  enemies: Enemy[];
  gameOver: boolean;
  victory: boolean;
}

interface DungeonScreenProps {
  onExit: () => void;
  onCombat: (enemy: Enemy) => void;
  initialHealth?: number;
  initialGold?: number;
}

// ============================================
// DUNGEON GENERATOR - Creates larger, more interesting maps
// ============================================

const DUNGEON_WIDTH = 15;
const DUNGEON_HEIGHT = 15;

function generateDungeon(): TileType[][] {
  const grid: TileType[][] = Array(DUNGEON_HEIGHT)
    .fill(null)
    .map(() => Array(DUNGEON_WIDTH).fill(TileType.Wall));

  // Room-based generation
  const rooms: { x: number; y: number; w: number; h: number }[] = [];

  // Generate random rooms
  for (let i = 0; i < 8; i++) {
    const w = 4 + Math.floor(Math.random() * 4);
    const h = 4 + Math.floor(Math.random() * 4);
    const x = 1 + Math.floor(Math.random() * (DUNGEON_WIDTH - w - 2));
    const y = 1 + Math.floor(Math.random() * (DUNGEON_HEIGHT - h - 2));

    // Check for overlap
    let overlap = false;
    for (const room of rooms) {
      if (
        x < room.x + room.w + 1 &&
        x + w + 1 > room.x &&
        y < room.y + room.h + 1 &&
        y + h + 1 > room.y
      ) {
        overlap = true;
        break;
      }
    }

    if (!overlap) {
      rooms.push({ x, y, w, h });

      // Carve out the room
      for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
          grid[ry][rx] = TileType.Floor;
        }
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];

    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    // L-shaped corridor
    if (Math.random() < 0.5) {
      // Horizontal then vertical
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        grid[ay][x] = TileType.Floor;
      }
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
        grid[y][bx] = TileType.Floor;
      }
    } else {
      // Vertical then horizontal
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
        grid[y][ax] = TileType.Floor;
      }
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        grid[by][x] = TileType.Floor;
      }
    }
  }

  // Place exit in the last room
  if (rooms.length > 0) {
    const lastRoom = rooms[rooms.length - 1];
    const exitX = Math.floor(lastRoom.x + lastRoom.w / 2);
    const exitY = Math.floor(lastRoom.y + lastRoom.h / 2);
    grid[exitY][exitX] = TileType.Exit;
  }

  return grid;
}

function generateTreasures(grid: TileType[][], count: number): Treasure[] {
  const treasures: Treasure[] = [];
  const floorTiles: Position[] = [];

  // Find all floor tiles
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === TileType.Floor) {
        floorTiles.push({ x, y });
      }
    }
  }

  // Shuffle and pick
  for (let i = floorTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [floorTiles[i], floorTiles[j]] = [floorTiles[j], floorTiles[i]];
  }

  for (let i = 0; i < Math.min(count, floorTiles.length); i++) {
    treasures.push({
      position: floorTiles[i],
      amount: 50 + Math.floor(Math.random() * 150),
      collected: false,
    });
  }

  return treasures;
}

function generateEnemies(
  grid: TileType[][],
  treasures: Treasure[],
  count: number
): Enemy[] {
  const enemies: Enemy[] = [];
  const floorTiles: Position[] = [];
  const occupiedTiles = new Set(
    treasures.map((t) => positionToKey(t.position))
  );

  // Find all floor tiles not occupied by treasures, and away from start
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (
        grid[y][x] === TileType.Floor &&
        !occupiedTiles.has(positionToKey({ x, y })) &&
        (x > 5 || y > 5) // Not near start
      ) {
        floorTiles.push({ x, y });
      }
    }
  }

  // Shuffle and pick
  for (let i = floorTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [floorTiles[i], floorTiles[j]] = [floorTiles[j], floorTiles[i]];
  }

  for (let i = 0; i < Math.min(count, floorTiles.length); i++) {
    const types: Enemy["type"][] = ["skeleton", "skeleton", "demon"];
    enemies.push({
      position: floorTiles[i],
      health: 50 + Math.floor(Math.random() * 50),
      type: types[Math.floor(Math.random() * types.length)],
    });
  }

  return enemies;
}

function findStartPosition(grid: TileType[][]): Position {
  // Find first floor tile (should be in first room)
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === TileType.Floor) {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

// ============================================
// DUNGEON SCREEN COMPONENT
// ============================================

export const DungeonScreen: FC<DungeonScreenProps> = ({
  onExit,
  onCombat,
  initialHealth = MAX_HEALTH,
  initialGold = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PixelDungeonRenderer | null>(null);
  const animationRef = useRef<number>(0);

  // Generate dungeon on mount
  const [dungeon] = useState(() => generateDungeon());
  const [startPos] = useState(() => findStartPosition(dungeon));

  const [state, setState] = useState<DungeonState>(() => ({
    playerPos: startPos,
    health: initialHealth,
    gold: initialGold,
    explored: new Set<string>(),
    visible: new Set<string>(),
    treasures: generateTreasures(dungeon, 6),
    enemies: generateEnemies(dungeon, [], 4),
    gameOver: false,
    victory: false,
  }));

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new PixelDungeonRenderer(canvasRef.current);
    rendererRef.current = renderer;

    renderer.init().then(() => {
      renderer.setGridSize(DUNGEON_WIDTH, DUNGEON_HEIGHT);
      renderer.resize(window.innerWidth, window.innerHeight);
      renderer.setPlayerPosition(startPos.x, startPos.y, true);
    });

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [startPos]);

  // Update visibility when player moves
  useEffect(() => {
    const newVisible = new Set<string>();
    const newExplored = new Set(state.explored);
    const radius = 3;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = state.playerPos.x + dx;
        const y = state.playerPos.y + dy;
        if (x >= 0 && x < DUNGEON_WIDTH && y >= 0 && y < DUNGEON_HEIGHT) {
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

    // Update renderer player position
    rendererRef.current?.setPlayerPosition(
      state.playerPos.x,
      state.playerPos.y,
      false
    );
  }, [state.playerPos]);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const render = (time: number) => {
      renderer.update(time);
      renderer.clear();

      // Draw all tiles
      for (let y = 0; y < DUNGEON_HEIGHT; y++) {
        for (let x = 0; x < DUNGEON_WIDTH; x++) {
          const key = positionToKey({ x, y });
          const isVisible = state.visible.has(key);
          const isExplored = state.explored.has(key);

          renderer.drawTile(dungeon[y][x], x, y, isVisible, isExplored, time);

          // Draw exit
          if (dungeon[y][x] === TileType.Exit && isVisible) {
            renderer.drawExit(x, y, time);
          }
        }
      }

      // Draw treasures
      for (const treasure of state.treasures) {
        if (!treasure.collected) {
          const key = positionToKey(treasure.position);
          if (state.visible.has(key)) {
            renderer.drawTreasure(
              treasure.position.x,
              treasure.position.y,
              time
            );
          }
        }
      }

      // Draw enemies (visible ones)
      for (const enemy of state.enemies) {
        const key = positionToKey(enemy.position);
        if (state.visible.has(key)) {
          renderer.drawPlayer(enemy.position.x, enemy.position.y, time, true);
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
  }, [state, dungeon]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state.gameOver) return;

      const key = e.key.toLowerCase();
      let dx = 0,
        dy = 0;

      switch (key) {
        case "w":
        case "arrowup":
          dy = -1;
          break;
        case "s":
        case "arrowdown":
          dy = 1;
          break;
        case "a":
        case "arrowleft":
          dx = -1;
          break;
        case "d":
        case "arrowright":
          dx = 1;
          break;
        default:
          return;
      }

      e.preventDefault();

      setState((prev) => {
        const newX = prev.playerPos.x + dx;
        const newY = prev.playerPos.y + dy;

        // Check bounds
        if (
          newX < 0 ||
          newX >= DUNGEON_WIDTH ||
          newY < 0 ||
          newY >= DUNGEON_HEIGHT
        ) {
          return prev;
        }

        // Check collision with walls
        if (dungeon[newY][newX] === TileType.Wall) {
          return prev;
        }

        const newPos = { x: newX, y: newY };
        let newGold = prev.gold;
        let newTreasures = prev.treasures;

        // Check treasure collection
        const treasureIdx = prev.treasures.findIndex(
          (t) => !t.collected && t.position.x === newX && t.position.y === newY
        );
        if (treasureIdx !== -1) {
          newGold += prev.treasures[treasureIdx].amount;
          newTreasures = [...prev.treasures];
          newTreasures[treasureIdx] = {
            ...newTreasures[treasureIdx],
            collected: true,
          };
        }

        // Check enemy collision - trigger combat!
        const enemyIdx = prev.enemies.findIndex(
          (e) => e.position.x === newX && e.position.y === newY
        );
        if (enemyIdx !== -1) {
          // Enter combat with this enemy
          onCombat(prev.enemies[enemyIdx]);
          return prev; // Don't move into enemy tile
        }

        // Check exit
        if (dungeon[newY][newX] === TileType.Exit) {
          return {
            ...prev,
            playerPos: newPos,
            gold: newGold,
            treasures: newTreasures,
            gameOver: true,
            victory: true,
          };
        }

        return {
          ...prev,
          playerPos: newPos,
          gold: newGold,
          treasures: newTreasures,
        };
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.gameOver, dungeon, onCombat]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
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
          WASD - MOVE | FIND THE EXIT
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
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
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
};

export default DungeonScreen;
