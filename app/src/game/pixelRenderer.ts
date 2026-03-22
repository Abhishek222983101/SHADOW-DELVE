import { DUNGEON_TILESET, loadImage } from "./tilesets";
import { TileType, Position } from "../types/game";
import { SpriteAnimator } from "./spriteAnimator";
import { WARRIOR_CONFIG } from "./spriteData";

// ============================================
// ENHANCED DUNGEON RENDERER
// With camera follow, larger maps, smooth fog, actual sprites
// ============================================

const TILE_RENDER_SIZE = 48; // Render size on screen (scaled up from 16px tiles)

export class PixelDungeonRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private tilesetImg: HTMLImageElement | null = null;
  private renderSize: number = TILE_RENDER_SIZE;

  // Camera system
  private cameraX: number = 0;
  private cameraY: number = 0;
  private targetCameraX: number = 0;
  private targetCameraY: number = 0;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;

  // Map dimensions (now configurable)
  private gridWidth: number = 11;
  private gridHeight: number = 11;

  // Player sprite
  private playerSprite: SpriteAnimator | null = null;
  private playerWorldX: number = 0;
  private playerWorldY: number = 0;
  private playerTargetX: number = 0;
  private playerTargetY: number = 0;
  private isPlayerMoving: boolean = false;

  // Animation
  private lastTime: number = 0;
  private ambientTime: number = 0;

  // Decorations (torches, bones, etc.)
  private decorations: Map<string, { type: string; variant: number }> =
    new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  async init(): Promise<void> {
    this.tilesetImg = await loadImage(DUNGEON_TILESET.src);
    this.playerSprite = new SpriteAnimator(WARRIOR_CONFIG);
    await this.playerSprite.load();
  }

  setGridSize(width: number, height: number): void {
    this.gridWidth = width;
    this.gridHeight = height;
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    this.viewportWidth = width;
    this.viewportHeight = height;

    // Calculate optimal tile size for visibility
    const tilesVisible = 12; // How many tiles fit on screen
    this.renderSize = Math.floor(Math.min(width, height) / tilesVisible);
    this.renderSize = Math.max(this.renderSize, 40);
    this.renderSize = Math.min(this.renderSize, 64);
  }

  // Set player position (in grid coordinates)
  setPlayerPosition(
    gridX: number,
    gridY: number,
    immediate: boolean = false
  ): void {
    this.playerTargetX = gridX * this.renderSize + this.renderSize / 2;
    this.playerTargetY = gridY * this.renderSize + this.renderSize / 2;

    if (immediate) {
      this.playerWorldX = this.playerTargetX;
      this.playerWorldY = this.playerTargetY;
    }

    this.isPlayerMoving = !immediate;
  }

  // Update camera to follow player
  private updateCamera(): void {
    // Target camera to center on player
    this.targetCameraX = this.playerWorldX - this.viewportWidth / 2;
    this.targetCameraY = this.playerWorldY - this.viewportHeight / 2;

    // Clamp to map bounds
    const maxCameraX = this.gridWidth * this.renderSize - this.viewportWidth;
    const maxCameraY = this.gridHeight * this.renderSize - this.viewportHeight;
    this.targetCameraX = Math.max(0, Math.min(this.targetCameraX, maxCameraX));
    this.targetCameraY = Math.max(0, Math.min(this.targetCameraY, maxCameraY));

    // Smooth camera follow
    const smoothing = 0.15;
    this.cameraX += (this.targetCameraX - this.cameraX) * smoothing;
    this.cameraY += (this.targetCameraY - this.cameraY) * smoothing;
  }

  // Update animations
  update(time: number): void {
    const deltaTime = this.lastTime ? time - this.lastTime : 16;
    this.lastTime = time;
    this.ambientTime += deltaTime;

    // Smooth player movement
    if (this.isPlayerMoving) {
      const dx = this.playerTargetX - this.playerWorldX;
      const dy = this.playerTargetY - this.playerWorldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2) {
        this.playerWorldX = this.playerTargetX;
        this.playerWorldY = this.playerTargetY;
        this.isPlayerMoving = false;
        this.playerSprite?.setAnimation("idle");
      } else {
        const speed = 6;
        this.playerWorldX += (dx / dist) * speed;
        this.playerWorldY += (dy / dist) * speed;
        this.playerSprite?.setAnimation("run");

        // Set direction
        if (Math.abs(dx) > Math.abs(dy)) {
          this.playerSprite?.setDirection(dx > 0 ? "right" : "left");
        }
      }
    }

    // Update sprite animation
    this.playerSprite?.update(deltaTime);

    // Update camera
    this.updateCamera();
  }

  clear(): void {
    // Deep void background
    const gradient = this.ctx.createRadialGradient(
      this.viewportWidth / 2,
      this.viewportHeight / 2,
      0,
      this.viewportWidth / 2,
      this.viewportHeight / 2,
      Math.max(this.viewportWidth, this.viewportHeight) * 0.7
    );
    gradient.addColorStop(0, "#12121f");
    gradient.addColorStop(0.5, "#0a0a14");
    gradient.addColorStop(1, "#050508");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  // Convert grid position to screen position
  private gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * this.renderSize - this.cameraX,
      y: gridY * this.renderSize - this.cameraY,
    };
  }

  // Check if tile is visible on screen
  private isTileOnScreen(gridX: number, gridY: number): boolean {
    const { x, y } = this.gridToScreen(gridX, gridY);
    return (
      x > -this.renderSize &&
      x < this.viewportWidth + this.renderSize &&
      y > -this.renderSize &&
      y < this.viewportHeight + this.renderSize
    );
  }

  drawTile(
    tileType: TileType,
    gridX: number,
    gridY: number,
    isVisible: boolean,
    isExplored: boolean,
    time: number
  ): void {
    if (!this.isTileOnScreen(gridX, gridY)) return;

    const { x, y } = this.gridToScreen(gridX, gridY);
    const size = this.renderSize;

    if (!isVisible && !isExplored) {
      // Complete darkness
      this.ctx.fillStyle = "#050508";
      this.ctx.fillRect(x, y, size, size);
      return;
    }

    const tileset = this.tilesetImg;
    const srcSize = DUNGEON_TILESET.tileSize;

    // Determine tile from tileset
    let tileCoord = { x: 0, y: 0 };

    switch (tileType) {
      case TileType.Floor:
        // More floor tile variety
        const floorVariant = (gridX * 7 + gridY * 13) % 6;
        tileCoord = { x: floorVariant % 4, y: 0 };
        break;
      case TileType.Wall:
        // Grey color for visibility instead of relying on tile sheet
        this.ctx.fillStyle = "#333340"; // Darker rock grey
        this.ctx.fillRect(x, y, size, size);
        
        // Add some "rock" texture lines
        this.ctx.fillStyle = "#222230";
        this.ctx.fillRect(x + size*0.1, y + size*0.1, size*0.3, size*0.1);
        this.ctx.fillRect(x + size*0.5, y + size*0.4, size*0.4, size*0.1);
        this.ctx.fillRect(x + size*0.2, y + size*0.7, size*0.5, size*0.1);
        return;
      case TileType.Exit:
        tileCoord = { x: 2, y: 3 }; // Stairs
        break;
    }

    if (tileset) {
      this.ctx.drawImage(
        tileset,
        tileCoord.x * srcSize,
        tileCoord.y * srcSize,
        srcSize,
        srcSize,
        x,
        y,
        size,
        size
      );

      // Add decorations on some floor tiles
      if (tileType === TileType.Floor && isVisible) {
        this.drawDecoration(gridX, gridY, x, y, size);
      }
    } else {
      // Fallback
      this.ctx.fillStyle =
        tileType === TileType.Floor
          ? "#2a2a3d"
          : "#2d5a3d";
      this.ctx.fillRect(x, y, size, size);
    }

    // Fog of war effect for explored but not visible
    if (isExplored && !isVisible) {
      this.ctx.fillStyle = "rgba(5, 5, 10, 0.65)";
      this.ctx.fillRect(x, y, size, size);
    }
  }

  private drawDecoration(
    gridX: number,
    gridY: number,
    screenX: number,
    screenY: number,
    size: number
  ): void {
    const key = `${gridX},${gridY}`;
    const hash = (gridX * 31 + gridY * 17) % 100;

    // Only some tiles have decorations
    if (hash > 15) return;

    const tileset = this.tilesetImg;
    if (!tileset) return;

    const srcSize = DUNGEON_TILESET.tileSize;

    if (hash < 5) {
      // Bones
      this.ctx.drawImage(
        tileset,
        5 * srcSize,
        2 * srcSize,
        srcSize,
        srcSize,
        screenX,
        screenY,
        size,
        size
      );
    } else if (hash < 10) {
      // Skull
      this.ctx.drawImage(
        tileset,
        6 * srcSize,
        2 * srcSize,
        srcSize,
        srcSize,
        screenX,
        screenY,
        size,
        size
      );
    } else if (hash < 15) {
      // Barrel or crate
      this.ctx.drawImage(
        tileset,
        (3 + (hash % 2)) * srcSize,
        2 * srcSize,
        srcSize,
        srcSize,
        screenX,
        screenY,
        size,
        size
      );
    }
  }

  drawTreasure(gridX: number, gridY: number, time: number): void {
    if (!this.isTileOnScreen(gridX, gridY)) return;

    const { x, y } = this.gridToScreen(gridX, gridY);
    const size = this.renderSize;
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Pulsing golden glow
    const pulse = Math.sin(time * 0.004) * 0.3 + 0.7;

    const glowGrad = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      size * 0.7
    );
    glowGrad.addColorStop(0, `rgba(255, 255, 0, ${0.8 * pulse})`);
    glowGrad.addColorStop(0.5, `rgba(255, 200, 0, ${0.5 * pulse})`);
    glowGrad.addColorStop(1, "transparent");
    this.ctx.fillStyle = glowGrad;
    this.ctx.fillRect(x - size * 0.5, y - size * 0.5, size * 2, size * 2); // Make glow bigger
    
    // Draw a prominent diamond/star above chest
    this.ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY - size*0.4);
    this.ctx.lineTo(centerX + size*0.1, centerY - size*0.2);
    this.ctx.lineTo(centerX, centerY);
    this.ctx.lineTo(centerX - size*0.1, centerY - size*0.2);
    this.ctx.fill();

    // Draw chest from tileset
    if (this.tilesetImg) {
      const srcSize = DUNGEON_TILESET.tileSize;
      const bobY = Math.sin(time * 0.005) * 3;
      this.ctx.drawImage(
        this.tilesetImg,
        1 * srcSize,
        2 * srcSize,
        srcSize,
        srcSize,
        x + 4,
        y + 4 + bobY,
        size - 8,
        size - 8
      );
    }
  }

  drawPlayer(
    gridX: number,
    gridY: number,
    time: number,
    isEnemy: boolean = false
  ): void {
    // Use smooth world position instead of grid position
    const screenX = this.playerWorldX - this.cameraX;
    const screenY = this.playerWorldY - this.cameraY;

    if (this.playerSprite && this.playerSprite.isReady()) {
      // Draw with glow
      const glowColor = isEnemy ? "rgb(139, 58, 117)" : "rgb(255, 107, 53)";
      this.playerSprite.drawWithGlow(
        this.ctx,
        screenX,
        screenY,
        0.45,
        glowColor,
        0.4
      );
    } else {
      // Fallback if sprite not loaded
      this.drawFallbackPlayer(screenX, screenY, isEnemy, time);
    }
  }

  private drawFallbackPlayer(
    screenX: number,
    screenY: number,
    isEnemy: boolean,
    time: number
  ): void {
    const size = this.renderSize;
    const pulse = Math.sin(time * 0.005) * 0.1 + 1;
    const color = isEnemy ? "#8b3a75" : "#ff6b35";

    // Glow
    const glowGrad = this.ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      size * 0.6
    );
    glowGrad.addColorStop(
      0,
      isEnemy ? "rgba(139, 58, 117, 0.5)" : "rgba(255, 107, 53, 0.5)"
    );
    glowGrad.addColorStop(1, "transparent");
    this.ctx.fillStyle = glowGrad;
    this.ctx.fillRect(screenX - size * 0.5, screenY - size * 0.5, size, size);

    // Simple character shape
    const charSize = size * 0.5 * pulse;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      screenX - charSize / 2,
      screenY - charSize / 2,
      charSize,
      charSize * 0.8
    );

    // Head
    this.ctx.beginPath();
    this.ctx.arc(
      screenX,
      screenY - charSize * 0.4,
      charSize * 0.25,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
  }

  drawExit(gridX: number, gridY: number, time: number): void {
    if (!this.isTileOnScreen(gridX, gridY)) return;

    const { x, y } = this.gridToScreen(gridX, gridY);
    const size = this.renderSize;
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    const pulse = Math.sin(time * 0.003) * 0.3 + 0.7;

    // Mystical portal glow
    const glowGrad = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      size
    );
    glowGrad.addColorStop(0, `rgba(74, 222, 128, ${0.6 * pulse})`);
    glowGrad.addColorStop(0.4, `rgba(74, 222, 128, ${0.3 * pulse})`);
    glowGrad.addColorStop(1, "transparent");
    this.ctx.fillStyle = glowGrad;
    this.ctx.fillRect(x - size * 0.5, y - size * 0.5, size * 2, size * 2);

    // Animated swirl
    this.ctx.strokeStyle = `rgba(150, 255, 180, ${pulse})`;
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const radius = size * (0.2 + i * 0.1);
      const startAngle = time * 0.002 + i * 0.7;
      this.ctx.beginPath();
      this.ctx.arc(
        centerX,
        centerY,
        radius,
        startAngle,
        startAngle + Math.PI * 1.5
      );
      this.ctx.stroke();
    }

    // Center sparkle
    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, size * 0.1 * pulse, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Draw smooth fog of war around visible area
  drawFogOfWar(visibleTiles: Set<string>, exploredTiles: Set<string>): void {
    // Create a radial gradient centered on player for smooth lighting
    const screenX = this.playerWorldX - this.cameraX;
    const screenY = this.playerWorldY - this.cameraY;

    const lightRadius = this.renderSize * 4;
    const gradient = this.ctx.createRadialGradient(
      screenX,
      screenY,
      lightRadius * 0.3,
      screenX,
      screenY,
      lightRadius
    );
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.3)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  getGridPosition(screenX: number, screenY: number): Position | null {
    const worldX = screenX + this.cameraX;
    const worldY = screenY + this.cameraY;
    const gridX = Math.floor(worldX / this.renderSize);
    const gridY = Math.floor(worldY / this.renderSize);

    if (
      gridX >= 0 &&
      gridX < this.gridWidth &&
      gridY >= 0 &&
      gridY < this.gridHeight
    ) {
      return { x: gridX, y: gridY };
    }
    return null;
  }

  getRenderSize(): number {
    return this.renderSize;
  }

  getOffset(): { x: number; y: number } {
    return { x: -this.cameraX, y: -this.cameraY };
  }

  getCameraPosition(): { x: number; y: number } {
    return { x: this.cameraX, y: this.cameraY };
  }
}
