// ============================================
// VILLAGE RENDERER - Beautiful PicoVillage tilemap
// Open world feel with houses, NPCs, dungeon entrance
// ============================================

import { ASSETS, GAME_CONFIG, COLORS } from "./constants";

// ============================================
// TILE TYPES
// ============================================

enum VillageTile {
  Grass1 = 0,
  Grass2 = 1,
  Grass3 = 2,
  GrassFlower = 3,
  Path = 4,
  PathEdge = 5,
  Water = 6,
  WaterEdge = 7,
  Bridge = 8,
  Fence = 9,
  Tree = 10,
  Bush = 11,
  Rock = 12,
  Building = 13,
  DungeonGate = 14,
  Dock = 15,
}

// ============================================
// NPC DEFINITION
// ============================================

interface NPC {
  x: number;
  y: number;
  name: string;
  dialogue: string[];
  sprite: { sx: number; sy: number };
  facing: "left" | "right" | "down" | "up";
}

// ============================================
// BUILDING DEFINITION
// ============================================

interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "tavern" | "shop" | "house" | "blacksmith" | "dungeon";
  name: string;
}

// ============================================
// CAMERA CLASS
// ============================================

class Camera {
  x = 0;
  y = 0;
  width: number;
  height: number;
  targetX = 0;
  targetY = 0;
  smoothing = GAME_CONFIG.CAMERA_SMOOTHING;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setTarget(x: number, y: number, mapWidth: number, mapHeight: number): void {
    this.targetX = x - this.width / 2;
    this.targetY = y - this.height / 2;

    // Clamp to map bounds
    const maxX = mapWidth - this.width;
    const maxY = mapHeight - this.height;
    this.targetX = Math.max(0, Math.min(this.targetX, maxX));
    this.targetY = Math.max(0, Math.min(this.targetY, maxY));
  }

  update(): void {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

// ============================================
// VILLAGE MAP GENERATOR
// ============================================

function generateVillageMap(): {
  tiles: number[][];
  buildings: Building[];
  npcs: NPC[];
} {
  const width = GAME_CONFIG.VILLAGE_WIDTH;
  const height = GAME_CONFIG.VILLAGE_HEIGHT;
  const tiles: number[][] = [];

  // Initialize with grass
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Varied grass with occasional flowers
      const grassType = (x * 7 + y * 13) % 10;
      if (grassType < 4) row.push(VillageTile.Grass1);
      else if (grassType < 7) row.push(VillageTile.Grass2);
      else if (grassType < 9) row.push(VillageTile.Grass3);
      else row.push(VillageTile.GrassFlower);
    }
    tiles.push(row);
  }

  // Water pond (left side)
  for (let y = 10; y < 16; y++) {
    for (let x = 3; x < 9; x++) {
      tiles[y][x] = VillageTile.Water;
    }
  }
  // Water edges
  for (let x = 3; x < 9; x++) {
    tiles[9][x] = VillageTile.WaterEdge;
    tiles[16][x] = VillageTile.WaterEdge;
  }

  // Main path (vertical - center)
  for (let y = 3; y < height - 2; y++) {
    tiles[y][18] = VillageTile.Path;
    tiles[y][19] = VillageTile.Path;
    tiles[y][20] = VillageTile.Path;
  }

  // Horizontal path (connects buildings)
  for (let x = 10; x < 30; x++) {
    tiles[14][x] = VillageTile.Path;
    tiles[15][x] = VillageTile.Path;
  }

  // Path to dungeon (north)
  for (let y = 0; y < 4; y++) {
    tiles[y][18] = VillageTile.Path;
    tiles[y][19] = VillageTile.Path;
    tiles[y][20] = VillageTile.Path;
  }

  // Bridge over water
  for (let x = 4; x < 8; x++) {
    tiles[12][x] = VillageTile.Bridge;
    tiles[13][x] = VillageTile.Bridge;
  }

