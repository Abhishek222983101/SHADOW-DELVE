import { useState, useCallback, useRef, useEffect } from 'react'
import { Position, TileType, positionToKey, GRID_SIZE } from '../types/game'
import { FogOfWar } from '../game/fog'
import { VISIBILITY_RADIUS } from '../game/constants'

// ============================================
// USE VISIBILITY HOOK
// ============================================

interface VisibilityState {
  visibleTiles: Set<string>
  exploredTiles: Set<string>
  revealingTiles: Map<string, number>
}

interface UseVisibilityReturn {
  visibleTiles: Set<string>
  exploredTiles: Set<string>
  revealingTiles: Map<string, number>
  isVisible: (pos: Position) => boolean
  isExplored: (pos: Position) => boolean
  getRevealProgress: (pos: Position) => number
  updateVisibility: (playerPos: Position, grid: TileType[][]) => void
  reset: () => void
}

export function useVisibility(): UseVisibilityReturn {
  const fogRef = useRef<FogOfWar>(new FogOfWar())
  const lastUpdateRef = useRef<number>(performance.now())
  
  const [state, setState] = useState<VisibilityState>({
    visibleTiles: new Set(),
    exploredTiles: new Set(),
    revealingTiles: new Map(),
  })

  const updateVisibility = useCallback((playerPos: Position, grid: TileType[][]) => {
    const now = performance.now()
    const deltaTime = now - lastUpdateRef.current
    lastUpdateRef.current = now

    const result = fogRef.current.update(playerPos, grid, deltaTime)
    
    setState({
      visibleTiles: result.visible,
      exploredTiles: result.explored,
      revealingTiles: result.revealing,
    })
  }, [])

  const isVisible = useCallback((pos: Position): boolean => {
    return state.visibleTiles.has(positionToKey(pos))
  }, [state.visibleTiles])

  const isExplored = useCallback((pos: Position): boolean => {
    return state.exploredTiles.has(positionToKey(pos))
  }, [state.exploredTiles])

  const getRevealProgress = useCallback((pos: Position): number => {
    const key = positionToKey(pos)
    if (state.revealingTiles.has(key)) {
      return state.revealingTiles.get(key)!
    }
    if (state.exploredTiles.has(key)) {
      return 1
    }
    return 0
  }, [state.revealingTiles, state.exploredTiles])

  const reset = useCallback(() => {
    fogRef.current.reset()
    setState({
      visibleTiles: new Set(),
      exploredTiles: new Set(),
      revealingTiles: new Map(),
    })
  }, [])

  return {
    visibleTiles: state.visibleTiles,
    exploredTiles: state.exploredTiles,
    revealingTiles: state.revealingTiles,
    isVisible,
    isExplored,
    getRevealProgress,
    updateVisibility,
    reset,
  }
}

// ============================================
// SIMPLE VISIBILITY CALCULATION (for components that don't need full fog)
// ============================================

export function getSimpleVisibility(playerPos: Position, radius: number = VISIBILITY_RADIUS): Set<string> {
  const visible = new Set<string>()
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = playerPos.x + dx
      const y = playerPos.y + dy
      
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue
      
      // Circular visibility
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= radius + 0.5) {
        visible.add(positionToKey({ x, y }))
      }
    }
  }
  
  return visible
}
