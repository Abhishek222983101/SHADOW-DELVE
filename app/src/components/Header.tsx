import { FC } from 'react'
import { ConnectWallet } from './ConnectWallet'

export const Header: FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-transparent pointer-events-none" />
      
      <div className="relative px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo / Title - Pixel Style */}
          <div className="flex items-center gap-3">
            {/* Pixel flame icon */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div 
                className="w-6 h-8"
                style={{
                  background: 'linear-gradient(to top, #ff6b35 0%, #ffaa00 50%, #ffec8b 100%)',
                  clipPath: 'polygon(50% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
                  imageRendering: 'pixelated',
                }}
              />
              <div 
                className="absolute w-3 h-4 top-2"
                style={{
                  background: '#ffec8b',
                  clipPath: 'polygon(50% 0%, 100% 70%, 50% 100%, 0% 70%)',
                }}
              />
            </div>
            
            <div>
              <h1 style={{ 
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '14px',
                letterSpacing: '2px',
              }}>
                <span style={{ color: '#ff6b35', textShadow: '2px 2px 0 #000' }}>SHADOW</span>
                <span style={{ color: '#888', textShadow: '2px 2px 0 #000' }}> DELVE</span>
              </h1>
              <p style={{ 
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px',
                color: '#555',
                letterSpacing: '3px',
                marginTop: '2px',
              }}>
                DUNGEON PVP
              </p>
            </div>
          </div>

          {/* Network indicator */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1" style={{
              background: '#0a0a0f',
              border: '2px solid #333',
            }}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span style={{ 
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '8px',
                color: '#4ade80',
              }}>
                DEVNET
              </span>
            </div>
          </div>

          {/* Wallet Connection */}
          <ConnectWallet />
        </div>
      </div>
      
      {/* Bottom border - pixel style */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{
        background: 'linear-gradient(90deg, transparent 0%, #ff6b35 50%, transparent 100%)',
        opacity: 0.5,
      }} />
    </header>
  )
}