  // Dock by water
  tiles[11][9] = VillageTile.Dock;
  tiles[12][9] = VillageTile.Dock;
  tiles[13][9] = VillageTile.Dock;

  // Trees (scattered)
  const treePositions = [
    [1, 2],
    [2, 4],
    [4, 1],
    [6, 3],
    [1, 7],
    [2, 18],
    [0, 22],
    [12, 3],
    [14, 2],
    [25, 3],
    [27, 5],
    [30, 2],
    [32, 4],
    [35, 8],
    [36, 10],
    [37, 3],
    [38, 6],
    [33, 18],
    [35, 20],
    [1, 20],
    [3, 23],
    [5, 26],
    [8, 24],
    [10, 27],
    [37, 25],
  ];
  for (const [x, y] of treePositions) {
    if (x < width && y < height) tiles[y][x] = VillageTile.Tree;
  }

  // Bushes
  const bushPositions = [
    [5, 5],
    [8, 6],
    [11, 4],
    [23, 4],
    [28, 6],
    [31, 3],
    [10, 20],
    [12, 22],
    [28, 22],
    [30, 24],
  ];
  for (const [x, y] of bushPositions) {
    if (x < width && y < height) tiles[y][x] = VillageTile.Bush;
  }

  // Rocks
  const rockPositions = [
    [7, 8],
    [9, 17],
    [26, 8],
    [34, 12],
    [2, 25],
    [36, 22],
  ];
  for (const [x, y] of rockPositions) {
    if (x < width && y < height) tiles[y][x] = VillageTile.Rock;
  }

  // Fences around certain areas
  for (let x = 12; x < 16; x++) {
    tiles[8][x] = VillageTile.Fence;
    tiles[12][x] = VillageTile.Fence;
  }
  for (let y = 8; y < 13; y++) {
    tiles[y][12] = VillageTile.Fence;
    tiles[y][15] = VillageTile.Fence;
  }

  // Dungeon gate at top
  for (let y = 0; y < 3; y++) {
    tiles[y][17] = VillageTile.DungeonGate;
    tiles[y][18] = VillageTile.DungeonGate;
    tiles[y][19] = VillageTile.DungeonGate;
    tiles[y][20] = VillageTile.DungeonGate;
    tiles[y][21] = VillageTile.DungeonGate;
  }

  // Buildings
  const buildings: Building[] = [
    {
      x: 12,
      y: 16,
      width: 5,
      height: 4,
      type: "tavern",
      name: "The Rusty Sword",
    },
    { x: 24, y: 16, width: 5, height: 4, type: "shop", name: "General Store" },
    { x: 12, y: 22, width: 4, height: 3, type: "house", name: "Elder's House" },
    { x: 26, y: 22, width: 4, height: 3, type: "blacksmith", name: "Forge" },
    { x: 17, y: 0, width: 5, height: 3, type: "dungeon", name: "Shadow Gate" },
  ];

  // Mark building tiles
  for (const building of buildings) {
    if (building.type !== "dungeon") {
      for (let y = building.y; y < building.y + building.height; y++) {
        for (let x = building.x; x < building.x + building.width; x++) {
          if (x < width && y < height) {
            tiles[y][x] = VillageTile.Building;
          }
        }
      }
    }
  }

  // NPCs
  const npcs: NPC[] = [
    {
      x: 15,
      y: 20,
      name: "Tavern Keeper",
      dialogue: [
        "Welcome traveler!",
        "The dungeon is dangerous...",
        "Many have entered, few returned.",
      ],
      sprite: { sx: 0, sy: 0 },
      facing: "down",
    },
    {
      x: 27,
      y: 20,
      name: "Merchant",
      dialogue: [
        "Got some fine wares!",
        "Be careful in there.",
        "Gold is all that matters.",
      ],
      sprite: { sx: 16, sy: 0 },
      facing: "down",
    },
    {
      x: 10,
      y: 14,
      name: "Old Man",
      dialogue: [
        "The shadow calls...",
        "Two enter, one wins.",
        "Your gold... or your life.",
      ],
      sprite: { sx: 32, sy: 0 },
      facing: "right",
    },
    {
      x: 19,
      y: 5,
      name: "Gate Guard",
      dialogue: [
        "The dungeon awaits.",
        "Ready for battle?",
        "Press E to enter.",
      ],
      sprite: { sx: 48, sy: 0 },
      facing: "down",
    },
  ];

