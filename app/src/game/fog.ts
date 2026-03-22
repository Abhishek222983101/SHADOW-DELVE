import { Position, TileType, GRID_SIZE, positionToKey, keyToPosition } from '../types/game'
import { VISIBILITY_RADIUS } from './constants'

// ============================================
// FOG OF WAR SYSTEM
// ============================================

export class FogOfWar {
  private exploredTiles: Set<string> = new Set()
  private visibleTiles: Set<string> = new Set()
  private revealingTiles: Map<string, number> = new Map() // key -> reveal progress (0-1)
  
  // Animation timing
  private readonly REVEAL_DURATION = 300 // ms to fully reveal a tile

  // ============================================
  // VISIBILITY CALCULATION
  // ============================================

  /**
   * Calculate which tiles are visible from a position
   * Uses simple radius check (can be upgraded to raycasting later)
   */
  calculateVisibility(
    playerPos: Position,
    grid: TileType[][],
    useLineOfSight: boolean = true
  ): Set<string> {
    const visible = new Set<string>()
    const radius = VISIBILITY_RADIUS

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = playerPos.x + dx
        const y = playerPos.y + dy

        // Bounds check
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue

        // Distance check (circular visibility)
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > radius + 0.5) continue

        // Line of sight check (optional)
        if (useLineOfSight && !this.hasLineOfSight(playerPos, { x, y }, grid)) {
          continue
        }

        visible.add(positionToKey({ x, y }))
      }
    }

    return visible
  }

  /**
   * Simple line of sight check using Bresenham's algorithm
   */
  private hasLineOfSight(from: Position, to: Position, grid: TileType[][]): boolean {
    // Player position always visible
    if (from.x === to.x && from.y === to.y) return true

    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    const sx = from.x < to.x ? 1 : -1
    const sy = from.y < to.y ? 1 : -1

    let err = dx - dy
    let x = from.x
    let y = from.y

    while (true) {
      // Skip starting position
      if (x !== from.x || y !== from.y) {
        // Check if this tile blocks vision
        if (grid[y] && grid[y][x] === TileType.Wall) {
          // Wall at destination is still visible (you can see the wall)
          if (x === to.x && y === to.y) return true
          return false
        }
      }

      // Reached destination
      if (x === to.x && y === to.y) break

      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        x += sx
      }
      if (e2 < dx) {
        err += dx
        y += sy
      }
    }

    return true
  }

  // ============================================
  // UPDATE & ANIMATION
  // ============================================

  /**
   * Update fog state based on player position
   * Returns tiles that need re-rendering
   */
  update(
    playerPos: Position,
    grid: TileType[][],
    deltaTime: number
  ): { visible: Set<string>; explored: Set<string>; revealing: Map<string, number> } {
    // Calculate new visibility
    const newVisible = this.calculateVisibility(playerPos, grid, true)

    // Find newly visible tiles (start reveal animation)
    newVisible.forEach(key => {
      if (!this.exploredTiles.has(key)) {
        this.revealingTiles.set(key, 0)
      }
    })

    // Update reveal animations
    this.revealingTiles.forEach((progress, key) => {
      const newProgress = progress + (deltaTime / this.REVEAL_DURATION)
      if (newProgress >= 1) {
        this.revealingTiles.delete(key)
        this.exploredTiles.add(key)
      } else {
        this.revealingTiles.set(key, newProgress)
      }
    })

    // Add all visible tiles to explored
    newVisible.forEach(key => this.exploredTiles.add(key))

    this.visibleTiles = newVisible

    return {
      visible: this.visibleTiles,
      explored: this.exploredTiles,
      revealing: this.revealingTiles,
    }
  }

  // ============================================
  // QUERIES
  // ============================================

  isVisible(pos: Position): boolean {
    return this.visibleTiles.has(positionToKey(pos))
  }

  isExplored(pos: Position): boolean {
    return this.exploredTiles.has(positionToKey(pos))
  }

  getRevealProgress(pos: Position): number {
    const key = positionToKey(pos)
    if (this.revealingTiles.has(key)) {
      return this.revealingTiles.get(key)!
    }
    if (this.exploredTiles.has(key)) {
      return 1
    }
    return 0
  }

  getVisibleTiles(): Set<string> {
    return new Set(this.visibleTiles)
  }

  getExploredTiles(): Set<string> {
    return new Set(this.exploredTiles)
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  reset() {
    this.exploredTiles.clear()
    this.visibleTiles.clear()
    this.revealingTiles.clear()
  }

  setExplored(tiles: Set<string>) {
    this.exploredTiles = new Set(tiles)
  }

  // For saving/loading game state
  serialize(): string[] {
    return Array.from(this.exploredTiles)
  }

  deserialize(tiles: string[]) {
    this.exploredTiles = new Set(tiles)
  }
}

// ============================================
// FOG RENDERING UTILITIES
// ============================================

/**
 * Calculate fog opacity for a tile based on visibility state
 */
export function getFogOpacity(
  isVisible: boolean,
  isExplored: boolean,
  revealProgress: number
): number {
  if (isVisible) {
    // Currently visible - no fog, or revealing
    if (revealProgress < 1) {
      return 1 - revealProgress
    }
    return 0
  }

  if (isExplored) {
    // Explored but not visible - partial fog
    return 0.5
  }

  // Never seen - full fog
  return 1
}

/**
 * Get fog color based on distance from visible area
 */
export function getFogColor(opacity: number): string {
  // Darker as opacity increases
  const base = 10 // RGB value for darkest fog
  const r = Math.floor(base * (1 + opacity * 0.1))
  const g = Math.floor(base * (1 + opacity * 0.1))
  const b = Math.floor(base * (1 + opacity * 0.5)) // Slightly blue tint
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let fogInstance: FogOfWar | null = null

export function getFogOfWar(): FogOfWar {
  if (!fogInstance) {
    fogInstance = new FogOfWar()
  }
  return fogInstance
}

export function resetFogOfWar(): void {
  if (fogInstance) {
    fogInstance.reset()
  }
  fogInstance = null
}
