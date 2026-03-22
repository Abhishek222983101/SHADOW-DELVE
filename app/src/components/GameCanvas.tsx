import { useRef, useEffect, useCallback, useState, FC } from 'react'
import { DungeonRenderer } from '../game/renderer'
import { FogOfWar } from '../game/fog'
import { TileType, Position, TileRenderData, GRID_SIZE, positionToKey } from '../types/game'

// ============================================
// DEMO DUNGEON GENERATOR
// ============================================

function generateDemoDungeon(): TileType[][] {
  const grid: TileType[][] = Array(GRID_SIZE).fill(null).map(() => 
    Array(GRID_SIZE).fill(TileType.Floor)
  )
  
  // Border walls
  for (let i = 0; i < GRID_SIZE; i++) {
    grid[0][i] = TileType.Wall
    grid[GRID_SIZE - 1][i] = TileType.Wall
    grid[i][0] = TileType.Wall
    grid[i][GRID_SIZE - 1] = TileType.Wall
  }
  
  // Internal walls - creates rooms and corridors
  // Left room wall
  for (let y = 2; y < 5; y++) grid[y][3] = TileType.Wall
  for (let y = 6; y < 9; y++) grid[y][3] = TileType.Wall
  
  // Right room wall
  for (let y = 2; y < 5; y++) grid[y][7] = TileType.Wall
  for (let y = 6; y < 9; y++) grid[y][7] = TileType.Wall
  
  // Horizontal divider (center)
  for (let x = 2; x < 5; x++) grid[5][x] = TileType.Wall
  for (let x = 6; x < 9; x++) grid[5][x] = TileType.Wall
  
  // Corner rooms
  grid[2][8] = TileType.Wall
  grid[2][9] = TileType.Wall
  grid[3][8] = TileType.Wall
  
  grid[7][1] = TileType.Wall
  grid[8][1] = TileType.Wall
  grid[8][2] = TileType.Wall
  
  // Exit in the center
  grid[5][5] = TileType.Exit
  
  return grid
}

// Demo treasures
const DEMO_TREASURES: { position: Position; amount: number; collected: boolean }[] = [
  { position: { x: 2, y: 2 }, amount: 150, collected: false },
  { position: { x: 8, y: 2 }, amount: 200, collected: false },
  { position: { x: 5, y: 8 }, amount: 300, collected: false },
  { position: { x: 1, y: 5 }, amount: 100, collected: false },
  { position: { x: 9, y: 7 }, amount: 250, collected: false },
]

// ============================================
// GAME CANVAS COMPONENT
// ============================================

interface GameCanvasProps {
  playerPosition?: Position
  onPositionChange?: (pos: Position) => void
  onTreasureCollect?: (amount: number) => void
  onExitReached?: () => void
  onTileClick?: (pos: Position) => void
}

