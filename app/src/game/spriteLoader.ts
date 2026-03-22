export class SpriteLoader {
  private static cache: Map<string, HTMLImageElement> = new Map();

  static async loadSprite(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
      img.src = src;
    });
  }

  static getSprite(src: string): HTMLImageElement | null {
    return this.cache.get(src) || null;
  }
}
