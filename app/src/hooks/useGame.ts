import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  Position,
  Direction,
  TileType,
  MatchStatus,
  GRID_SIZE,
  positionToKey,
} from "../types/game";
import { getShadowDelveClient } from "../game/anchor";
import { MAX_HEALTH } from "../game/constants";

// ============================================
// GAME STATE
// ============================================

export interface GameState {
  // Match info
  matchId: BN | null;
  status: MatchStatus;
  isPlayer1: boolean;

  // Player state
  playerPosition: Position;
  health: number;
  gold: number;
  isAlive: boolean;

  // Dungeon state
  grid: TileType[][] | null;
  treasures: { position: Position; amount: number; collected: boolean }[];
  exitPosition: Position | null;
  exploredTiles: Set<string>;

  // Game flow
  isLoading: boolean;
  error: string | null;

  // Events
  enemyNearby: boolean;
  lastTreasureCollected: number | null;
  reachedExit: boolean;
}

const initialState: GameState = {
  matchId: null,
  status: MatchStatus.Waiting,
  isPlayer1: true,

  playerPosition: { x: 1, y: 1 },
  health: MAX_HEALTH,
  gold: 0,
  isAlive: true,

  grid: null,
  treasures: [],
  exitPosition: null,
  exploredTiles: new Set(),

  isLoading: false,
  error: null,

  enemyNearby: false,
  lastTreasureCollected: null,
  reachedExit: false,
};

// ============================================
// USE GAME HOOK
// ============================================

export function useGame() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<GameState>(initialState);
  const clientRef = useRef(getShadowDelveClient());

  // Update client wallet when connected
  useEffect(() => {
    if (connected && publicKey) {
      // We'll need to cast the wallet adapter to AnchorWallet
      // For now, the client will work in read-only mode
    }
  }, [connected, publicKey]);

  // ============================================
  // DEMO MODE (Local game without chain)
  // ============================================

  const startDemoGame = useCallback(() => {
    // Generate demo dungeon
    const grid = generateDemoDungeon();
    const treasures = generateDemoTreasures();

    setState((prev) => ({
      ...prev,
      matchId: new BN(Date.now()),
      status: MatchStatus.Active,
      isPlayer1: true,
      playerPosition: { x: 1, y: 1 },
      health: MAX_HEALTH,
      gold: 0,
      isAlive: true,
      grid,
      treasures,
      exitPosition: { x: 5, y: 5 },
      exploredTiles: new Set(),
      error: null,
      enemyNearby: false,
      lastTreasureCollected: null,
      reachedExit: false,
    }));
  }, []);

  const resetGame = useCallback(() => {
    setState(initialState);
  }, []);

  // ============================================
  // MOVEMENT
  // ============================================

  const movePlayer = useCallback(
    (direction: Direction): boolean => {
      if (
        !state.grid ||
        !state.isAlive ||
        state.status !== MatchStatus.Active
      ) {
        return false;
      }

      const { playerPosition, grid } = state;
      let newPos: Position;

      switch (direction) {
        case Direction.Up:
          newPos = { x: playerPosition.x, y: playerPosition.y - 1 };
          break;
        case Direction.Down:
          newPos = { x: playerPosition.x, y: playerPosition.y + 1 };
          break;
        case Direction.Left:
          newPos = { x: playerPosition.x - 1, y: playerPosition.y };
          break;
        case Direction.Right:
          newPos = { x: playerPosition.x + 1, y: playerPosition.y };
          break;
      }

      // Bounds check
      if (
        newPos.x < 0 ||
        newPos.x >= GRID_SIZE ||
        newPos.y < 0 ||
        newPos.y >= GRID_SIZE
      ) {
        return false;
      }

      // Wall collision
      if (grid[newPos.y][newPos.x] === TileType.Wall) {
        return false;
      }

      // Update position and explored tiles
      setState((prev) => {
        const newExplored = new Set(prev.exploredTiles);

        // Add visible tiles to explored (5x5 around new position)
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const x = newPos.x + dx;
            const y = newPos.y + dy;
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
              newExplored.add(positionToKey({ x, y }));
            }
          }
        }

        return {
          ...prev,
          playerPosition: newPos,
          exploredTiles: newExplored,
        };
      });

      // Check for treasure
      checkTreasure(newPos);

      // Check for exit
      checkExit(newPos);

      return true;
    },
    [state]
  );

  // ============================================
  // TREASURE COLLECTION
  // ============================================

  const checkTreasure = useCallback((pos: Position) => {
    setState((prev) => {
      const treasureIndex = prev.treasures.findIndex(
        (t) => t.position.x === pos.x && t.position.y === pos.y && !t.collected
      );

      if (treasureIndex === -1) return prev;

      const treasure = prev.treasures[treasureIndex];
      const newTreasures = [...prev.treasures];
      newTreasures[treasureIndex] = { ...treasure, collected: true };

      return {
        ...prev,
        treasures: newTreasures,
        gold: prev.gold + treasure.amount,
        lastTreasureCollected: treasure.amount,
      };
    });
  }, []);

  const clearTreasureNotification = useCallback(() => {
    setState((prev) => ({ ...prev, lastTreasureCollected: null }));
  }, []);

  // ============================================
  // EXIT CHECK
  // ============================================

  const checkExit = useCallback((pos: Position) => {
    setState((prev) => {
      if (!prev.exitPosition) return prev;
      if (pos.x !== prev.exitPosition.x || pos.y !== prev.exitPosition.y)
        return prev;

      return {
        ...prev,
        reachedExit: true,
        status: MatchStatus.Ended,
      };
    });
  }, []);

  // ============================================
  // CHAIN OPERATIONS (for future use)
  // ============================================

  const createMatchOnChain = useCallback(async () => {
    if (!connected || !publicKey) {
      setState((prev) => ({ ...prev, error: "Wallet not connected" }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const matchId = clientRef.current.generateMatchId();
      const tx = await clientRef.current.createMatch(matchId);

      setState((prev) => ({
        ...prev,
        matchId,
        status: MatchStatus.Waiting,
        isLoading: false,
      }));

      return tx;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to create match",
        isLoading: false,
      }));
    }
  }, [connected, publicKey]);

  const movePlayerOnChain = useCallback(
    async (direction: Direction) => {
      if (!state.matchId || !connected) return;

      try {
        // Note: In real PvP, we need the opponent's public key
        // This is a placeholder for demo mode - chain operations will be
        // handled by the LobbyScreen/DungeonScreen with proper opponent tracking
        console.log("Chain move not available in demo mode");
      } catch (err) {
        console.error("Chain move failed:", err);
        // Fall back to local movement in demo mode
      }
    },
    [state.matchId, connected]
  );

  return {
    // State
    ...state,

    // Actions
    startDemoGame,
    resetGame,
    movePlayer,
    clearTreasureNotification,

    // Chain actions (future)
    createMatchOnChain,
    movePlayerOnChain,
  };
}

