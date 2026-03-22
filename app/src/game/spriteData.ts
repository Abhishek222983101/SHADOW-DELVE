import { SpriteConfig } from "./spriteAnimator";

// ============================================
// SPRITE CONFIGURATIONS
// Both warrior and villain are 3200x3200 sprite sheets
// with 16x16 frames of 200x200 pixels each
// ============================================

export const WARRIOR_CONFIG: SpriteConfig = {
  src: "/sprites/warrior.png",
  frameWidth: 200,
  frameHeight: 200,
  animations: {
    idle: { row: 0, frames: 6, speed: 150, loop: true },
    run: { row: 1, frames: 8, speed: 80, loop: true },
    attack1: { row: 2, frames: 6, speed: 60, loop: false },
    attack2: { row: 3, frames: 6, speed: 60, loop: false },
    heavy: { row: 4, frames: 8, speed: 70, loop: false },
    block: { row: 5, frames: 4, speed: 100, loop: false },
    hurt: { row: 6, frames: 4, speed: 80, loop: false },
    death: { row: 7, frames: 8, speed: 120, loop: false },
  },
};

export const VILLAIN_CONFIG: SpriteConfig = {
  src: "/sprites/villain.png",
  frameWidth: 200,
  frameHeight: 200,
  animations: {
    idle: { row: 0, frames: 6, speed: 150, loop: true },
    run: { row: 1, frames: 8, speed: 80, loop: true },
    attack1: { row: 2, frames: 6, speed: 60, loop: false },
    attack2: { row: 3, frames: 6, speed: 60, loop: false },
    heavy: { row: 4, frames: 8, speed: 70, loop: false },
    block: { row: 5, frames: 4, speed: 100, loop: false },
    hurt: { row: 6, frames: 4, speed: 80, loop: false },
    death: { row: 7, frames: 8, speed: 120, loop: false },
  },
};

// Legacy export for backward compatibility with existing code
export const SPRITE_DATA = {
  warrior: {
    src: "/sprites/warrior.png",
    frameWidth: 200,
    frameHeight: 200,
    animations: {
      idle: { row: 0, frames: 6, speed: 150 },
      run: { row: 1, frames: 8, speed: 80 },
      attack1: { row: 2, frames: 6, speed: 60 },
      attack2: { row: 3, frames: 6, speed: 60 },
      heavy: { row: 4, frames: 8, speed: 70 },
      block: { row: 5, frames: 4, speed: 100 },
      hurt: { row: 6, frames: 4, speed: 80 },
      death: { row: 7, frames: 8, speed: 120 },
    },
  },
  villain: {
    src: "/sprites/villain.png",
    frameWidth: 200,
    frameHeight: 200,
    animations: {
      idle: { row: 0, frames: 6, speed: 150 },
      run: { row: 1, frames: 8, speed: 80 },
      attack1: { row: 2, frames: 6, speed: 60 },
      attack2: { row: 3, frames: 6, speed: 60 },
      heavy: { row: 4, frames: 8, speed: 70 },
      block: { row: 5, frames: 4, speed: 100 },
      hurt: { row: 6, frames: 4, speed: 80 },
      death: { row: 7, frames: 8, speed: 120 },
    },
  },
};