  return { tiles, buildings, npcs };
}

// ============================================
// COLLISION TILES
// ============================================

const COLLISION_TILES = new Set([
  VillageTile.Water,
  VillageTile.Tree,
  VillageTile.Building,
  VillageTile.Rock,
  VillageTile.Fence,
]);

// ============================================
// PLAYER STATE
// ============================================

export interface PlayerState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  isMoving: boolean;
  facing: "left" | "right" | "up" | "down";
  animFrame: number;
}

// ============================================
// VILLAGE RENDERER CLASS
// ============================================

export class VillageRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;

  // Map data
  private tiles: number[][] = [];
  private buildings: Building[] = [];
  private npcs: NPC[] = [];

  // Assets
  private outdoorTiles: HTMLImageElement | null = null;
  private waterTiles: HTMLImageElement | null = null;
  private fenceTiles: HTMLImageElement | null = null;
  private buildingTiles: HTMLImageElement | null = null;
  private miscObjects: HTMLImageElement | null = null;
  private characterTiles: HTMLImageElement | null = null;

  // Player
  private playerState: PlayerState;

  // Input
  private keys = new Set<string>();

  // Animation
  private lastTime = 0;
  private ambientTime = 0;

  // Callbacks
  public onEnterDungeon?: () => void;
  public onTalkToNPC?: (npc: NPC) => void;

  // Tile sizes
  private srcTileSize = GAME_CONFIG.TILE_SOURCE_SIZE;
  private renderScale = GAME_CONFIG.TILE_RENDER_SCALE;
  private tileSize = this.srcTileSize * this.renderScale;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.camera = new Camera(canvas.width, canvas.height);

    // Generate map
    const mapData = generateVillageMap();
    this.tiles = mapData.tiles;
    this.buildings = mapData.buildings;
    this.npcs = mapData.npcs;

    // Initialize player at village center
    this.playerState = {
      x: 19 * this.tileSize,
      y: 20 * this.tileSize,
      velocityX: 0,
      velocityY: 0,
      isMoving: false,
      facing: "down",
      animFrame: 0,
    };
  }

  async init(): Promise<void> {
    // Load all assets
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${src}`));
        img.src = src;
      });

    await Promise.all([
      loadImg(ASSETS.tiles.outdoor).then((img) => (this.outdoorTiles = img)),
      loadImg(ASSETS.tiles.water).then((img) => (this.waterTiles = img)),
      loadImg(ASSETS.tiles.fence).then((img) => (this.fenceTiles = img)),
      loadImg(ASSETS.buildings.main).then((img) => (this.buildingTiles = img)),
      loadImg(ASSETS.objects.misc).then((img) => (this.miscObjects = img)),
      loadImg(ASSETS.characters.player).then(
        (img) => (this.characterTiles = img)
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
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);
    if (
      tileX < 0 ||
      tileX >= GAME_CONFIG.VILLAGE_WIDTH ||
      tileY < 0 ||
      tileY >= GAME_CONFIG.VILLAGE_HEIGHT
    ) {
      return VillageTile.Tree; // Out of bounds = collision
    }
    return this.tiles[tileY][tileX];
  }

  private isCollision(worldX: number, worldY: number): boolean {
    const hitboxSize = this.tileSize * 0.35;
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
    const tileX = Math.floor(this.playerState.x / this.tileSize);
    const tileY = Math.floor(this.playerState.y / this.tileSize);
    return tileY <= 4 && tileX >= 17 && tileX <= 21;
  }

  private getNearbyNPC(): NPC | null {
    const playerTileX = Math.floor(this.playerState.x / this.tileSize);
    const playerTileY = Math.floor(this.playerState.y / this.tileSize);

    for (const npc of this.npcs) {
      const dx = Math.abs(npc.x - playerTileX);
      const dy = Math.abs(npc.y - playerTileY);
      if (dx <= 2 && dy <= 2) return npc;
    }
    return null;
  }

  update(time: number): void {
    const deltaTime = this.lastTime ? time - this.lastTime : 16;
    this.lastTime = time;
    this.ambientTime += deltaTime;

    // Player movement
    const speed = GAME_CONFIG.PLAYER_SPEED;
    let dx = 0;
    let dy = 0;

    if (this.keys.has("w") || this.keys.has("arrowup")) {
      dy -= speed;
      this.playerState.facing = "up";
    }
    if (this.keys.has("s") || this.keys.has("arrowdown")) {
      dy += speed;
      this.playerState.facing = "down";
    }
    if (this.keys.has("a") || this.keys.has("arrowleft")) {
      dx -= speed;
      this.playerState.facing = "left";
    }
    if (this.keys.has("d") || this.keys.has("arrowright")) {
      dx += speed;
      this.playerState.facing = "right";
    }

    // Normalize diagonal
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

    // Animation
    this.playerState.isMoving = dx !== 0 || dy !== 0;
    if (this.playerState.isMoving) {
      this.playerState.animFrame = Math.floor(this.ambientTime / 120) % 4;
    } else {
      this.playerState.animFrame = 0;
    }

    // Update camera
    const mapWidth = GAME_CONFIG.VILLAGE_WIDTH * this.tileSize;
    const mapHeight = GAME_CONFIG.VILLAGE_HEIGHT * this.tileSize;
    this.camera.setTarget(
      this.playerState.x,
      this.playerState.y,
      mapWidth,
      mapHeight
    );
    this.camera.update();

    // Check dungeon entry
    if (this.checkDungeonEntry() && this.onEnterDungeon) {
      this.onEnterDungeon();
    }
  }

  render(): void {
    const { width, height } = this.canvas.getBoundingClientRect();

    // Sky gradient (twilight)
    const sky = this.ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#1a1a2e");
    sky.addColorStop(0.3, "#16213e");
    sky.addColorStop(0.7, "#0f3460");
    sky.addColorStop(1, "#1a1a2e");
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, width, height);

    // Stars
    this.drawStars(width, height);

    // Draw tilemap
    this.drawTilemap(width, height);

    // Draw buildings
    this.drawBuildings();

    // Draw NPCs
    this.drawNPCs();

    // Draw player
    this.drawPlayer();

    // Draw dungeon gate glow
    this.drawDungeonGlow();

    // Draw ambient particles
    this.drawParticles(width, height);

    // Vignette
    this.drawVignette(width, height);
  }

  private drawStars(width: number, height: number): void {
    this.ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 100; i++) {
      const x = (i * 137.5 + this.ambientTime * 0.001) % width;
      const y = (i * 73.7) % (height * 0.5);
      const twinkle = Math.sin(this.ambientTime * 0.002 + i) * 0.4 + 0.6;
      this.ctx.globalAlpha = twinkle * 0.6;
      const size = (i % 3) + 1;
      this.ctx.fillRect(x, y, size, size);
    }
    this.ctx.globalAlpha = 1;
  }

  private drawTilemap(width: number, height: number): void {
    const startX = Math.floor(this.camera.x / this.tileSize);
    const startY = Math.floor(this.camera.y / this.tileSize);
    const endX = Math.ceil((this.camera.x + width) / this.tileSize) + 1;
    const endY = Math.ceil((this.camera.y + height) / this.tileSize) + 1;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (
          x < 0 ||
          x >= GAME_CONFIG.VILLAGE_WIDTH ||
          y < 0 ||
          y >= GAME_CONFIG.VILLAGE_HEIGHT
        )
          continue;

        const tile = this.tiles[y][x];
        const screenX = x * this.tileSize - this.camera.x;
        const screenY = y * this.tileSize - this.camera.y;

        this.drawTile(tile, screenX, screenY, x, y);
      }
    }
  }

  private drawTile(
    tile: number,
    screenX: number,
    screenY: number,
    tileX: number,
    tileY: number
  ): void {
    const size = this.tileSize;
    const src = this.srcTileSize;

    // Draw base grass for all tiles first
    if (
      this.outdoorTiles &&
      tile !== VillageTile.Water &&
      tile !== VillageTile.WaterEdge
    ) {
      this.ctx.drawImage(
        this.outdoorTiles,
        0,
        0,
        src,
        src,
        screenX,
        screenY,
        size,
        size
      );
    }

    switch (tile) {
      case VillageTile.Grass1:
        if (this.outdoorTiles) {
          this.ctx.drawImage(
            this.outdoorTiles,
            0,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.Grass2:
        if (this.outdoorTiles) {
          this.ctx.drawImage(
            this.outdoorTiles,
            src,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.Grass3:
        if (this.outdoorTiles) {
          this.ctx.drawImage(
            this.outdoorTiles,
            src * 2,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.GrassFlower:
        if (this.outdoorTiles) {
          this.ctx.drawImage(
            this.outdoorTiles,
            src * 3,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.Path:
        if (this.outdoorTiles) {
          this.ctx.drawImage(
            this.outdoorTiles,
            src * 4,
            src,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.Water:
        if (this.waterTiles) {
          const waterAnim = Math.floor(this.ambientTime / 500) % 3;
          this.ctx.drawImage(
            this.waterTiles,
            waterAnim * src,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        } else {
          this.ctx.fillStyle = "#1e3a5f";
          this.ctx.fillRect(screenX, screenY, size, size);
        }
        break;

      case VillageTile.WaterEdge:
        if (this.waterTiles) {
          this.ctx.drawImage(
            this.waterTiles,
            src * 3,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        }
        break;

      case VillageTile.Bridge:
        if (this.outdoorTiles) {
          // Draw water underneath
          if (this.waterTiles) {
            this.ctx.drawImage(
              this.waterTiles,
              0,
              0,
              src,
              src,
              screenX,
              screenY,
              size,
              size
            );
          }
          // Draw bridge planks
          this.ctx.fillStyle = "#8B4513";
          this.ctx.fillRect(screenX, screenY + size * 0.2, size, size * 0.6);
          this.ctx.fillStyle = "#654321";
          for (let i = 0; i < 4; i++) {
            this.ctx.fillRect(
              screenX,
              screenY + size * 0.2 + i * size * 0.15,
              size,
              2
            );
          }
        }
        break;

      case VillageTile.Dock:
        this.ctx.fillStyle = "#8B4513";
        this.ctx.fillRect(screenX, screenY, size, size);
        this.ctx.fillStyle = "#654321";
        this.ctx.fillRect(screenX + 2, screenY, size - 4, 3);
        this.ctx.fillRect(screenX + 2, screenY + size - 3, size - 4, 3);
        break;

      case VillageTile.Tree:
        // Draw tree
        this.ctx.fillStyle = "#2d5a27";
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + size / 2, screenY);
        this.ctx.lineTo(screenX + size, screenY + size * 0.7);
        this.ctx.lineTo(screenX, screenY + size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();
        // Trunk
        this.ctx.fillStyle = "#654321";
        this.ctx.fillRect(
          screenX + size * 0.35,
          screenY + size * 0.6,
          size * 0.3,
          size * 0.4
        );
        break;

      case VillageTile.Bush:
        this.ctx.fillStyle = "#3d7a3d";
        this.ctx.beginPath();
        this.ctx.arc(
          screenX + size / 2,
          screenY + size * 0.6,
          size * 0.4,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
        break;

      case VillageTile.Rock:
        this.ctx.fillStyle = "#666";
        this.ctx.beginPath();
        this.ctx.ellipse(
          screenX + size / 2,
          screenY + size * 0.6,
          size * 0.4,
          size * 0.3,
          0,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.fillStyle = "#888";
        this.ctx.beginPath();
        this.ctx.ellipse(
          screenX + size / 2,
          screenY + size * 0.5,
          size * 0.3,
          size * 0.2,
          0,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
        break;

      case VillageTile.Fence:
        if (this.fenceTiles) {
          this.ctx.drawImage(
            this.fenceTiles,
            0,
            0,
            src,
            src,
            screenX,
            screenY,
            size,
            size
          );
        } else {
          this.ctx.fillStyle = "#8B4513";
          this.ctx.fillRect(
            screenX + size * 0.1,
            screenY + size * 0.3,
            size * 0.1,
            size * 0.6
          );
          this.ctx.fillRect(
            screenX + size * 0.8,
            screenY + size * 0.3,
            size * 0.1,
            size * 0.6
          );
          this.ctx.fillRect(screenX, screenY + size * 0.4, size, size * 0.1);
          this.ctx.fillRect(screenX, screenY + size * 0.7, size, size * 0.1);
        }
        break;

      case VillageTile.DungeonGate:
        // Dark ominous gate
        this.ctx.fillStyle = "#1a1a28";
        this.ctx.fillRect(screenX, screenY, size, size);
        // Glowing runes
        const runeGlow = Math.sin(this.ambientTime * 0.003) * 0.3 + 0.7;
        this.ctx.fillStyle = `rgba(255, 107, 53, ${runeGlow})`;
        this.ctx.fillRect(
          screenX + size * 0.1,
          screenY + size * 0.2,
          size * 0.2,
          size * 0.1
        );
        this.ctx.fillRect(
          screenX + size * 0.7,
          screenY + size * 0.2,
          size * 0.2,
          size * 0.1
        );
        break;
    }
  }

  private drawBuildings(): void {
    for (const building of this.buildings) {
      if (building.type === "dungeon") continue; // Dungeon gate drawn in tiles

      const screenX = building.x * this.tileSize - this.camera.x;
      const screenY = building.y * this.tileSize - this.camera.y;
      const width = building.width * this.tileSize;
      const height = building.height * this.tileSize;

      // Check if on screen
      if (
        screenX + width < 0 ||
        screenX > this.canvas.getBoundingClientRect().width
      )
        continue;
      if (
        screenY + height < 0 ||
        screenY > this.canvas.getBoundingClientRect().height
      )
        continue;

      // Building base
      let roofColor = "#8B0000";
      let wallColor = "#D2B48C";

      if (building.type === "tavern") {
        roofColor = "#8B4513";
        wallColor = "#DEB887";
      } else if (building.type === "shop") {
        roofColor = "#2F4F4F";
        wallColor = "#D2B48C";
      } else if (building.type === "blacksmith") {
        roofColor = "#4a4a4a";
        wallColor = "#8B7355";
      }

      // Wall
      this.ctx.fillStyle = wallColor;
      this.ctx.fillRect(screenX, screenY + height * 0.3, width, height * 0.7);

      // Roof
      this.ctx.fillStyle = roofColor;
      this.ctx.beginPath();
      this.ctx.moveTo(screenX - width * 0.1, screenY + height * 0.35);
      this.ctx.lineTo(screenX + width / 2, screenY);
      this.ctx.lineTo(screenX + width * 1.1, screenY + height * 0.35);
      this.ctx.closePath();
      this.ctx.fill();

      // Door
      this.ctx.fillStyle = "#654321";
      this.ctx.fillRect(
        screenX + width * 0.4,
        screenY + height * 0.6,
        width * 0.2,
        height * 0.4
      );

      // Windows
      this.ctx.fillStyle = "#FFD700";
      const windowGlow = Math.sin(this.ambientTime * 0.002) * 0.2 + 0.8;
      this.ctx.globalAlpha = windowGlow;
      this.ctx.fillRect(
        screenX + width * 0.15,
        screenY + height * 0.45,
        width * 0.15,
        height * 0.15
      );
      this.ctx.fillRect(
        screenX + width * 0.7,
        screenY + height * 0.45,
        width * 0.15,
        height * 0.15
      );
      this.ctx.globalAlpha = 1;

      // Sign
      this.ctx.fillStyle = "#000";
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.fillText(building.name, screenX + 4, screenY + height * 0.25);
    }
  }

  private drawNPCs(): void {
    for (const npc of this.npcs) {
      const screenX = npc.x * this.tileSize - this.camera.x;
      const screenY = npc.y * this.tileSize - this.camera.y;
      const size = this.tileSize;

      // Simple NPC representation
      // Body
      this.ctx.fillStyle = "#4a4a8a";
      this.ctx.fillRect(
        screenX + size * 0.25,
        screenY + size * 0.4,
        size * 0.5,
        size * 0.5
      );

      // Head
      this.ctx.fillStyle = "#FFE4C4";
      this.ctx.beginPath();
      this.ctx.arc(
        screenX + size / 2,
        screenY + size * 0.3,
        size * 0.2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Exclamation mark if close
      const playerTileX = Math.floor(this.playerState.x / this.tileSize);
      const playerTileY = Math.floor(this.playerState.y / this.tileSize);
      const dist =
        Math.abs(npc.x - playerTileX) + Math.abs(npc.y - playerTileY);

      if (dist <= 3) {
        const bounce = Math.sin(this.ambientTime * 0.005) * 5;
        this.ctx.fillStyle = "#FFD700";
        this.ctx.font = 'bold 16px "Press Start 2P", monospace';
        this.ctx.fillText("!", screenX + size * 0.4, screenY - 10 + bounce);
      }
    }
  }

  private drawPlayer(): void {
    const screenX = this.playerState.x - this.camera.x;
    const screenY = this.playerState.y - this.camera.y;
    const size = this.tileSize;

    // Shadow
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    this.ctx.beginPath();
    this.ctx.ellipse(
      screenX,
      screenY + size * 0.4,
      size * 0.3,
      size * 0.1,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Player body
    this.ctx.fillStyle = COLORS.playerMain;
    this.ctx.fillRect(
      screenX - size * 0.2,
      screenY - size * 0.3,
      size * 0.4,
      size * 0.5
    );

    // Head
    this.ctx.fillStyle = "#FFE4C4";
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY - size * 0.35, size * 0.2, 0, Math.PI * 2);
    this.ctx.fill();

    // Glow effect
    const glow = this.ctx.createRadialGradient(
      screenX,
      screenY,
      0,
      screenX,
      screenY,
      size
    );
    glow.addColorStop(0, "rgba(255, 107, 53, 0.3)");
    glow.addColorStop(1, "transparent");
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(screenX - size, screenY - size, size * 2, size * 2);
  }

  private drawDungeonGlow(): void {
    const gateX = 19 * this.tileSize - this.camera.x;
    const gateY = 1.5 * this.tileSize - this.camera.y;

    const pulse = Math.sin(this.ambientTime * 0.002) * 0.3 + 0.7;
    const gradient = this.ctx.createRadialGradient(
      gateX,
      gateY,
      0,
      gateX,
      gateY,
      this.tileSize * 4
    );
    gradient.addColorStop(0, `rgba(255, 80, 30, ${0.5 * pulse})`);
    gradient.addColorStop(0.5, `rgba(255, 50, 20, ${0.2 * pulse})`);
    gradient.addColorStop(1, "transparent");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      gateX - this.tileSize * 4,
      gateY - this.tileSize * 4,
      this.tileSize * 8,
      this.tileSize * 8
    );
  }

  private drawParticles(width: number, height: number): void {
    // Floating ember particles
    this.ctx.fillStyle = "rgba(255, 200, 100, 0.4)";
    for (let i = 0; i < 30; i++) {
      const x = (i * 97 + this.ambientTime * 0.015) % width;
      const y = (i * 53 + Math.sin(this.ambientTime * 0.001 + i) * 30) % height;
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