// ============================================
// DEMO GENERATION HELPERS
// ============================================

function generateDemoDungeon(): TileType[][] {
  const grid: TileType[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(TileType.Floor));

  // Border
  for (let i = 0; i < GRID_SIZE; i++) {
    grid[0][i] = TileType.Wall;
    grid[GRID_SIZE - 1][i] = TileType.Wall;
    grid[i][0] = TileType.Wall;
    grid[i][GRID_SIZE - 1] = TileType.Wall;
  }

  // Internal walls
  for (let y = 2; y < 5; y++) {
    grid[y][3] = TileType.Wall;
    grid[y][7] = TileType.Wall;
  }
  for (let y = 6; y < 9; y++) {
    grid[y][3] = TileType.Wall;
    grid[y][7] = TileType.Wall;
  }
  for (let x = 2; x < 5; x++) grid[5][x] = TileType.Wall;
  for (let x = 6; x < 9; x++) grid[5][x] = TileType.Wall;

  // Corner rooms
  grid[2][8] = TileType.Wall;
  grid[2][9] = TileType.Wall;
  grid[3][8] = TileType.Wall;
  grid[7][1] = TileType.Wall;
  grid[8][1] = TileType.Wall;
  grid[8][2] = TileType.Wall;

  // Exit
  grid[5][5] = TileType.Exit;

  return grid;
}

function generateDemoTreasures() {
  return [
    { position: { x: 2, y: 2 }, amount: 150, collected: false },
    { position: { x: 8, y: 2 }, amount: 200, collected: false },
    { position: { x: 5, y: 8 }, amount: 300, collected: false },
    { position: { x: 1, y: 5 }, amount: 100, collected: false },
    { position: { x: 9, y: 7 }, amount: 250, collected: false },
  ];
}
