// ============================================
// TILESET DEFINITIONS - Pixel Art Assets
// ============================================

// Dungeon tileset: 256x112, 16x16 tiles = 16 cols x 7 rows
export const DUNGEON_TILESET = {
  src: '/tiles/dungeons_demo.png',
  tileSize: 16,
  cols: 16,
  rows: 7,
  tiles: {
    // Floors
    floorStone1: { x: 0, y: 0 },
    floorStone2: { x: 1, y: 0 },
    floorStone3: { x: 2, y: 0 },
    floorStoneCracked: { x: 3, y: 0 },
    floorDirt1: { x: 4, y: 0 },
    floorDirt2: { x: 5, y: 0 },
    
    // Walls
    wallTop: { x: 0, y: 1 },
    wallMid: { x: 1, y: 1 },
    wallBottom: { x: 2, y: 1 },
    wallLeft: { x: 3, y: 1 },
    wallRight: { x: 4, y: 1 },
    wallCornerTL: { x: 5, y: 1 },
    wallCornerTR: { x: 6, y: 1 },
    wallCornerBL: { x: 7, y: 1 },
    wallCornerBR: { x: 8, y: 1 },
    
    // Decorations
    torch: { x: 0, y: 2 },
    chest: { x: 1, y: 2 },
    chestOpen: { x: 2, y: 2 },
    barrel: { x: 3, y: 2 },
    crate: { x: 4, y: 2 },
    bones: { x: 5, y: 2 },
    skull: { x: 6, y: 2 },
    
    // Doors and exits
    doorClosed: { x: 0, y: 3 },
    doorOpen: { x: 1, y: 3 },
    stairs: { x: 2, y: 3 },
    portal: { x: 3, y: 3 },
    
    // Dark/fog tiles
    fog: { x: 0, y: 6 },
    fogEdge: { x: 1, y: 6 },
  }
};

// Village ground tileset: 256x256, 16x16 tiles
export const VILLAGE_GROUND = {
  src: '/tiles/ground_demo.png',
  tileSize: 16,
  cols: 16,
  rows: 16,
  tiles: {
    grass1: { x: 0, y: 0 },
    grass2: { x: 1, y: 0 },
    grass3: { x: 2, y: 0 },
    pathCenter: { x: 4, y: 0 },
    pathEdgeTop: { x: 4, y: 1 },
    pathEdgeBottom: { x: 4, y: 2 },
    pathEdgeLeft: { x: 3, y: 1 },
    pathEdgeRight: { x: 5, y: 1 },
    water: { x: 8, y: 0 },
  }
};

// Character sprite sheets - these are large sheets with animation frames
export const CHARACTER_SPRITES = {
  warrior: {
    src: '/sprites/warrior.png',
    sheetWidth: 3200,
    sheetHeight: 3200,
    frameSize: 200, // Each frame is 200x200
    cols: 16,
    rows: 16,
    animations: {
      idle: { row: 0, frames: 8, speed: 150 },
      walk: { row: 1, frames: 8, speed: 100 },
      attack: { row: 2, frames: 6, speed: 80 },
      hurt: { row: 3, frames: 4, speed: 100 },
      death: { row: 4, frames: 6, speed: 150 },
    }
  },
  villain: {
    src: '/sprites/villain.png',
    sheetWidth: 3200,
    sheetHeight: 3200,
    frameSize: 200,
    cols: 16,
    rows: 16,
    animations: {
      idle: { row: 0, frames: 8, speed: 150 },
      walk: { row: 1, frames: 8, speed: 100 },
      attack: { row: 2, frames: 6, speed: 80 },
      hurt: { row: 3, frames: 4, speed: 100 },
      death: { row: 4, frames: 6, speed: 150 },
    }
  }
};

// Preload all images
const imageCache = new Map<string, HTMLImageElement>();

export async function preloadAllAssets(): Promise<void> {
  const sources = [
    DUNGEON_TILESET.src,
    VILLAGE_GROUND.src,
    '/tiles/objects_demo.png',
    '/tiles/premade_buildings_demo.png',
    CHARACTER_SPRITES.warrior.src,
    CHARACTER_SPRITES.villain.src,
  ];

  await Promise.all(sources.map(src => loadImage(src)));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export function getImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) || null;
}
