// ============================================
// VILLAGE RENDERER - Interactive tilemap with camera system
// Renders the village hub with grass, paths, trees, buildings
// ============================================

import { loadImage, getImage, VILLAGE_GROUND } from "./tilesets";
import { SpriteAnimator } from "./spriteAnimator";
import { WARRIOR_CONFIG } from "./spriteData";

// ============================================
// VILLAGE MAP CONFIGURATION
// ============================================

const TILE_SIZE = 16; // Source tile size
const RENDER_SCALE = 3; // Scale up for crisp pixel art
const RENDER_TILE_SIZE = TILE_SIZE * RENDER_SCALE; // 48px rendered tiles

// Village map dimensions (in tiles)
const MAP_WIDTH = 30;
const MAP_HEIGHT = 24;

// Tile types for the village map
enum VillageTile {
  Grass1 = 0,
  Grass2 = 1,
  Grass3 = 2,
  Path = 3,
  PathEdgeTop = 4,
  PathEdgeBottom = 5,
  PathEdgeLeft = 6,
  PathEdgeRight = 7,
  Water = 8,
  Tree = 9,
  Building = 10,
  DungeonGate = 11,
}

// Collision layer - true = blocked
const COLLISION_TILES = new Set([
  VillageTile.Water,
  VillageTile.Tree,
  VillageTile.Building,
]);

// ============================================
// VILLAGE MAP DATA
// Hand-crafted village layout
// ============================================

function generateVillageMap(): number[][] {
  const map: number[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Default to grass with variation
      let tile = (x + y) % 3; // Grass1, Grass2, or Grass3

      // Water pond on the left
      if (x >= 2 && x <= 5 && y >= 8 && y <= 11) {
        tile = VillageTile.Water;
      }

      // Main path from bottom to dungeon gate (top center)
      if (x >= 13 && x <= 16 && y >= 2) {
        tile = VillageTile.Path;
      }

      // Horizontal path connecting areas
      if (y >= 14 && y <= 15 && x >= 5 && x <= 24) {
        tile = VillageTile.Path;
      }

      // Trees scattered around
      const treePositions = [
        [1, 3],
        [3, 2],
        [5, 4],
        [7, 2],
        [8, 5],
        [22, 3],
        [24, 2],
        [26, 4],
        [27, 6],
        [25, 8],
        [2, 16],
        [4, 18],
        [6, 20],
        [8, 17],
        [22, 17],
        [24, 19],
        [26, 16],
        [28, 18],
        [10, 5],
        [11, 7],
        [19, 5],
        [20, 7],
      ];
      for (const [tx, ty] of treePositions) {
        if (x === tx && y === ty) tile = VillageTile.Tree;
      }

      // Buildings
      // Left building (tavern)
      if (x >= 7 && x <= 10 && y >= 10 && y <= 12) {
        tile = VillageTile.Building;
      }
      // Right building (shop)
      if (x >= 20 && x <= 23 && y >= 10 && y <= 12) {
        tile = VillageTile.Building;
      }

      // Dungeon gate at top center
      if (x >= 13 && x <= 16 && y >= 0 && y <= 2) {
        tile = VillageTile.DungeonGate;
      }

      row.push(tile);
    }
    map.push(row);
  }

  return map;
}

// ============================================
// CAMERA CLASS
// ============================================

class Camera {
  x: number = 0;
  y: number = 0;
  width: number;
  height: number;

  // Smooth follow parameters
  private targetX: number = 0;
  private targetY: number = 0;
  private smoothing: number = 0.1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setTarget(x: number, y: number): void {
    // Center camera on target
    this.targetX = x - this.width / 2;
    this.targetY = y - this.height / 2;

    // Clamp to map bounds
    const maxX = MAP_WIDTH * RENDER_TILE_SIZE - this.width;
    const maxY = MAP_HEIGHT * RENDER_TILE_SIZE - this.height;
    this.targetX = Math.max(0, Math.min(this.targetX, maxX));
    this.targetY = Math.max(0, Math.min(this.targetY, maxY));
  }

