// ============================================
// GRID & TILE CONSTANTS
// ============================================

export const GRID_SIZE = 11;
export const TILE_SIZE = 64; // pixels
export const HALF_TILE = TILE_SIZE / 2;

// ============================================
// VISIBILITY
// ============================================

export const VISIBILITY_RADIUS = 2; // 5x5 area (2 tiles in each direction + center)

// ============================================
// PLAYER STATS
// ============================================

export const MAX_HEALTH = 100;
export const COMBAT_RANGE = 2;

// ============================================
// ANIMATION TIMING (ms)
// ============================================

export const MOVE_ANIMATION_DURATION = 150;
export const FOG_REVEAL_DURATION = 300;
export const DAMAGE_FLASH_DURATION = 200;
export const GOLD_COLLECT_DURATION = 400;

// ============================================
// COLORS - Dark Fantasy Palette
// ============================================

export const COLORS = {
  // Background & Abyss
  abyssDeep: "#0a0a0f",
  abyssMid: "#0f0f18",
  abyssLight: "#151520",

  // Floor tiles
  floorBase: "#1a1a2e",
  floorHighlight: "#252540",
  floorBorder: "#2a2a3d",

  // Wall tiles
  wallBase: "#0d0d14",
  wallHighlight: "#15151f",
  wallBorder: "#1f1f2d",

  // Fog of war
  fogDense: "#0a0a0f",
  fogMid: "#12121c",
  fogLight: "#1a1a26",

  // Player
  playerMain: "#ff6b35",
  playerGlow: "rgba(255, 107, 53, 0.5)",
  playerTrail: "rgba(255, 107, 53, 0.2)",

  // Enemy (when visible in combat)
  enemyMain: "#8b3a75",
  enemyGlow: "rgba(139, 58, 117, 0.5)",

  // Treasure / Gold
  goldMain: "#ffd700",
  goldGlow: "rgba(255, 215, 0, 0.4)",
  goldDim: "#b8960a",

  // Exit
  exitMain: "#4ade80",
  exitGlow: "rgba(74, 222, 128, 0.4)",
  exitPulse: "rgba(74, 222, 128, 0.2)",

  // UI
  healthFull: "#22c55e",
  healthMid: "#eab308",
  healthLow: "#ef4444",
  healthBg: "#1f1f2d",

  // Danger warning
  dangerRed: "#ff3535",
  dangerGlow: "rgba(255, 53, 53, 0.5)",

  // Mystic purple (UI accents)
  mysticDark: "#4a1942",
  mysticMid: "#6b2d5c",
  mysticLight: "#8b3a75",

  // Text
  textPrimary: "#e0e0e0",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  textGold: "#ffd700",
};

// ============================================
// SOLANA CONSTANTS
// ============================================

// Our deployed program ID
export const PROGRAM_ID = "GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh";

// Standard Solana Devnet
export const DEVNET_RPC = "https://api.devnet.solana.com";
export const DEVNET_WS = "wss://api.devnet.solana.com";

// ============================================
// MAGICBLOCK ENDPOINTS - TEE & Ephemeral Rollups
// ============================================

export const MAGICBLOCK = {
  // TEE Devnet - Private Ephemeral Rollups endpoint
  TEE_RPC: "https://tee.magicblock.app",
  TEE_WS: "wss://tee.magicblock.app",

  // Standard ER Devnet (non-TEE)
  ER_RPC: "https://devnet.magicblock.app",
  ER_WS: "wss://devnet.magicblock.app",

  // TEE Validator public key - where accounts get delegated
  TEE_VALIDATOR: "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA",

  // MagicBlock program IDs
  DELEGATION_PROGRAM: "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
  PERMISSION_PROGRAM: "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",

  // Magic Actions (for undelegation)
  MAGIC_PROGRAM: "Magic11111111111111111111111111111111111111",
  MAGIC_CONTEXT: "MagicContext1111111111111111111111111111111",
};

// ============================================
// TILE SPRITES (Unicode for now, replace with images later)
// ============================================

export const TILE_SPRITES = {
  floor: null, // Will be rendered as colored rect
  wall: null,
  exit: null,
  treasure: null,
  player: null,
  enemy: null,
  fog: null,
};

// ============================================
// PICOVILLAGE ASSETS
// ============================================

export const ASSETS = {
  tiles: {
    outdoor: "/assets/tiles/OutDoorTiles.png",
    water: "/assets/tiles/WaterTileSet.png",
    fence: "/assets/tiles/FenceTiles.png",
    docks: "/assets/tiles/DocksTiles.png",
    rocks: "/assets/tiles/LoftedRocks.png",
  },
  buildings: {
    main: "/assets/buildings/BuildingsTileSet.png",
  },
  objects: {
    misc: "/assets/objects/Misc.png",
  },
  characters: {
    player: "/assets/characters/PlayerCharacterTILE.png",
    walkCycle: "/assets/characters/PlayerWalkCycleTemplate.png",
  },
};

// ============================================
// COMBAT CONSTANTS
// ============================================

export const COMBAT = {
  attackDamage: 30,
  defendReflect: 10,
  fleeChance: 0.7,
  critMultiplier: 1.5,
  goldDropPercent: 0.5,
};

// ============================================
// DEFAULT GAME STATE
// ============================================

export const DEFAULT_PLAYER_STATE = {
  position: { x: 1, y: 1 },
  health: MAX_HEALTH,
  gold: 0,
  isAlive: true,
};

// ============================================
// DEBUG FLAGS
// ============================================

export const DEBUG = {
  showGrid: false,
  showFPS: false,
  disableFog: false,
  showCollision: false,
};

// ============================================
// GAME CONFIG
// ============================================

export const GAME_CONFIG = {
  // Village map size
  VILLAGE_WIDTH: 40,
  VILLAGE_HEIGHT: 30,

  // Dungeon config
  DUNGEON_WIDTH: 15,
  DUNGEON_HEIGHT: 15,

  // Tile rendering
  TILE_SOURCE_SIZE: 16, // PicoVillage tiles are 16x16
  TILE_RENDER_SCALE: 3, // Scale up for crisp pixel art

  // Player movement speed (pixels per frame)
  PLAYER_SPEED: 4,

  // Camera smoothing (0-1, higher = faster)
  CAMERA_SMOOTHING: 0.12,
};
