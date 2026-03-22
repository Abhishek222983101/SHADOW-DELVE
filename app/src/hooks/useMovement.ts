import { useState, useCallback, useRef, useEffect } from 'react'
import { Position, Direction, TileType, GRID_SIZE, getNextPosition, isValidPosition } from '../types/game'
import { MOVE_ANIMATION_DURATION } from '../game/constants'

// ============================================
// MOVEMENT STATE
// ============================================

interface MovementState {
  position: Position
  targetPosition: Position
  isMoving: boolean
  animationProgress: number
  lastMoveTime: number
  direction: Direction | null
}

interface UseMovementReturn {
  position: Position
  targetPosition: Position
  isMoving: boolean
  animationProgress: number
  direction: Direction | null
  move: (direction: Direction) => boolean
  setPosition: (pos: Position) => void
  canMove: (direction: Direction) => boolean
}

// ============================================
// USE MOVEMENT HOOK
// ============================================

export function useMovement(
  initialPosition: Position,
  grid: TileType[][],
  options?: {
    onMove?: (from: Position, to: Position, direction: Direction) => void
    onMoveComplete?: (position: Position) => void
    onCollision?: (direction: Direction) => void
    moveCooldown?: number
  }
): UseMovementReturn {
  const {
    onMove,
    onMoveComplete,
    onCollision,
    moveCooldown = 100, // Minimum time between moves
  } = options || {}

  const [state, setState] = useState<MovementState>({
    position: initialPosition,
    targetPosition: initialPosition,
    isMoving: false,
    animationProgress: 0,
    lastMoveTime: 0,
    direction: null,
  })

  const animationFrameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  // Check if a move is valid
  const canMove = useCallback((direction: Direction): boolean => {
    const nextPos = getNextPosition(state.position, direction)
    
    // Bounds check
    if (!isValidPosition(nextPos)) return false
    
    // Wall collision check
    if (grid[nextPos.y]?.[nextPos.x] === TileType.Wall) return false
    
    return true
  }, [state.position, grid])

  // Perform movement
  const move = useCallback((direction: Direction): boolean => {
    const now = performance.now()
    
    // Check cooldown
    if (now - state.lastMoveTime < moveCooldown) return false
    
    // Check if already moving
    if (state.isMoving) return false
    
    // Check if move is valid
    if (!canMove(direction)) {
      onCollision?.(direction)
      return false
    }

    const nextPos = getNextPosition(state.position, direction)
    
    // Start movement animation
    setState(prev => ({
      ...prev,
      targetPosition: nextPos,
      isMoving: true,
      animationProgress: 0,
      lastMoveTime: now,
      direction,
    }))
    
    startTimeRef.current = now
    onMove?.(state.position, nextPos, direction)
    
    return true
  }, [state, canMove, moveCooldown, onMove, onCollision])

  // Animation loop
  useEffect(() => {
    if (!state.isMoving) return

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / MOVE_ANIMATION_DURATION, 1)
      
      if (progress >= 1) {
        // Animation complete
        setState(prev => ({
          ...prev,
          position: prev.targetPosition,
          isMoving: false,
          animationProgress: 1,
          direction: null,
        }))
        onMoveComplete?.(state.targetPosition)
      } else {
        // Update progress
        setState(prev => ({
          ...prev,
          animationProgress: easeOutCubic(progress),
        }))
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [state.isMoving, state.targetPosition, onMoveComplete])

  // Set position directly (for teleporting/respawning)
  const setPosition = useCallback((pos: Position) => {
    setState(prev => ({
      ...prev,
      position: pos,
      targetPosition: pos,
      isMoving: false,
      animationProgress: 0,
    }))
  }, [])

  return {
    position: state.position,
    targetPosition: state.targetPosition,
    isMoving: state.isMoving,
    animationProgress: state.animationProgress,
    direction: state.direction,
    move,
    setPosition,
    canMove,
  }
}

// ============================================
// EASING FUNCTION
// ============================================

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// ============================================
// INTERPOLATE POSITION
// ============================================

export function interpolatePosition(
  from: Position,
  to: Position,
  progress: number
): { x: number; y: number } {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  }
}

// ============================================
// KEYBOARD INPUT HOOK
// ============================================

export function useKeyboardMovement(
  move: (direction: Direction) => boolean,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys
      const gameKeys = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (gameKeys.includes(e.key)) {
        e.preventDefault()
      }

      const key = e.key.toLowerCase()
      switch (key) {
        case 'w':
        case 'arrowup':
          move(Direction.Up)
          break
        case 's':
        case 'arrowdown':
          move(Direction.Down)
          break
        case 'a':
        case 'arrowleft':
          move(Direction.Left)
          break
        case 'd':
        case 'arrowright':
          move(Direction.Right)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [move, enabled])
}
