import { COLORS, TILE_SIZE, GRID_SIZE, VISIBILITY_RADIUS } from './constants'
import { TileType, Position, TileRenderData } from '../types/game'

// ============================================
// CANVAS RENDERER
// ============================================

export class DungeonRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private tileSize: number = TILE_SIZE
  private offsetX: number = 0
  private offsetY: number = 0
  
  // Cache for performance
  private wallPattern: CanvasPattern | null = null
  private floorPattern: CanvasPattern | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    this.ctx = ctx
    
    // Enable image smoothing for better quality
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  // ============================================
  // RESIZE HANDLING
  // ============================================

  resize(width: number, height: number) {
    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.scale(dpr, dpr)
    
    // Calculate tile size to fit grid in viewport with padding
    const padding = 40
    const availableWidth = width - padding * 2
    const availableHeight = height - padding * 2
    
    this.tileSize = Math.floor(Math.min(
      availableWidth / GRID_SIZE,
      availableHeight / GRID_SIZE
    ))
    
    // Minimum tile size
    this.tileSize = Math.max(this.tileSize, 32)
    
    // Calculate offset to center the grid
    const gridWidth = this.tileSize * GRID_SIZE
    const gridHeight = this.tileSize * GRID_SIZE
    this.offsetX = (width - gridWidth) / 2
    this.offsetY = (height - gridHeight) / 2
  }

  // ============================================
  // CLEAR & BACKGROUND
  // ============================================

  clear() {
    const { width, height } = this.canvas.getBoundingClientRect()
    
    // Draw gradient background
    const gradient = this.ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) / 1.5
    )
    gradient.addColorStop(0, COLORS.abyssLight)
    gradient.addColorStop(0.5, COLORS.abyssMid)
    gradient.addColorStop(1, COLORS.abyssDeep)
    
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, width, height)
  }

  // ============================================
  // TILE RENDERING
  // ============================================

  drawTile(
    tile: TileRenderData,
    animationTime: number = 0
  ) {
    const x = this.offsetX + tile.position.x * this.tileSize
    const y = this.offsetY + tile.position.y * this.tileSize
    const size = this.tileSize
    const padding = 1

    // If not visible or explored, draw fog
    if (!tile.isVisible && !tile.isExplored) {
      this.drawFogTile(x, y, size, 1.0)
      return
    }

    // If explored but not currently visible, draw dimmed
    const dimFactor = tile.isVisible ? 1.0 : 0.5

    // Draw base tile
    switch (tile.type) {
      case TileType.Floor:
        this.drawFloorTile(x, y, size, padding, dimFactor)
        break
      case TileType.Wall:
        this.drawWallTile(x, y, size, padding, dimFactor)
        break
      case TileType.Exit:
        this.drawExitTile(x, y, size, padding, dimFactor, animationTime)
        break
    }

    // Draw treasure if present
    if (tile.hasTreasure && tile.isVisible) {
      this.drawTreasure(x, y, size, animationTime, tile.treasureAmount || 100)
    }

    // Draw player if present
    if (tile.hasPlayer) {
      this.drawPlayer(x, y, size, animationTime)
    }

    // Draw partial fog overlay if explored but not visible
    if (tile.isExplored && !tile.isVisible) {
      this.drawFogTile(x, y, size, 0.4)
    }
  }

  // ============================================
  // FLOOR TILE
  // ============================================

  private drawFloorTile(x: number, y: number, size: number, padding: number, dim: number) {
    const ctx = this.ctx
    
    // Base floor color with subtle gradient
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size)
    gradient.addColorStop(0, this.applyDim(COLORS.floorBase, dim))
    gradient.addColorStop(1, this.applyDim(COLORS.floorHighlight, dim))
    
    ctx.fillStyle = gradient
    ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2)
    
    // Subtle border
    ctx.strokeStyle = this.applyDim(COLORS.floorBorder, dim * 0.5)
    ctx.lineWidth = 1
    ctx.strokeRect(x + padding + 0.5, y + padding + 0.5, size - padding * 2 - 1, size - padding * 2 - 1)
    
    // Add subtle texture dots
    ctx.fillStyle = this.applyDim(COLORS.floorBorder, dim * 0.3)
    const dotSize = 2
    for (let i = 0; i < 3; i++) {
      const dx = x + size * 0.2 + (i * size * 0.3) + Math.sin(x + y + i) * 3
      const dy = y + size * 0.5 + Math.cos(x + y + i) * 5
      ctx.beginPath()
      ctx.arc(dx, dy, dotSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ============================================
  // WALL TILE
  // ============================================

  private drawWallTile(x: number, y: number, size: number, padding: number, dim: number) {
    const ctx = this.ctx
    
    // Dark wall with 3D effect
    ctx.fillStyle = this.applyDim(COLORS.wallBase, dim)
    ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2)
    
    // Top highlight (light source from top)
    ctx.fillStyle = this.applyDim(COLORS.wallHighlight, dim * 0.7)
    ctx.fillRect(x + padding, y + padding, size - padding * 2, 3)
    
    // Left highlight
    ctx.fillRect(x + padding, y + padding, 3, size - padding * 2)
    
    // Bottom shadow
    ctx.fillStyle = this.applyDim('#000000', dim * 0.5)
    ctx.fillRect(x + padding, y + size - padding - 3, size - padding * 2, 3)
    
    // Right shadow
    ctx.fillRect(x + size - padding - 3, y + padding, 3, size - padding * 2)
    
    // Border
    ctx.strokeStyle = this.applyDim(COLORS.wallBorder, dim * 0.6)
    ctx.lineWidth = 1
    ctx.strokeRect(x + padding + 0.5, y + padding + 0.5, size - padding * 2 - 1, size - padding * 2 - 1)
  }

  // ============================================
  // EXIT TILE
  // ============================================

  private drawExitTile(x: number, y: number, size: number, padding: number, dim: number, time: number) {
    const ctx = this.ctx
    const pulse = Math.sin(time * 0.003) * 0.3 + 0.7
    
    // Glow effect
    const glowSize = size * 0.4
    const glowGradient = ctx.createRadialGradient(
      x + size / 2, y + size / 2, 0,
      x + size / 2, y + size / 2, glowSize
    )
    glowGradient.addColorStop(0, `rgba(74, 222, 128, ${0.3 * pulse * dim})`)
    glowGradient.addColorStop(1, 'rgba(74, 222, 128, 0)')
    
    ctx.fillStyle = glowGradient
    ctx.fillRect(x, y, size, size)
    
    // Base tile
    ctx.fillStyle = this.applyDim(COLORS.floorBase, dim)
    ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2)
    
    // Exit portal (circle)
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = this.applyDim(COLORS.exitMain, dim * pulse)
    ctx.fill()
    
    // Inner glow
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * pulse * dim})`
    ctx.fill()
    
    // Border
    ctx.strokeStyle = this.applyDim(COLORS.exitMain, dim)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // ============================================
  // FOG TILE
  // ============================================

  private drawFogTile(x: number, y: number, size: number, opacity: number) {
    const ctx = this.ctx
    
    // Layered fog effect
    const gradient = ctx.createRadialGradient(
      x + size / 2, y + size / 2, 0,
      x + size / 2, y + size / 2, size * 0.8
    )
    gradient.addColorStop(0, `rgba(10, 10, 15, ${opacity * 0.9})`)
    gradient.addColorStop(1, `rgba(10, 10, 15, ${opacity})`)
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, size, size)
  }

  // ============================================
  // TREASURE
  // ============================================

  private drawTreasure(x: number, y: number, size: number, time: number, amount: number) {
    const ctx = this.ctx
    const shimmer = Math.sin(time * 0.005) * 0.3 + 0.7
    const cx = x + size / 2
    const cy = y + size / 2
    const coinSize = size * 0.2
    
    // Glow
    const glowGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.4)
    glowGradient.addColorStop(0, `rgba(255, 215, 0, ${0.4 * shimmer})`)
    glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)')
    ctx.fillStyle = glowGradient
    ctx.fillRect(x, y, size, size)
    
    // Stack of coins (more coins for higher amounts)
    const numCoins = Math.min(Math.floor(amount / 100) + 1, 5)
    
    for (let i = 0; i < numCoins; i++) {
      const offsetX = Math.sin(i * 1.5) * coinSize * 0.3
      const offsetY = -i * 3
      
      // Coin shadow
      ctx.beginPath()
      ctx.ellipse(cx + offsetX + 2, cy + offsetY + 2, coinSize, coinSize * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fill()
      
      // Coin body
      ctx.beginPath()
      ctx.ellipse(cx + offsetX, cy + offsetY, coinSize, coinSize * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.goldMain
      ctx.fill()
      
      // Coin highlight
      ctx.beginPath()
      ctx.ellipse(cx + offsetX - coinSize * 0.3, cy + offsetY - coinSize * 0.1, coinSize * 0.3, coinSize * 0.1, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * shimmer})`
      ctx.fill()
    }
  }

  // ============================================
  // PLAYER
  // ============================================

  drawPlayer(x: number, y: number, size: number, time: number, isLocalPlayer: boolean = true) {
    const ctx = this.ctx
    const cx = x + size / 2
    const cy = y + size / 2
    const radius = size * 0.35
    const pulse = Math.sin(time * 0.004) * 0.15 + 1
    
    const color = isLocalPlayer ? COLORS.playerMain : COLORS.enemyMain
    const glowColor = isLocalPlayer ? COLORS.playerGlow : COLORS.enemyGlow
    
    // Outer glow
    const glowGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2)
    glowGradient.addColorStop(0, glowColor)
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glowGradient
    ctx.fillRect(x, y, size, size)
    
    // Player body (hooded figure silhouette)
    ctx.beginPath()
    ctx.arc(cx, cy - radius * 0.2, radius * pulse, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    
    // Hood/cloak bottom
    ctx.beginPath()
    ctx.moveTo(cx - radius * 0.8, cy)
    ctx.quadraticCurveTo(cx, cy + radius * 1.2, cx + radius * 0.8, cy)
    ctx.fillStyle = color
    ctx.fill()
    
    // Inner glow (face area)
    ctx.beginPath()
    ctx.arc(cx, cy - radius * 0.1, radius * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * pulse})`
    ctx.fill()
    
    // Eyes
    const eyeY = cy - radius * 0.15
    const eyeSpacing = radius * 0.25
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - eyeSpacing, eyeY, 2, 0, Math.PI * 2)
    ctx.arc(cx + eyeSpacing, eyeY, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // ============================================
  // GRID OVERLAY (Debug)
  // ============================================

  drawGridOverlay() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    
    for (let x = 0; x <= GRID_SIZE; x++) {
      const px = this.offsetX + x * this.tileSize
      ctx.beginPath()
      ctx.moveTo(px, this.offsetY)
      ctx.lineTo(px, this.offsetY + GRID_SIZE * this.tileSize)
      ctx.stroke()
    }
    
    for (let y = 0; y <= GRID_SIZE; y++) {
      const py = this.offsetY + y * this.tileSize
      ctx.beginPath()
      ctx.moveTo(this.offsetX, py)
      ctx.lineTo(this.offsetX + GRID_SIZE * this.tileSize, py)
      ctx.stroke()
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  private applyDim(color: string, factor: number): string {
    // If it's already an rgba, just return it
    if (color.startsWith('rgba')) return color
    
    // Convert hex to rgba with dim factor
    const hex = color.replace('#', '')
    const r = Math.floor(parseInt(hex.slice(0, 2), 16) * factor)
    const g = Math.floor(parseInt(hex.slice(2, 4), 16) * factor)
    const b = Math.floor(parseInt(hex.slice(4, 6), 16) * factor)
    return `rgb(${r}, ${g}, ${b})`
  }

  // Get tile at screen coordinates
  getTileAtPosition(screenX: number, screenY: number): Position | null {
    const tileX = Math.floor((screenX - this.offsetX) / this.tileSize)
    const tileY = Math.floor((screenY - this.offsetY) / this.tileSize)
    
    if (tileX >= 0 && tileX < GRID_SIZE && tileY >= 0 && tileY < GRID_SIZE) {
      return { x: tileX, y: tileY }
    }
    return null
  }

  // Get offset values
  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY }
  }

  getTileSize(): number {
    return this.tileSize
  }
}