  update(): void {
    // Smooth interpolation
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

// ============================================
// VILLAGE RENDERER CLASS
// ============================================

export interface PlayerState {
  x: number; // World position
  y: number;
  velocityX: number;
  velocityY: number;
  isMoving: boolean;
}

export class VillageRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private map: number[][];

  // Assets
  private groundTileset: HTMLImageElement | null = null;
  private objectsTileset: HTMLImageElement | null = null;
  private buildingsTileset: HTMLImageElement | null = null;

  // Player
  private playerSprite: SpriteAnimator;
  private playerState: PlayerState;

  // Input
  private keys: Set<string> = new Set();

  // Callbacks
  public onEnterDungeon?: () => void;

  // Animation
  private lastTime: number = 0;
  private ambientTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.camera = new Camera(canvas.width, canvas.height);
    this.map = generateVillageMap();

    // Initialize player at bottom center of map
    this.playerState = {
      x: 14.5 * RENDER_TILE_SIZE,
      y: 20 * RENDER_TILE_SIZE,
      velocityX: 0,
      velocityY: 0,
      isMoving: false,
    };

    this.playerSprite = new SpriteAnimator(WARRIOR_CONFIG);
  }

  async init(): Promise<void> {
    // Load all assets
    await Promise.all([
      this.playerSprite.load(),
      loadImage(VILLAGE_GROUND.src).then((img) => (this.groundTileset = img)),
      loadImage("/tiles/objects_demo.png").then(
        (img) => (this.objectsTileset = img)
      ),
      loadImage("/tiles/premade_buildings_demo.png").then(
        (img) => (this.buildingsTileset = img)
      ),
    ]);
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
    this.camera.resize(width, height);
  }

  handleKeyDown(key: string): void {
    this.keys.add(key.toLowerCase());
  }

  handleKeyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }

  private getTileAt(worldX: number, worldY: number): number {
    const tileX = Math.floor(worldX / RENDER_TILE_SIZE);
    const tileY = Math.floor(worldY / RENDER_TILE_SIZE);
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
      return VillageTile.Tree; // Treat out of bounds as collision
    }
    return this.map[tileY][tileX];
  }

  private isCollision(worldX: number, worldY: number): boolean {
    // Check collision box (smaller than sprite)
    const hitboxSize = RENDER_TILE_SIZE * 0.4;
    const corners = [
      { x: worldX - hitboxSize, y: worldY - hitboxSize },
      { x: worldX + hitboxSize, y: worldY - hitboxSize },
      { x: worldX - hitboxSize, y: worldY + hitboxSize },
      { x: worldX + hitboxSize, y: worldY + hitboxSize },
    ];

    for (const corner of corners) {
      const tile = this.getTileAt(corner.x, corner.y);
      if (COLLISION_TILES.has(tile)) return true;
    }
    return false;
  }

  private checkDungeonEntry(): boolean {
    const tileX = Math.floor(this.playerState.x / RENDER_TILE_SIZE);
    const tileY = Math.floor(this.playerState.y / RENDER_TILE_SIZE);

    // Check if near dungeon gate (y <= 3 and center x)
    return tileY <= 3 && tileX >= 13 && tileX <= 16;
  }

  update(time: number): void {
    const deltaTime = this.lastTime ? time - this.lastTime : 16;
    this.lastTime = time;
    this.ambientTime += deltaTime;

    // Player movement
    const speed = 4;
    let dx = 0;
    let dy = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= speed;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += speed;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= speed;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += speed;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    // Apply movement with collision
    const newX = this.playerState.x + dx;
    const newY = this.playerState.y + dy;

    if (!this.isCollision(newX, this.playerState.y)) {
      this.playerState.x = newX;
    }
    if (!this.isCollision(this.playerState.x, newY)) {
      this.playerState.y = newY;
    }

    // Update player animation
    this.playerState.isMoving = dx !== 0 || dy !== 0;
    if (this.playerState.isMoving) {
      this.playerSprite.setAnimation("run");
      if (dx < 0) this.playerSprite.setDirection("left");
      else if (dx > 0) this.playerSprite.setDirection("right");
    } else {
      this.playerSprite.setAnimation("idle");
    }
    this.playerSprite.update(deltaTime);

    // Update camera
    this.camera.setTarget(this.playerState.x, this.playerState.y);
    this.camera.update();

    // Check dungeon entry
    if (this.checkDungeonEntry() && this.onEnterDungeon) {
      this.onEnterDungeon();
    }
  }

  render(): void {
    const { width, height } = this.canvas.getBoundingClientRect();

    // Clear with night sky gradient
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, "#0a0a1a");
    skyGradient.addColorStop(0.4, "#0f1020");
    skyGradient.addColorStop(1, "#151828");
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, width, height);

    // Draw stars
    this.drawStars(width, height);

    // Draw tilemap
    this.drawTilemap();

    // Draw player
    this.drawPlayer();

    // Draw ambient effects
    this.drawAmbientEffects(width, height);

    // Draw dungeon gate glow
    this.drawDungeonGateGlow();

    // Draw vignette
    this.drawVignette(width, height);
  }

  private drawStars(width: number, height: number): void {
    this.ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 80; i++) {
      const x = (i * 137.5 + this.ambientTime * 0.001) % width;
      const y = (i * 73.7) % (height * 0.5);
      const twinkle = Math.sin(this.ambientTime * 0.002 + i) * 0.4 + 0.6;
      this.ctx.globalAlpha = twinkle * 0.7;
      const size = (i % 3) + 1;
      this.ctx.fillRect(x, y, size, size);
    }
    this.ctx.globalAlpha = 1;
  }

  private drawTilemap(): void {
    if (!this.groundTileset) return;

    const { width, height } = this.canvas.getBoundingClientRect();

    // Calculate visible tile range
    const startX = Math.floor(this.camera.x / RENDER_TILE_SIZE);
    const startY = Math.floor(this.camera.y / RENDER_TILE_SIZE);
    const endX = Math.ceil((this.camera.x + width) / RENDER_TILE_SIZE);
    const endY = Math.ceil((this.camera.y + height) / RENDER_TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) continue;

        const tile = this.map[y][x];
        const screenX = x * RENDER_TILE_SIZE - this.camera.x;
        const screenY = y * RENDER_TILE_SIZE - this.camera.y;

        this.drawTile(tile, screenX, screenY);
      }
    }
  }

  private drawTile(tile: number, screenX: number, screenY: number): void {
    if (!this.groundTileset) return;

    // Source coordinates in tileset
    let srcX = 0;
    let srcY = 0;
    let tileset = this.groundTileset;

    switch (tile) {
      case VillageTile.Grass1:
        srcX = 0;
        srcY = 0;
        break;
      case VillageTile.Grass2:
        srcX = 1;
        srcY = 0;
        break;
      case VillageTile.Grass3:
        srcX = 2;
        srcY = 0;
        break;
      case VillageTile.Path:
        srcX = 4;
        srcY = 0;
        break;
      case VillageTile.Water:
        srcX = 8;
        srcY = 0;
        // Animated water effect
        const waterOffset =
          Math.sin(this.ambientTime * 0.003 + screenX * 0.01) * 0.5;
        this.ctx.globalAlpha = 0.8 + waterOffset * 0.2;
        break;
      case VillageTile.Tree:
        // Draw grass underneath
        this.ctx.drawImage(
          this.groundTileset,
          0,
          0,
          TILE_SIZE,
          TILE_SIZE,
          screenX,
          screenY,
          RENDER_TILE_SIZE,
          RENDER_TILE_SIZE
        );
        // Draw tree from objects tileset
        if (this.objectsTileset) {
          this.ctx.drawImage(
            this.objectsTileset,
            0,
            0,
            32,
            32, // Tree is 2x2 tiles
            screenX - RENDER_TILE_SIZE / 2,
            screenY - RENDER_TILE_SIZE,
            RENDER_TILE_SIZE * 2,
            RENDER_TILE_SIZE * 2
          );
        }
        return;
      case VillageTile.Building:
        // Draw building from buildings tileset
        if (this.buildingsTileset) {
          this.ctx.fillStyle = "#2a2a3a";
          this.ctx.fillRect(
            screenX,
            screenY,
            RENDER_TILE_SIZE,
            RENDER_TILE_SIZE
          );
          this.ctx.fillStyle = "#1a1a2a";
          this.ctx.fillRect(
            screenX + 4,
            screenY + 4,
            RENDER_TILE_SIZE - 8,
            RENDER_TILE_SIZE - 8
          );
        }
        return;
      case VillageTile.DungeonGate:
        // Draw ominous dungeon entrance
        this.drawDungeonGateTile(screenX, screenY);
        return;
      default:
        srcX = 0;
        srcY = 0;
    }

    this.ctx.drawImage(
      tileset,
      srcX * TILE_SIZE,
      srcY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      screenX,
      screenY,
      RENDER_TILE_SIZE,
      RENDER_TILE_SIZE
    );
    this.ctx.globalAlpha = 1;
  }

  private drawDungeonGateTile(screenX: number, screenY: number): void {
    // Dark stone base
    this.ctx.fillStyle = "#1a1a28";
    this.ctx.fillRect(screenX, screenY, RENDER_TILE_SIZE, RENDER_TILE_SIZE);

    // Gate archway
    this.ctx.fillStyle = "#0a0a10";
    this.ctx.fillRect(
      screenX + 8,
      screenY + 8,
      RENDER_TILE_SIZE - 16,
      RENDER_TILE_SIZE - 8
    );

    // Glowing runes
    const runeGlow = Math.sin(this.ambientTime * 0.003) * 0.3 + 0.7;
    this.ctx.fillStyle = `rgba(255, 100, 50, ${runeGlow})`;
    this.ctx.fillRect(screenX + 4, screenY + 4, 4, 4);
    this.ctx.fillRect(screenX + RENDER_TILE_SIZE - 8, screenY + 4, 4, 4);
  }

  private drawPlayer(): void {
    const screenX = this.playerState.x - this.camera.x;
    const screenY = this.playerState.y - this.camera.y;

    // Draw shadow
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    this.ctx.beginPath();
    this.ctx.ellipse(screenX, screenY + 30, 20, 8, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw sprite
    this.playerSprite.draw(this.ctx, screenX, screenY, 0.5, { shadow: false });
  }

  private drawDungeonGateGlow(): void {
    // Gate position on screen
    const gateScreenX = 14.5 * RENDER_TILE_SIZE - this.camera.x;
    const gateScreenY = 1.5 * RENDER_TILE_SIZE - this.camera.y;

    // Pulsing glow
    const pulse = Math.sin(this.ambientTime * 0.002) * 0.3 + 0.7;
    const gradient = this.ctx.createRadialGradient(
      gateScreenX,
      gateScreenY,
      0,
      gateScreenX,
      gateScreenY,
      150
    );
    gradient.addColorStop(0, `rgba(255, 80, 30, ${0.4 * pulse})`);
    gradient.addColorStop(0.5, `rgba(255, 50, 20, ${0.2 * pulse})`);
    gradient.addColorStop(1, "transparent");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(gateScreenX - 150, gateScreenY - 150, 300, 300);
  }

  private drawAmbientEffects(width: number, height: number): void {
    // Floating particles
    this.ctx.fillStyle = "rgba(255, 200, 100, 0.3)";
    for (let i = 0; i < 20; i++) {
      const x = (i * 97 + this.ambientTime * 0.02) % width;
      const y = (i * 53 + Math.sin(this.ambientTime * 0.001 + i) * 20) % height;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawVignette(width: number, height: number): void {
    const gradient = this.ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.3,
      width / 2,
      height / 2,
      height * 0.8
    );
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  getPlayerPosition(): { x: number; y: number } {
    return { x: this.playerState.x, y: this.playerState.y };
  }
}
