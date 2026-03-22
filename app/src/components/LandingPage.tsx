// ============================================
// LANDING PAGE - Cinematic intro with wallet connection
// Dark fantasy theme, animated background, epic atmosphere
// ============================================

import { FC, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface LandingPageProps {
  onEnterGame: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onEnterGame }) => {
  const { connected, connecting } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showEnter, setShowEnter] = useState(false);

  // Show enter button after wallet connects
  useEffect(() => {
    if (connected) {
      setTimeout(() => setShowEnter(true), 500);
    } else {
      setShowEnter(false);
    }
  }, [connected]);

  // Animated background particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    // Particles for ambient effect
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }

    const particles: Particle[] = [];
    const particleCount = 60;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.5 - 0.2,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        color: Math.random() > 0.5 ? "#ff6b35" : "#ffd700",
      });
    }

    const animate = () => {
      time += 0.016;

      // Dark gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#050508");
      gradient.addColorStop(0.3, "#0a0a12");
      gradient.addColorStop(0.7, "#0f0f1a");
      gradient.addColorStop(1, "#0a0a0f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant stars
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 100; i++) {
        const x = (i * 137.5 + time * 2) % canvas.width;
        const y = (i * 73.7) % (canvas.height * 0.4);
        const twinkle = Math.sin(time * 2 + i) * 0.4 + 0.6;
        ctx.globalAlpha = twinkle * 0.6;
        const size = (i % 3) + 1;
        ctx.fillRect(x, y, size, size);
      }
      ctx.globalAlpha = 1;

      // Floating ember particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        // Draw particle with glow
        const glow = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 3
        );
        glow.addColorStop(0, p.color);
        glow.addColorStop(
          0.5,
          p.color
            .replace(")", ", 0.3)")
            .replace("rgb", "rgba")
            .replace("#ff6b35", "rgba(255, 107, 53, 0.3)")
            .replace("#ffd700", "rgba(255, 215, 0, 0.3)")
        );
        glow.addColorStop(1, "transparent");

        ctx.globalAlpha = p.alpha * (0.7 + Math.sin(time * 3 + p.x) * 0.3);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Dungeon gate silhouette at bottom
      const gateWidth = Math.min(400, canvas.width * 0.4);
      const gateHeight = Math.min(300, canvas.height * 0.35);
      const gateX = (canvas.width - gateWidth) / 2;
      const gateY = canvas.height - gateHeight + 50;

      // Gate glow
      const gateGlow = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height - 100,
        0,
        canvas.width / 2,
        canvas.height - 100,
        300
      );
      const pulseIntensity = Math.sin(time * 1.5) * 0.15 + 0.35;
      gateGlow.addColorStop(0, `rgba(255, 107, 53, ${pulseIntensity})`);
      gateGlow.addColorStop(0.5, `rgba(255, 50, 20, ${pulseIntensity * 0.5})`);
      gateGlow.addColorStop(1, "transparent");
      ctx.fillStyle = gateGlow;
      ctx.fillRect(0, canvas.height - 400, canvas.width, 400);

      // Gate pillars
      ctx.fillStyle = "#0a0a10";
      // Left pillar
      ctx.fillRect(gateX, gateY, gateWidth * 0.15, gateHeight);
      // Right pillar
      ctx.fillRect(
        gateX + gateWidth * 0.85,
        gateY,
        gateWidth * 0.15,
        gateHeight
      );
      // Top arch
      ctx.beginPath();
      ctx.moveTo(gateX, gateY + 20);
      ctx.quadraticCurveTo(
        canvas.width / 2,
        gateY - 60,
        gateX + gateWidth,
        gateY + 20
      );
      ctx.lineTo(gateX + gateWidth, gateY + 50);
      ctx.quadraticCurveTo(canvas.width / 2, gateY - 30, gateX, gateY + 50);
      ctx.fill();

      // Gate interior (void)
      ctx.fillStyle = "#020204";
      ctx.fillRect(
        gateX + gateWidth * 0.15,
        gateY + 50,
        gateWidth * 0.7,
        gateHeight - 50
      );

      // Glowing runes on pillars
      const runeGlow = Math.sin(time * 2) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 107, 53, ${runeGlow})`;
      // Left runes
      ctx.fillRect(gateX + 8, gateY + 60, 15, 8);
      ctx.fillRect(gateX + 8, gateY + 100, 15, 8);
      ctx.fillRect(gateX + 8, gateY + 140, 15, 8);
      // Right runes
      ctx.fillRect(gateX + gateWidth - 23, gateY + 60, 15, 8);
      ctx.fillRect(gateX + gateWidth - 23, gateY + 100, 15, 8);
      ctx.fillRect(gateX + gateWidth - 23, gateY + 140, 15, 8);

      // Vignette overlay
      const vignette = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.3,
        canvas.width / 2,
        canvas.height / 2,
        canvas.height * 0.9
      );
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.6)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Animated background */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Title */}
        <div className="text-center mb-12">
          <h1
            className="text-5xl md:text-7xl lg:text-8xl tracking-wider mb-4"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              color: "#ff6b35",
              textShadow: `
                4px 4px 0 #000,
                8px 8px 0 rgba(0,0,0,0.5),
                0 0 60px rgba(255, 107, 53, 0.5),
                0 0 100px rgba(255, 107, 53, 0.3)
              `,
              WebkitTextStroke: "2px #000",
              animation: "pulse 3s ease-in-out infinite",
            }}
          >
            SHADOW
          </h1>
          <h1
            className="text-4xl md:text-6xl lg:text-7xl tracking-widest"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              color: "#888",
              textShadow: "4px 4px 0 #000, 0 0 40px rgba(136, 136, 136, 0.3)",
              WebkitTextStroke: "1px #000",
            }}
          >
            DELVE
          </h1>

          {/* Tagline */}
          <p
            className="mt-6 text-sm md:text-base"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              color: "#666",
              letterSpacing: "4px",
            }}
          >
            DUNGEON PVP ON SOLANA
          </p>
        </div>

        {/* Privacy Badge */}
        <div
          className="mb-8 px-4 py-2"
          style={{
            background: "rgba(138, 43, 226, 0.2)",
            border: "2px solid rgba(138, 43, 226, 0.5)",
            boxShadow: "0 0 20px rgba(138, 43, 226, 0.3)",
          }}
        >
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "8px",
              color: "#9b59b6",
              letterSpacing: "2px",
            }}
          >
            POWERED BY PRIVATE EPHEMERAL ROLLUPS (TEE)
          </p>
        </div>

        {/* Game features */}
        <div className="flex flex-wrap justify-center gap-6 mb-12 max-w-2xl">
          {[
            { icon: "\uD83D\uDDFA", text: "HIDDEN POSITIONS" },
            { icon: "\uD83D\uDC41", text: "FOG OF WAR" },
            { icon: "\u2694\uFE0F", text: "PVP COMBAT" },
            { icon: "\uD83D\uDCB0", text: "GOLD STAKES" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-4 py-2"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "2px solid #333",
              }}
            >
              <span className="text-xl">{icon}</span>
              <span
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "8px",
                  color: "#888",
                }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Wallet Connection */}
        <div className="flex flex-col items-center gap-6">
          {!connected ? (
            <>
              <p
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                CONNECT WALLET TO ENTER
              </p>
              <WalletMultiButton
                style={{
                  background:
                    "linear-gradient(180deg, #ff6b35 0%, #c44d1c 100%)",
                  border: "4px solid #000",
                  borderRadius: "0",
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "14px",
                  padding: "16px 32px",
                  boxShadow: "6px 6px 0 #000, 0 0 30px rgba(255, 107, 53, 0.4)",
                  transition: "all 0.2s ease",
                  color: "#000",
                }}
              />
            </>
          ) : (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2 mb-4"
                style={{
                  background: "rgba(34, 197, 94, 0.2)",
                  border: "2px solid #4ade80",
                }}
              >
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "10px",
                    color: "#4ade80",
                  }}
                >
                  WALLET CONNECTED
                </span>
              </div>

              {showEnter && (
                <button
                  onClick={onEnterGame}
                  className="px-12 py-6 transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background:
                      "linear-gradient(180deg, #ff6b35 0%, #c44d1c 100%)",
                    border: "4px solid #000",
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "16px",
                    color: "#000",
                    boxShadow:
                      "6px 6px 0 #000, 0 0 40px rgba(255, 107, 53, 0.5)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                >
                  ENTER THE ARENA
                </button>
              )}
            </>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: "8px",
              color: "#444",
            }}
          >
            MAGICBLOCK HACKATHON 2026 - PRIVACY EDITION
          </p>
        </div>
      </div>

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          mixBlendMode: "overlay",
        }}
      />

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
