import { FC, useEffect, useState } from 'react'
import { MAX_HEALTH, COLORS } from '../game/constants'

// ============================================
// HEALTH BAR
// ============================================

interface HealthBarProps {
  current: number
  max?: number
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const HealthBar: FC<HealthBarProps> = ({
  current,
  max = MAX_HEALTH,
  showText = true,
  size = 'md',
}) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100))
  
  // Color based on health level
  const getColor = () => {
    if (percentage > 60) return 'from-green-500 to-green-400'
    if (percentage > 30) return 'from-amber-500 to-amber-400'
    return 'from-red-500 to-red-400'
  }
  
  const getGlow = () => {
    if (percentage > 60) return 'shadow-[0_0_10px_rgba(34,197,94,0.4)]'
    if (percentage > 30) return 'shadow-[0_0_10px_rgba(245,158,11,0.4)]'
    return 'shadow-[0_0_10px_rgba(239,68,68,0.5)]'
  }
  
  const heightClass = size === 'sm' ? 'h-2' : size === 'md' ? 'h-3' : 'h-4'

  return (
    <div className="flex items-center gap-2">
      {/* Heart icon */}
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
      </svg>
      
      {/* Bar container */}
      <div className={`flex-1 bg-abyss-800 rounded-full ${heightClass} overflow-hidden border border-fog-500/20`}>
        <div 
          className={`h-full bg-gradient-to-r ${getColor()} ${getGlow()} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* Text */}
      {showText && (
        <span className="text-sm font-mono text-fog-300 min-w-[3rem] text-right">
          {current}/{max}
        </span>
      )}
    </div>
  )
}

// ============================================
// GOLD COUNTER
// ============================================

interface GoldCounterProps {
  amount: number
  lastCollected?: number | null
  onAnimationComplete?: () => void
}

export const GoldCounter: FC<GoldCounterProps> = ({
  amount,
  lastCollected,
  onAnimationComplete,
}) => {
  const [displayAmount, setDisplayAmount] = useState(amount)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showPlus, setShowPlus] = useState(false)

  // Animate number counting up
  useEffect(() => {
    if (amount === displayAmount) return
    
    setIsAnimating(true)
    const diff = amount - displayAmount
    const duration = 500
    const steps = 20
    const stepAmount = diff / steps
    const stepDuration = duration / steps
    
    let current = displayAmount
    const interval = setInterval(() => {
      current += stepAmount
      if ((diff > 0 && current >= amount) || (diff < 0 && current <= amount)) {
        setDisplayAmount(amount)
        setIsAnimating(false)
        clearInterval(interval)
      } else {
        setDisplayAmount(Math.round(current))
      }
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [amount, displayAmount])

  // Show +amount popup
  useEffect(() => {
    if (lastCollected) {
      setShowPlus(true)
      const timeout = setTimeout(() => {
        setShowPlus(false)
        onAnimationComplete?.()
      }, 1500)
      return () => clearTimeout(timeout)
    }
  }, [lastCollected, onAnimationComplete])

  return (
    <div className="relative flex items-center gap-2">
      {/* Coin icon */}
      <div className="relative">
        <svg className={`w-6 h-6 text-gold-500 ${isAnimating ? 'animate-bounce' : ''}`} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" opacity="0.2" />
          <circle cx="12" cy="12" r="8" />
          <text x="12" y="16" textAnchor="middle" fill="#0a0a0f" fontSize="10" fontWeight="bold">$</text>
        </svg>
        {isAnimating && (
          <div className="absolute inset-0 animate-ping">
            <svg className="w-6 h-6 text-gold-500 opacity-50" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Amount */}
      <span className={`font-mono text-lg font-semibold text-gold-400 min-w-[4rem] transition-all duration-150 ${isAnimating ? 'scale-110' : ''}`}>
        {displayAmount.toLocaleString()}
      </span>
      
      {/* +amount popup */}
      {showPlus && lastCollected && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-gold-300 font-mono text-sm font-bold animate-bounce whitespace-nowrap">
          +{lastCollected}
        </span>
      )}
    </div>
  )
}

// ============================================
// PROXIMITY WARNING
// ============================================

interface ProximityWarningProps {
  isVisible: boolean
  distance?: number // 1 = very close, 2 = nearby
}

export const ProximityWarning: FC<ProximityWarningProps> = ({
  isVisible,
  distance = 2,
}) => {
  if (!isVisible) return null

  const intensity = distance === 1 ? 'danger-pulse border-2' : 'animate-pulse border'
  const text = distance === 1 ? 'ENEMY CLOSE!' : 'Enemy Nearby...'

  return (
    <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40`}>
      <div className={`
        px-6 py-3 bg-abyss-900/90 backdrop-blur-sm rounded-lg
        border-red-500/70 ${intensity}
        shadow-[0_0_30px_rgba(239,68,68,0.3)]
      `}>
        <div className="flex items-center gap-3">
          {/* Warning icon */}
          <svg className="w-6 h-6 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-cinzel text-lg text-red-400 tracking-wide">
            {text}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// GAME OVER SCREEN
// ============================================

interface GameOverProps {
  isVisible: boolean
  isVictory: boolean
  gold: number
  onPlayAgain: () => void
  onExit: () => void
}

export const GameOverScreen: FC<GameOverProps> = ({
  isVisible,
  isVictory,
  gold,
  onPlayAgain,
  onExit,
}) => {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss-950/90 backdrop-blur-sm">
      <div className="bg-abyss-800 border border-fog-500/30 rounded-xl p-8 max-w-md mx-4 text-center">
        {/* Icon */}
        <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isVictory 
            ? 'bg-gradient-to-br from-gold-500 to-amber-600 shadow-glow-gold' 
            : 'bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
        }`}>
          {isVictory ? (
            <svg className="w-10 h-10 text-abyss-950" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        
        {/* Title */}
        <h2 className={`font-cinzel text-3xl font-bold mb-2 ${isVictory ? 'text-gold-400' : 'text-red-400'}`}>
          {isVictory ? 'Victory!' : 'Defeated'}
        </h2>
        
        <p className="text-fog-400 font-crimson mb-6">
          {isVictory 
            ? 'You escaped the dungeon with your loot!' 
            : 'The shadows have claimed you...'}
        </p>
        
        {/* Stats */}
        <div className="bg-abyss-900/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-6 h-6 text-gold-500" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span className="font-mono text-2xl text-gold-400">{gold.toLocaleString()}</span>
            <span className="text-fog-500">gold collected</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <button 
            onClick={onPlayAgain}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-ember-500 to-ember-400 
                     text-abyss-950 font-cinzel font-semibold rounded-lg
                     hover:shadow-glow-ember transition-all duration-300
                     hover:scale-[1.02] active:scale-[0.98]"
          >
            Play Again
          </button>
          <button 
            onClick={onExit}
            className="flex-1 px-6 py-3 bg-abyss-600/50 border border-fog-500/30
                     text-fog-200 font-cinzel rounded-lg
                     hover:bg-abyss-600 hover:border-fog-400/50 transition-all duration-300"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// CONTROLS OVERLAY
// ============================================

interface ControlsOverlayProps {
  compact?: boolean
}

export const ControlsOverlay: FC<ControlsOverlayProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-fog-500 font-mono">
        <kbd className="px-1.5 py-0.5 bg-abyss-700 rounded text-fog-400">WASD</kbd>
        <span>move</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 bg-abyss-800/80 backdrop-blur-sm border border-fog-500/20 rounded-lg">
      <p className="text-xs text-fog-500 font-mono mb-2 uppercase tracking-wider">Controls</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <kbd className="px-2 py-1 bg-abyss-600 rounded text-fog-300 text-xs">W</kbd>
            <kbd className="px-2 py-1 bg-abyss-600 rounded text-fog-300 text-xs">A</kbd>
            <kbd className="px-2 py-1 bg-abyss-600 rounded text-fog-300 text-xs">S</kbd>
            <kbd className="px-2 py-1 bg-abyss-600 rounded text-fog-300 text-xs">D</kbd>
          </div>
          <span className="text-fog-500">Move</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-abyss-600 rounded text-fog-300 text-xs">E</kbd>
          <span className="text-fog-500">Interact</span>
        </div>
      </div>
    </div>
  )
}
