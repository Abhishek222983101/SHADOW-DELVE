// ============================================
// VILLAGE SCREEN - Interactive hub world
// Walk around, explore, enter dungeon
// ============================================

import { FC, useRef, useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VillageRenderer } from "../game/villageRenderer";

interface VillageScreenProps {
  onEnterDungeon: () => void;
}

export const VillageScreen: FC<VillageScreenProps> = ({ onEnterDungeon }) => {
  const { connected } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VillageRenderer | null>(null);
  const animationRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new VillageRenderer(canvas);
    rendererRef.current = renderer;

    // Handle dungeon entry
    renderer.onEnterDungeon = () => {
      setShowPrompt(true);
    };

    // Load assets and start
    renderer
      .init()
      .then(() => {
        setIsLoading(false);
        renderer.resize(window.innerWidth, window.innerHeight);

        // Start render loop
        const loop = (time: number) => {
          renderer.update(time);
          renderer.render();
          animationRef.current = requestAnimationFrame(loop);
        };
        animationRef.current = requestAnimationFrame(loop);
      })
      .catch((err) => {
        console.error("Failed to initialize village:", err);
      });

    // Handle resize
    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        renderer.handleKeyDown(e.key);
      }
      // Enter dungeon on E key if prompt is showing
      if (e.key.toLowerCase() === "e" && showPrompt) {
        onEnterDungeon();
      }
      // Dismiss prompt on escape
      if (e.key === "Escape") {
        setShowPrompt(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      renderer.handleKeyUp(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [showPrompt, onEnterDungeon]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-ember-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "12px",
                color: "#ff6b35",
              }}
            >
              LOADING...
            </p>
          </div>
        </div>
      )}

      {/* Title Overlay */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h1
          className="text-4xl md:text-5xl tracking-wider animate-pulse"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            color: "#ff6b35",
            textShadow: "4px 4px 0 #000, 0 0 40px rgba(255, 107, 53, 0.5)",
          }}
        >
          SHADOW DELVE
        </h1>
        <p
          className="mt-2"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: "10px",
            color: "#666",
            letterSpacing: "4px",
          }}
        >
          DUNGEON PVP ON SOLANA
        </p>
      </div>

      {/* Controls Hint */}
      <div
        className="absolute bottom-6 left-6 px-4 py-3"
        style={{
          background: "rgba(0, 0, 0, 0.8)",
          border: "2px solid #333",
          boxShadow: "4px 4px 0 rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {["W", "A", "S", "D"].map((key) => (
              <kbd
                key={key}
                className="px-2 py-1"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "8px",
                  background: "#1a1a2a",
                  border: "2px solid #333",
                  color: "#888",
                }}
              >
                {key}
              </kbd>
            ))}
          </div>
          <span
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "8px",
              color: "#666",
            }}
          >
            MOVE
          </span>
        </div>
      </div>

      {/* Connection Status */}
      <div
        className="absolute bottom-6 right-6 px-4 py-2"
        style={{
          background: "rgba(0, 0, 0, 0.8)",
          border: "2px solid #333",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "8px",
              color: connected ? "#4ade80" : "#ef4444",
            }}
          >
            {connected ? "CONNECTED" : "NOT CONNECTED"}
          </span>
        </div>
      </div>

      {/* Dungeon Entry Prompt */}
      {showPrompt && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div
            className="px-8 py-6 text-center animate-bounce pointer-events-auto"
            style={{
              background: "rgba(10, 10, 20, 0.95)",
              border: "4px solid #ff6b35",
              boxShadow: "0 0 40px rgba(255, 107, 53, 0.4), 8px 8px 0 #000",
            }}
          >
            <p
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "14px",
                color: "#ff6b35",
                marginBottom: "16px",
              }}
            >
              ENTER THE DUNGEON?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={onEnterDungeon}
                className="px-6 py-3 transition-transform hover:scale-105 active:scale-95"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  background:
                    "linear-gradient(180deg, #ff6b35 0%, #c44d1c 100%)",
                  color: "#000",
                  border: "3px solid #000",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                [E] ENTER
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="px-6 py-3 transition-transform hover:scale-105 active:scale-95"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  background: "#2a2a3a",
                  color: "#888",
                  border: "3px solid #000",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                [ESC] CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ambient Overlay - Grain Effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
};

export default VillageScreen;
