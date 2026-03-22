// ============================================
// SPRITE ANIMATOR - Handles sprite sheet animations
// Supports 3200x3200 sheets with 200x200 frames (16x16 grid)
// ============================================

export interface AnimationConfig {
  row: number;
  frames: number;
  speed: number; // ms per frame
  loop?: boolean;
}

export interface SpriteConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<string, AnimationConfig>;
}

export type AnimationState =
  | "idle"
  | "run"
  | "attack1"
  | "attack2"
  | "heavy"
  | "block"
  | "hurt"
  | "death";
export type Direction = "left" | "right";

export class SpriteAnimator {
  private image: HTMLImageElement | null = null;
  private config: SpriteConfig;
  private currentAnim: AnimationState = "idle";
  private currentFrame: number = 0;
  private frameTime: number = 0;
  private direction: Direction = "right";
  private isLoaded: boolean = false;
  private onAnimationComplete?: () => void;
  private isOneShot: boolean = false;

  constructor(config: SpriteConfig) {
    this.config = config;
  }

  async load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.isLoaded = true;
        resolve();
      };
      img.onerror = () =>
        reject(new Error(`Failed to load sprite: ${this.config.src}`));
      img.src = this.config.src;
    });
  }

  setAnimation(anim: AnimationState, onComplete?: () => void): void {
    if (this.currentAnim === anim && !onComplete) return;

    this.currentAnim = anim;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.onAnimationComplete = onComplete;

    // One-shot animations (attacks, hurt, death)
    this.isOneShot = ["attack1", "attack2", "heavy", "hurt", "death"].includes(
      anim
    );
  }

  setDirection(dir: Direction): void {
    this.direction = dir;
  }

  getDirection(): Direction {
    return this.direction;
  }

  getCurrentAnimation(): AnimationState {
    return this.currentAnim;
  }

  isAnimationComplete(): boolean {
    const animConfig = this.config.animations[this.currentAnim];
    if (!animConfig) return true;
    return this.isOneShot && this.currentFrame >= animConfig.frames - 1;
  }

  update(deltaTime: number): void {
    if (!this.isLoaded) return;

    const animConfig = this.config.animations[this.currentAnim];
    if (!animConfig) return;

    this.frameTime += deltaTime;

    if (this.frameTime >= animConfig.speed) {
      this.frameTime = 0;
      this.currentFrame++;

      // Handle animation completion
      if (this.currentFrame >= animConfig.frames) {
        if (this.isOneShot) {
          // Stay on last frame, call callback
          this.currentFrame = animConfig.frames - 1;
          if (this.onAnimationComplete) {
            this.onAnimationComplete();
            this.onAnimationComplete = undefined;
          }
        } else {
          // Loop
          this.currentFrame = 0;
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number = 1,
    options?: {
      alpha?: number;
      tint?: string;
      outline?: string;
      shadow?: boolean;
    }
  ): void {
    if (!this.image || !this.isLoaded) return;

    const animConfig = this.config.animations[this.currentAnim];
    if (!animConfig) return;

    const { frameWidth, frameHeight } = this.config;

    // Source rectangle from sprite sheet
    const sx = this.currentFrame * frameWidth;
    const sy = animConfig.row * frameHeight;

    // Destination size
    const dw = frameWidth * scale;
    const dh = frameHeight * scale;

    ctx.save();

    // Apply alpha if specified
    if (options?.alpha !== undefined) {
      ctx.globalAlpha = options.alpha;
    }

    // Position and flip based on direction
    ctx.translate(x, y);
    if (this.direction === "left") {
      ctx.scale(-1, 1);
    }

    // Draw shadow underneath
    if (options?.shadow) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(0, dh / 2 - 10, dw * 0.3, dh * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the sprite
    ctx.drawImage(
      this.image,
      sx,
      sy,
      frameWidth,
      frameHeight,
      -dw / 2,
      -dh / 2,
      dw,
      dh
    );

    // Draw outline if specified (for highlighting)
    if (options?.outline) {
      ctx.strokeStyle = options.outline;
      ctx.lineWidth = 2;
      ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);
    }

    ctx.restore();
  }

  // Draw with glow effect (for combat emphasis)
  drawWithGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    glowColor: string,
    glowIntensity: number = 0.5
  ): void {
    if (!this.image || !this.isLoaded) return;

    // Draw glow
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 100 * scale);
    gradient.addColorStop(
      0,
      glowColor.replace(")", `, ${glowIntensity})`).replace("rgb", "rgba")
    );
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 100 * scale, y - 100 * scale, 200 * scale, 200 * scale);
    ctx.restore();

    // Draw sprite
    this.draw(ctx, x, y, scale, { shadow: true });
  }

  getFrameInfo(): { frame: number; total: number; anim: string } {
    const animConfig = this.config.animations[this.currentAnim];
    return {
      frame: this.currentFrame,
      total: animConfig?.frames || 0,
      anim: this.currentAnim,
    };
  }

  isReady(): boolean {
    return this.isLoaded;
  }
}

// ============================================
// SPRITE MANAGER - Handles multiple sprites
// ============================================

export class SpriteManager {
  private sprites: Map<string, SpriteAnimator> = new Map();
  private loadPromises: Map<string, Promise<void>> = new Map();

  async loadSprite(id: string, config: SpriteConfig): Promise<SpriteAnimator> {
    // Return existing if already loaded
    const existing = this.sprites.get(id);
    if (existing?.isReady()) return existing;

    // Return existing promise if loading
    const existingPromise = this.loadPromises.get(id);
    if (existingPromise) {
      await existingPromise;
      return this.sprites.get(id)!;
    }

    // Create and load new sprite
    const sprite = new SpriteAnimator(config);
    const loadPromise = sprite.load().then(() => {
      this.sprites.set(id, sprite);
    });

    this.loadPromises.set(id, loadPromise);
    await loadPromise;

    return sprite;
  }

  getSprite(id: string): SpriteAnimator | undefined {
    return this.sprites.get(id);
  }

  updateAll(deltaTime: number): void {
    this.sprites.forEach((sprite) => sprite.update(deltaTime));
  }
}

// Global sprite manager instance
export const spriteManager = new SpriteManager();
