// ============================================
// GRID & TILE CONSTANTS
// ============================================

export const GRID_SIZE = 11
export const TILE_SIZE = 64 // pixels
export const HALF_TILE = TILE_SIZE / 2

// ============================================
// VISIBILITY
// ============================================

export const VISIBILITY_RADIUS = 2 // 5x5 area (2 tiles in each direction + center)

// ============================================
// PLAYER STATS
// ============================================

export const MAX_HEALTH = 100
export const COMBAT_RANGE = 2

// ============================================
// ANIMATION TIMING (ms)
// ============================================

export const MOVE_ANIMATION_DURATION = 150
export const FOG_REVEAL_DURATION = 300
export const DAMAGE_FLASH_DURATION = 200
export const GOLD_COLLECT_DURATION = 400

// ============================================
// COLORS - Dark Fantasy Palette
// ============================================

export const COLORS = {
  // Background & Abyss
  abyssDeep: '#0a0a0f',
  abyssMid: '#0f0f18',
  abyssLight: '#151520',
  
  // Floor tiles
  floorBase: '#1a1a2e',
  floorHighlight: '#252540',
  floorBorder: '#2a2a3d',
  
  // Wall tiles
  wallBase: '#0d0d14',
  wallHighlight: '#15151f',
  wallBorder: '#1f1f2d',
  
  // Fog of war
  fogDense: '#0a0a0f',
  fogMid: '#12121c',
  fogLight: '#1a1a26',
  
  // Player
  playerMain: '#ff6b35',
  playerGlow: 'rgba(255, 107, 53, 0.5)',
  playerTrail: 'rgba(255, 107, 53, 0.2)',
  
  // Enemy (when visible in combat)
  enemyMain: '#8b3a75',
  enemyGlow: 'rgba(139, 58, 117, 0.5)',
  
  // Treasure / Gold
  goldMain: '#ffd700',
  goldGlow: 'rgba(255, 215, 0, 0.4)',
  goldDim: '#b8960a',
  
  // Exit
  exitMain: '#4ade80',
  exitGlow: 'rgba(74, 222, 128, 0.4)',
  exitPulse: 'rgba(74, 222, 128, 0.2)',
  
  // UI
  healthFull: '#22c55e',
  healthMid: '#eab308',
  healthLow: '#ef4444',
  healthBg: '#1f1f2d',
  
  // Danger warning
  dangerRed: '#ff3535',
  dangerGlow: 'rgba(255, 53, 53, 0.5)',
  
  // Mystic purple (UI accents)
  mysticDark: '#4a1942',
  mysticMid: '#6b2d5c',
  mysticLight: '#8b3a75',
  
  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  textGold: '#ffd700',
}

// ============================================
// SOLANA CONSTANTS
// ============================================

export const PROGRAM_ID = '2ECrapxCqnz3ofYpEVymH732uJo2G5fBZRjNZ4BRWFqW'

export const DEVNET_RPC = 'https://api.devnet.solana.com'
export const DEVNET_WS = 'wss://api.devnet.solana.com'

// MagicBlock endpoints
export const MAGICBLOCK_ER_DEVNET = 'https://devnet.magicblock.app'
export const MAGICBLOCK_TEE_DEVNET = 'https://tee.devnet.magicblock.app'

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
}

// ============================================
// COMBAT CONSTANTS
// ============================================

export const COMBAT = {
  attackDamage: 30,
  defendReflect: 10,
  fleeChance: 0.7,
  critMultiplier: 1.5,
  goldDropPercent: 0.5,
}

// ============================================
// DEFAULT GAME STATE
// ============================================

export const DEFAULT_PLAYER_STATE = {
  position: { x: 1, y: 1 },
  health: MAX_HEALTH,
  gold: 0,
  isAlive: true,
}

// ============================================
// DEBUG FLAGS
// ============================================

export const DEBUG = {
  showGrid: false,
  showFPS: false,
  disableFog: false,
  showCollision: false,
}
