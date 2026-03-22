import { FC, useState, useEffect, useRef } from "react";
import { CombatAction } from "../types/game";
import { HealthBar } from "./HUD";
import { CombatRenderer, CombatActionType } from "../game/combatRenderer";

interface CombatModalProps {
  isVisible: boolean;
  playerHealth: number;
  enemyHealth: number;
  onActionSelect: (action: CombatAction) => void;
  onClose?: () => void; // for demo purposes
}

// Map CombatAction enum to CombatActionType
const ACTION_MAP: Record<CombatAction, CombatActionType> = {
  [CombatAction.Attack]: "attack",
  [CombatAction.Block]: "block",
  [CombatAction.Dodge]: "dodge",
  [CombatAction.Heavy]: "heavy",
};

export const CombatModal: FC<CombatModalProps> = ({
  isVisible,
  playerHealth,
  enemyHealth,
  onActionSelect,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CombatRenderer | null>(null);
  const animationRef = useRef<number>();

  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAction, setSelectedAction] = useState<CombatAction | null>(
    null
  );

  // Initialize renderer
  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    // Set canvas internal resolution
    const canvas = canvasRef.current;

    rendererRef.current = new CombatRenderer(canvas);

    let isMounted = true;
    rendererRef.current.loadAssets().then(() => {
      if (!isMounted || !rendererRef.current) return;

      rendererRef.current.resize(canvas.clientWidth, canvas.clientHeight);

      const renderLoop = (time: number) => {
        rendererRef.current?.update(time);
        rendererRef.current?.render();
        animationRef.current = requestAnimationFrame(renderLoop);
      };
      animationRef.current = requestAnimationFrame(renderLoop);
    });

    return () => {
      isMounted = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isVisible]);

  // Timer
  useEffect(() => {
    if (!isVisible) {
      setTimeLeft(10);
      setSelectedAction(null);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!selectedAction) handleAction(CombatAction.Block); // default action
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, selectedAction]);

  const handleAction = (action: CombatAction) => {
    if (selectedAction) return;
    setSelectedAction(action);
    onActionSelect(action);

    // trigger animation based on action using new API
    rendererRef.current?.setPlayerAction(ACTION_MAP[action]);

    // demo enemy action
    setTimeout(() => {
      rendererRef.current?.setEnemyAction("attack");
    }, 500);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss-950/95 backdrop-blur-md">
      <div className="w-full max-w-4xl p-6 relative">
        {/* Close button for demo */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-4 text-fog-500 hover:text-white"
          >
            ✕
          </button>
        )}

        <div className="text-center mb-8">
          <h2 className="text-3xl font-cinzel text-red-500 text-shadow-glow uppercase tracking-widest animate-pulse">
            Combat Engaged
          </h2>
          <div className="text-xl font-mono text-fog-400 mt-2">
            Choose your action: {timeLeft}s
          </div>
        </div>

        {/* Combat Arena */}
        <div className="relative w-full h-[300px] mb-8 bg-gradient-to-b from-transparent to-abyss-900 border-b border-fog-500/20">
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* Health Bars Overlay */}
          <div className="absolute top-0 left-0 w-full flex justify-between px-8">
            {/* Player 1 Health */}
            <div className="w-[40%]">
              <div className="text-fog-300 font-cinzel mb-1 text-lg">You</div>
              <HealthBar current={playerHealth} max={100} size="lg" />
            </div>

            <div className="text-fog-500 font-cinzel text-2xl font-bold mt-4">
              VS
            </div>

            {/* Player 2 Health */}
            <div className="w-[40%] text-right">
              <div className="text-red-400 font-cinzel mb-1 text-lg">Enemy</div>
              <div className="flex items-center gap-2 flex-row-reverse">
                <HealthBar
                  current={enemyHealth}
                  max={100}
                  size="lg"
                  showText={false}
                />
                <span className="text-sm font-mono text-fog-300 min-w-[3rem] text-left">
                  {enemyHealth}/100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ActionButton
            action={CombatAction.Attack}
            icon="⚔️"
            desc="Quick strike (15 dmg)"
            disabled={!!selectedAction}
            selected={selectedAction === CombatAction.Attack}
            onClick={() => handleAction(CombatAction.Attack)}
          />
          <ActionButton
            action={CombatAction.Block}
            icon="🛡️"
            desc="Reflects 5, reduces Heavy by 50%"
            disabled={!!selectedAction}
            selected={selectedAction === CombatAction.Block}
            onClick={() => handleAction(CombatAction.Block)}
          />
          <ActionButton
            action={CombatAction.Dodge}
            icon="💨"
            desc="Evades Attack & Heavy"
            disabled={!!selectedAction}
            selected={selectedAction === CombatAction.Dodge}
            onClick={() => handleAction(CombatAction.Dodge)}
          />
          <ActionButton
            action={CombatAction.Heavy}
            icon="💥"
            desc="Slow strike (30 dmg)"
            disabled={!!selectedAction}
            selected={selectedAction === CombatAction.Heavy}
            onClick={() => handleAction(CombatAction.Heavy)}
          />
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({
  action,
  icon,
  desc,
  disabled,
  selected,
  onClick,
}: any) => {
  let colorClass =
    "from-fog-700 to-abyss-800 border-fog-500/30 text-fog-300 hover:border-fog-400";
  if (selected) {
    colorClass =
      "from-ember-600 to-red-800 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]";
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
                relative overflow-hidden group flex flex-col items-center p-4 rounded-xl border-2
                bg-gradient-to-br ${colorClass}
                transition-all duration-200
                ${
                  disabled && !selected
                    ? "opacity-50 cursor-not-allowed grayscale"
                    : "hover:-translate-y-1"
                }
            `}
    >
      <span className="text-3xl mb-2 filter drop-shadow-md">{icon}</span>
      <span className="font-cinzel font-bold text-lg tracking-wider mb-1">
        {action}
      </span>
      <span className="text-xs font-mono text-center opacity-80">{desc}</span>

      {/* Hover glare effect */}
      {!disabled && (
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[glare_1s_ease-in-out]" />
      )}
    </button>
  );
};
