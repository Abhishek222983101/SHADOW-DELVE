// ============================================
// COMBAT RENDERER - Full sprite-based combat with effects
// Characters close together, attack animations, screen shake,
// damage numbers, block effects
// ============================================

import { SpriteAnimator, AnimationState } from "./spriteAnimator";
import { WARRIOR_CONFIG, VILLAIN_CONFIG } from "./spriteData";

// ============================================
// TYPES
// ============================================

export type CombatActionType = "attack" | "heavy" | "block" | "dodge";

interface DamageNumber {
  value: number;
  x: number;
  y: number;
  startTime: number;
  isCrit: boolean;
  isPlayer: boolean;
}

interface CombatEffect {
  type: "slash" | "block" | "dodge" | "hit";
  x: number;
  y: number;
  startTime: number;
  angle: number;
}

interface ScreenShake {
  intensity: number;
  duration: number;
  startTime: number;
}

// ============================================
// COMBAT RENDERER CLASS
// ============================================

export class CombatRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private width: number = 0;
  private height: number = 0;

  // Sprites
  private playerSprite: SpriteAnimator;
  private enemySprite: SpriteAnimator;
  private isLoaded: boolean = false;

  // Animation timing
  private lastTime: number = 0;
  private ambientTime: number = 0;

  // Combat state
  private playerAction: CombatActionType | null = null;
  private enemyAction: CombatActionType | null = null;
  private isResolvingCombat: boolean = false;

  // Effects
  private damageNumbers: DamageNumber[] = [];
  private effects: CombatEffect[] = [];
  private screenShake: ScreenShake | null = null;

  // Character positions (world space, will be offset by screen shake)
  private playerBaseX: number = 0;
  private playerBaseY: number = 0;
  private enemyBaseX: number = 0;
  private enemyBaseY: number = 0;

  // Animation callbacks
  private onActionComplete?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.playerSprite = new SpriteAnimator(WARRIOR_CONFIG);
    this.enemySprite = new SpriteAnimator(VILLAIN_CONFIG);

    // Enemy faces left
    this.enemySprite.setDirection("left");
  }

  async loadAssets(): Promise<void> {
    await Promise.all([this.playerSprite.load(), this.enemySprite.load()]);
    this.isLoaded = true;
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    this.width = width;
    this.height = height;

    // Position characters close together (about 1/3 of screen apart)
    // Player on left, enemy on right
    const centerY = height * 0.55;
    const separation = width * 0.18; // Close together!

    this.playerBaseX = width / 2 - separation;
    this.playerBaseY = centerY;
    this.enemyBaseX = width / 2 + separation;
    this.enemyBaseY = centerY;
  }

  // ============================================
  // COMBAT ACTIONS
  // ============================================

  setPlayerAction(action: CombatActionType, onComplete?: () => void): void {
    this.playerAction = action;
    this.onActionComplete = onComplete;

    // Map action to animation
    const animMap: Record<CombatActionType, AnimationState> = {
      attack: "attack1",
      heavy: "heavy",
      block: "block",
      dodge: "run", // Use run as dodge dash
    };

    this.playerSprite.setAnimation(animMap[action], () => {
      // Animation finished
      this.playerSprite.setAnimation("idle");
      this.playerAction = null;

      if (this.onActionComplete) {
        this.onActionComplete();
        this.onActionComplete = undefined;
      }
    });

    // Add slash effect for attacks
    if (action === "attack" || action === "heavy") {
      this.addEffect("slash", this.playerBaseX + 60, this.playerBaseY - 20, 0);
    }
  }

  setEnemyAction(action: CombatActionType): void {
    this.enemyAction = action;

    const animMap: Record<CombatActionType, AnimationState> = {
      attack: "attack1",
      heavy: "heavy",
      block: "block",
      dodge: "run",
    };

    this.enemySprite.setAnimation(animMap[action], () => {
      this.enemySprite.setAnimation("idle");
      this.enemyAction = null;
    });

    // Add slash effect for enemy attacks
    if (action === "attack" || action === "heavy") {
      this.addEffect(
        "slash",
        this.enemyBaseX - 60,
        this.enemyBaseY - 20,
        Math.PI
      );
    }
  }

  // Called when damage is dealt
  showDamage(damage: number, isPlayer: boolean, isCrit: boolean = false): void {
    const targetX = isPlayer ? this.playerBaseX : this.enemyBaseX;
    const targetY = isPlayer ? this.playerBaseY : this.enemyBaseY;

    // Add damage number
    this.damageNumbers.push({
      value: damage,
      x: targetX + (Math.random() - 0.5) * 40,
      y: targetY - 50,
      startTime: this.ambientTime,
      isCrit,
      isPlayer,
    });

    // Play hurt animation on target
    if (isPlayer) {
      this.playerSprite.setAnimation("hurt", () => {
        this.playerSprite.setAnimation("idle");
      });
    } else {
      this.enemySprite.setAnimation("hurt", () => {
        this.enemySprite.setAnimation("idle");
      });
    }

    // Add hit effect
    this.addEffect("hit", targetX, targetY - 20, 0);

    // Screen shake
    this.triggerScreenShake(isCrit ? 12 : 6, 300);
  }

  showBlock(isPlayer: boolean): void {
    const targetX = isPlayer ? this.playerBaseX : this.enemyBaseX;
    const targetY = isPlayer ? this.playerBaseY : this.enemyBaseY;

    this.addEffect("block", targetX, targetY - 20, 0);
    this.triggerScreenShake(3, 150);
  }

  showDodge(isPlayer: boolean): void {
    const targetX = isPlayer ? this.playerBaseX : this.enemyBaseX;
    const targetY = isPlayer ? this.playerBaseY : this.enemyBaseY;

    this.addEffect("dodge", targetX, targetY, 0);
  }

  playDeathAnimation(isPlayer: boolean): void {
    if (isPlayer) {
      this.playerSprite.setAnimation("death");
    } else {
      this.enemySprite.setAnimation("death");
    }
    this.triggerScreenShake(15, 500);
  }

  // ============================================
  // EFFECTS
  // ============================================

  private addEffect(
    type: CombatEffect["type"],
    x: number,
    y: number,
    angle: number
  ): void {
    this.effects.push({
      type,
      x,
      y,
      startTime: this.ambientTime,
      angle,
    });
  }

  private triggerScreenShake(intensity: number, duration: number): void {
    this.screenShake = {
      intensity,
      duration,
      startTime: this.ambientTime,
    };
  }

  private getScreenShakeOffset(): { x: number; y: number } {
    if (!this.screenShake) return { x: 0, y: 0 };

    const elapsed = this.ambientTime - this.screenShake.startTime;
    if (elapsed > this.screenShake.duration) {
      this.screenShake = null;
      return { x: 0, y: 0 };
    }

    const decay = 1 - elapsed / this.screenShake.duration;
    const intensity = this.screenShake.intensity * decay;

    return {
      x: (Math.random() - 0.5) * intensity * 2,
      y: (Math.random() - 0.5) * intensity * 2,
    };
  }

  // ============================================
  // UPDATE & RENDER
  // ============================================

  update(time: number): void {
    const deltaTime = this.lastTime ? time - this.lastTime : 16;
    this.lastTime = time;
    this.ambientTime += deltaTime;

    // Update sprites
    this.playerSprite.update(deltaTime);
    this.enemySprite.update(deltaTime);

    // Clean up old damage numbers (fade after 1 second)
    this.damageNumbers = this.damageNumbers.filter(
      (d) => this.ambientTime - d.startTime < 1000
    );

    // Clean up old effects
    this.effects = this.effects.filter(
      (e) => this.ambientTime - e.startTime < 500
    );
  }

  render(): void {
    if (!this.isLoaded) return;

    const shake = this.getScreenShakeOffset();

    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);

    // Draw background
    this.drawArenaBackground();

    // Draw ground/platform
    this.drawArenaPlatform();

    // Draw characters
    this.drawCharacters();

    // Draw effects
    this.drawEffects();

    // Draw damage numbers
    this.drawDamageNumbers();

    this.ctx.restore();

    // Draw vignette (no shake)
    this.drawVignette();
  }

  private drawArenaBackground(): void {
    // Dark dungeon arena gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#0a0a18");
    gradient.addColorStop(0.3, "#0f0f24");
    gradient.addColorStop(0.7, "#12122a");
    gradient.addColorStop(1, "#0a0a15");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Background pillars/columns
    this.ctx.fillStyle = "#1a1a2a";
    const pillarWidth = 60;
    const pillarHeight = this.height * 0.7;
    // Left pillars
    this.ctx.fillRect(
      50,
      this.height - pillarHeight,
      pillarWidth,
      pillarHeight
    );
    this.ctx.fillRect(
      130,
      this.height - pillarHeight * 0.8,
      pillarWidth * 0.8,
      pillarHeight * 0.8
    );
    // Right pillars
    this.ctx.fillRect(
      this.width - 110,
      this.height - pillarHeight,
      pillarWidth,
      pillarHeight
    );
    this.ctx.fillRect(
      this.width - 180,
      this.height - pillarHeight * 0.8,
      pillarWidth * 0.8,
      pillarHeight * 0.8
    );

    // Pillar highlights
    this.ctx.fillStyle = "#252540";
    this.ctx.fillRect(50, this.height - pillarHeight, 10, pillarHeight);
    this.ctx.fillRect(
      this.width - 110,
      this.height - pillarHeight,
      10,
      pillarHeight
    );

    // Ambient torchlight glow
    const flicker = Math.sin(this.ambientTime * 0.01) * 0.15 + 0.85;
    const torch1 = this.ctx.createRadialGradient(
      80,
      this.height * 0.35,
      0,
      80,
      this.height * 0.35,
      150
    );
    torch1.addColorStop(0, `rgba(255, 120, 50, ${0.3 * flicker})`);
    torch1.addColorStop(1, "transparent");
    this.ctx.fillStyle = torch1;
    this.ctx.fillRect(0, 0, 300, this.height);

    const torch2 = this.ctx.createRadialGradient(
      this.width - 80,
      this.height * 0.35,
      0,
      this.width - 80,
      this.height * 0.35,
      150
    );
    torch2.addColorStop(0, `rgba(255, 120, 50, ${0.3 * flicker})`);
    torch2.addColorStop(1, "transparent");
    this.ctx.fillStyle = torch2;
    this.ctx.fillRect(this.width - 300, 0, 300, this.height);
  }

  private drawArenaPlatform(): void {
    const platformY = this.height * 0.7;

    // Main platform
    this.ctx.fillStyle = "#1a1a28";
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.width / 2,
      platformY,
      this.width * 0.4,
      60,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Platform edge highlight
    this.ctx.strokeStyle = "#2a2a40";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.width / 2,
      platformY,
      this.width * 0.4,
      60,
      0,
      Math.PI,
      0
    );
    this.ctx.stroke();

    // Center glow (combat intensity indicator)
    const centerGlow = this.ctx.createRadialGradient(
      this.width / 2,
      platformY - 50,
      0,
      this.width / 2,
      platformY - 50,
      200
    );
    const glowIntensity = Math.sin(this.ambientTime * 0.002) * 0.1 + 0.2;
    centerGlow.addColorStop(0, `rgba(255, 50, 50, ${glowIntensity})`);
    centerGlow.addColorStop(1, "transparent");
    this.ctx.fillStyle = centerGlow;
    this.ctx.fillRect(this.width / 2 - 200, platformY - 250, 400, 300);
  }

  private drawCharacters(): void {
    // Calculate scale based on viewport (characters should be big!)
    const scale = Math.min(this.width, this.height) / 600;
    const spriteScale = Math.max(0.5, Math.min(scale * 0.6, 0.8));

    // Draw shadows under characters
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.playerBaseX,
      this.playerBaseY + 45,
      40,
      12,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(
      this.enemyBaseX,
      this.enemyBaseY + 45,
      40,
      12,
      0,
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    // Player glow
    const playerGlow = this.ctx.createRadialGradient(
      this.playerBaseX,
      this.playerBaseY,
      0,
      this.playerBaseX,
      this.playerBaseY,
      100
    );
    playerGlow.addColorStop(0, "rgba(255, 107, 53, 0.3)");
    playerGlow.addColorStop(1, "transparent");
    this.ctx.fillStyle = playerGlow;
    this.ctx.fillRect(this.playerBaseX - 100, this.playerBaseY - 100, 200, 200);

    // Enemy glow
    const enemyGlow = this.ctx.createRadialGradient(
      this.enemyBaseX,
      this.enemyBaseY,
      0,
      this.enemyBaseX,
      this.enemyBaseY,
      100
    );
    enemyGlow.addColorStop(0, "rgba(139, 58, 117, 0.3)");
    enemyGlow.addColorStop(1, "transparent");
    this.ctx.fillStyle = enemyGlow;
    this.ctx.fillRect(this.enemyBaseX - 100, this.enemyBaseY - 100, 200, 200);

    // Draw sprites
    this.playerSprite.draw(
      this.ctx,
      this.playerBaseX,
      this.playerBaseY,
      spriteScale,
      {
        shadow: false,
      }
    );
    this.enemySprite.draw(
      this.ctx,
      this.enemyBaseX,
      this.enemyBaseY,
      spriteScale,
      {
        shadow: false,
      }
    );
  }

  private drawEffects(): void {
    for (const effect of this.effects) {
      const age = this.ambientTime - effect.startTime;
      const progress = age / 500; // 500ms duration
      const alpha = 1 - progress;

      if (alpha <= 0) continue;

      this.ctx.save();
      this.ctx.translate(effect.x, effect.y);
      this.ctx.rotate(effect.angle);
      this.ctx.globalAlpha = alpha;

      switch (effect.type) {
        case "slash":
          // Arc slash effect
          this.ctx.strokeStyle = "#ffffff";
          this.ctx.lineWidth = 4 + (1 - progress) * 4;
          this.ctx.lineCap = "round";
          this.ctx.beginPath();
          const slashSize = 60 + progress * 40;
          this.ctx.arc(0, 0, slashSize, -Math.PI * 0.3, Math.PI * 0.3);
          this.ctx.stroke();

          // Inner glow
          this.ctx.strokeStyle = "#ffaa00";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, slashSize * 0.9, -Math.PI * 0.25, Math.PI * 0.25);
          this.ctx.stroke();
          break;

        case "hit":
          // Impact burst
          const burstSize = 30 + progress * 50;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const length = burstSize * (0.5 + Math.random() * 0.5);
            this.ctx.strokeStyle = "#ff4444";
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
            this.ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            this.ctx.stroke();
          }
          break;

        case "block":
          // Shield shimmer
          this.ctx.strokeStyle = "#4a90d9";
          this.ctx.lineWidth = 6 - progress * 4;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 40 + progress * 30, 0, Math.PI * 2);
          this.ctx.stroke();

          // Inner shield
          this.ctx.fillStyle = `rgba(74, 144, 217, ${alpha * 0.3})`;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 35, 0, Math.PI * 2);
          this.ctx.fill();
          break;

        case "dodge":
          // Speed lines
          for (let i = 0; i < 5; i++) {
            const offsetY = (i - 2) * 15;
            const lineLength = 50 - progress * 30;
            this.ctx.strokeStyle = "#9b59b6";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(-50 + progress * 30, offsetY);
            this.ctx.lineTo(-50 + progress * 30 + lineLength, offsetY);
            this.ctx.stroke();
          }
          break;
      }

      this.ctx.restore();
    }
  }

  private drawDamageNumbers(): void {
    for (const dmg of this.damageNumbers) {
      const age = this.ambientTime - dmg.startTime;
      const progress = age / 1000;
      const alpha = 1 - progress;
      const yOffset = -progress * 60; // Float upward

      if (alpha <= 0) continue;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.textAlign = "center";

      // Scale animation
      const scale = dmg.isCrit ? 1.5 - progress * 0.3 : 1.2 - progress * 0.2;

      this.ctx.font = `bold ${Math.floor(
        28 * scale
      )}px "Press Start 2P", monospace`;

      // Shadow
      this.ctx.fillStyle = "#000000";
      this.ctx.fillText(`${dmg.value}`, dmg.x + 2, dmg.y + yOffset + 2);

      // Text color
      if (dmg.isCrit) {
        this.ctx.fillStyle = "#ff4444";
      } else if (dmg.isPlayer) {
        this.ctx.fillStyle = "#ff6b35"; // Damage to player - orange
      } else {
        this.ctx.fillStyle = "#4ade80"; // Damage to enemy - green
      }
      this.ctx.fillText(`${dmg.value}`, dmg.x, dmg.y + yOffset);

      // Crit label
      if (dmg.isCrit) {
        this.ctx.font = `bold 12px "Press Start 2P", monospace`;
        this.ctx.fillStyle = "#ffff00";
        this.ctx.fillText("CRIT!", dmg.x, dmg.y + yOffset - 25);
      }

      this.ctx.restore();
    }
  }

  private drawVignette(): void {
    const gradient = this.ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.3,
      this.width / 2,
      this.height / 2,
      this.height * 0.9
    );
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.3)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // ============================================
  // UTILITIES
  // ============================================

  isReady(): boolean {
    return this.isLoaded;
  }

  reset(): void {
    this.playerSprite.setAnimation("idle");
    this.enemySprite.setAnimation("idle");
    this.playerAction = null;
    this.enemyAction = null;
    this.damageNumbers = [];
    this.effects = [];
    this.screenShake = null;
  }
}