export const GameCanvas: FC<GameCanvasProps> = ({
  playerPosition: externalPosition,
  onPositionChange,
  onTreasureCollect,
  onExitReached,
  onTileClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<DungeonRenderer | null>(null)
  const fogRef = useRef<FogOfWar>(new FogOfWar())
  const animationRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(performance.now())
  
  const [dungeon] = useState(() => generateDemoDungeon())
  const [treasures, setTreasures] = useState(() => [...DEMO_TREASURES])
  const [playerPos, setPlayerPos] = useState<Position>({ x: 1, y: 1 })
  const [visibilityState, setVisibilityState] = useState({
    visible: new Set<string>(),
    explored: new Set<string>(),
    revealing: new Map<string, number>(),
  })
  
  // Use external position if provided
  const currentPos = externalPosition ?? playerPos

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    rendererRef.current = new DungeonRenderer(canvas)
    
    const handleResize = () => {
      rendererRef.current?.resize(window.innerWidth, window.innerHeight)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Update fog when player moves
  useEffect(() => {
    const now = performance.now()
    const delta = now - lastFrameTimeRef.current
    lastFrameTimeRef.current = now
    
    const result = fogRef.current.update(currentPos, dungeon, delta)
    setVisibilityState({
      visible: result.visible,
      explored: result.explored,
      revealing: result.revealing,
    })
  }, [currentPos, dungeon])

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    const render = (time: number) => {
      // Update fog animation
      const delta = time - lastFrameTimeRef.current
      if (delta > 16) { // Cap at ~60fps for fog updates
        const result = fogRef.current.update(currentPos, dungeon, delta)
        setVisibilityState({
          visible: result.visible,
          explored: result.explored,
          revealing: result.revealing,
        })
        lastFrameTimeRef.current = time
      }

      renderer.clear()
      
      // Render all tiles
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const pos = { x, y }
          const key = positionToKey(pos)
          const isVisible = visibilityState.visible.has(key)
          const isExplored = visibilityState.explored.has(key)
          
          // Check for treasure at this position
          const treasure = treasures.find(
            t => t.position.x === x && t.position.y === y && !t.collected
          )
          
          // Calculate reveal progress for animation
          const revealProgress = visibilityState.revealing.get(key) ?? (isExplored ? 1 : 0)
          
          const tile: TileRenderData = {
            type: dungeon[y][x],
            position: pos,
            isVisible,
            isExplored: isExplored || revealProgress > 0,
            hasTreasure: !!treasure && (isVisible || (isExplored && revealProgress === 1)),
            treasureAmount: treasure?.amount,
            isExit: dungeon[y][x] === TileType.Exit,
            hasPlayer: currentPos.x === x && currentPos.y === y,
          }
          
          renderer.drawTile(tile, time)
        }
      }
      
      animationRef.current = requestAnimationFrame(render)
    }
    
    animationRef.current = requestAnimationFrame(render)
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [dungeon, currentPos, treasures, visibilityState])

  // Movement handler
  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const newPos = { ...currentPos }
    
    switch (direction) {
      case 'up': newPos.y = Math.max(0, newPos.y - 1); break
      case 'down': newPos.y = Math.min(GRID_SIZE - 1, newPos.y + 1); break
      case 'left': newPos.x = Math.max(0, newPos.x - 1); break
      case 'right': newPos.x = Math.min(GRID_SIZE - 1, newPos.x + 1); break
    }
    
    // Collision check
    if (dungeon[newPos.y][newPos.x] === TileType.Wall) return
    
    // Update position
    if (!externalPosition) {
      setPlayerPos(newPos)
    }
    onPositionChange?.(newPos)
    
    // Check for treasure collection
    const treasureIndex = treasures.findIndex(
      t => t.position.x === newPos.x && t.position.y === newPos.y && !t.collected
    )
    if (treasureIndex !== -1) {
      const amount = treasures[treasureIndex].amount
      setTreasures(prev => {
        const next = [...prev]
        next[treasureIndex] = { ...next[treasureIndex], collected: true }
        return next
      })
      onTreasureCollect?.(amount)
    }
    
    // Check for exit
    if (dungeon[newPos.y][newPos.x] === TileType.Exit) {
      onExitReached?.()
    }
  }, [currentPos, dungeon, treasures, externalPosition, onPositionChange, onTreasureCollect, onExitReached])

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
      
      const key = e.key.toLowerCase()
      switch (key) {
        case 'w':
        case 'arrowup':
          handleMove('up')
          break
        case 's':
        case 'arrowdown':
          handleMove('down')
          break
        case 'a':
        case 'arrowleft':
          handleMove('left')
          break
        case 'd':
        case 'arrowright':
          handleMove('right')
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current
    if (!renderer) return
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const tilePos = renderer.getTileAtPosition(e.clientX - rect.left, e.clientY - rect.top)
    if (tilePos) onTileClick?.(tilePos)
  }, [onTileClick])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="block w-full h-full cursor-crosshair focus:outline-none"
      style={{ touchAction: 'none' }}
      tabIndex={0}
    />
  )
}
