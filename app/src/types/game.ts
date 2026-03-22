import { PublicKey } from '@solana/web3.js'

// ============================================
// GAME CONSTANTS
// ============================================

export const GRID_SIZE = 11
export const TILE_SIZE = 64
export const VISIBILITY_RADIUS = 2
export const MAX_HEALTH = 100
export const COMBAT_RANGE = 2

// ============================================
// TILE TYPES
// ============================================

export enum TileType {
  Floor = 'Floor',
  Wall = 'Wall',
  Exit = 'Exit',
}

// ============================================
// DIRECTION
// ============================================

export enum Direction {
  Up = 'Up',
  Down = 'Down',
  Left = 'Left',
  Right = 'Right',
}

// ============================================
// COMBAT ACTION
// ============================================

export enum CombatAction {
  Attack = 'Attack',
  Block = 'Block',
  Dodge = 'Dodge',
  Heavy = 'Heavy',
}

// ============================================
// MATCH STATUS
// ============================================

export enum MatchStatus {
  Waiting = 'Waiting',
  Ready = 'Ready',
  Active = 'Active',
  Ended = 'Ended',
}

// ============================================
// GAME STATE TYPES
// ============================================

export interface Position {
  x: number
  y: number
}

export interface Treasure {
  position: Position
  amount: number
  collected: boolean
}

export interface PlayerState {
  player: PublicKey | null
  matchId: number
  position: Position
  health: number
  gold: number
  isAlive: boolean
}

export interface DungeonState {
  matchId: number
  grid: TileType[][]
  treasures: Treasure[]
  exitPos: Position
  spawn1: Position
  spawn2: Position
}

export interface MatchState {
  matchId: number
  player1: PublicKey | null
  player2: PublicKey | null
  status: MatchStatus
  winner: PublicKey | null
  vrfSeed: number[]
  createdAt: number
  endedAt: number | null
}

export interface CombatState {
  matchId: number
  player1Action: CombatAction | null
  player2Action: CombatAction | null
  resolved: boolean
}

export interface CombatResult {
  winner: PublicKey | null
  loser: PublicKey | null
  damageDealt: number
  isCritical: boolean
  player1Action: CombatAction
  player2Action: CombatAction
}

// ============================================
// MOVE RESULT
// ============================================

export interface MoveResult {
  newPosition: Position
  foundTreasure: boolean
  treasureAmount: number
  reachedExit: boolean
  enemyNearby: boolean
}

// ============================================
// GAME CONTEXT STATE
// ============================================

export interface GameState {
  // Connection state
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // Match state
  matchState: MatchState | null
  playerState: PlayerState | null
  dungeonState: DungeonState | null
  combatState: CombatState | null

  // Local state (for rendering)
  exploredTiles: Set<string>
  visibleTiles: Set<string>
  playerPosition: Position
  isMoving: boolean
  enemyNearby: boolean
}

// ============================================
// RENDERING TYPES
// ============================================

export interface TileRenderData {
  type: TileType
  position: Position
  isVisible: boolean
  isExplored: boolean
  hasTreasure: boolean
  treasureAmount?: number
  isExit: boolean
  hasPlayer: boolean
}

export interface CanvasRenderState {
  tiles: TileRenderData[][]
  playerPosition: Position
  playerTargetPosition: Position
  animationProgress: number
}

// ============================================
// UTILITY TYPES
// ============================================

export type DirectionKey = 'w' | 'a' | 's' | 'd' | 'W' | 'A' | 'S' | 'D' | 
                           'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export const keyToDirection: Record<DirectionKey, Direction> = {
  'w': Direction.Up,
  'W': Direction.Up,
  'ArrowUp': Direction.Up,
  'a': Direction.Left,
  'A': Direction.Left,
  'ArrowLeft': Direction.Left,
  's': Direction.Down,
  'S': Direction.Down,
  'ArrowDown': Direction.Down,
  'd': Direction.Right,
  'D': Direction.Right,
  'ArrowRight': Direction.Right,
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`
}

export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

export function getVisiblePositions(center: Position, radius: number = VISIBILITY_RADIUS): Position[] {
  const positions: Position[] = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = center.x + dx
      const y = center.y + dy
      if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        positions.push({ x, y })
      }
    }
  }
  return positions
}

export function isValidPosition(pos: Position): boolean {
  return pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE
}

export function getNextPosition(pos: Position, direction: Direction): Position {
  switch (direction) {
    case Direction.Up:
      return { x: pos.x, y: pos.y - 1 }
    case Direction.Down:
      return { x: pos.x, y: pos.y + 1 }
    case Direction.Left:
      return { x: pos.x - 1, y: pos.y }
    case Direction.Right:
      return { x: pos.x + 1, y: pos.y }
  }
}

// Buffer type augmentation for window
declare global {
  interface Window {
    Buffer: typeof Buffer
  }
}
