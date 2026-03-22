import { FC, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useEffect, useState } from 'react'

export const ConnectWallet: FC = () => {
  const { publicKey, connected, connecting, disconnecting } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Fetch balance when connected
  useEffect(() => {
    if (!publicKey || !connected) {
      setBalance(null)
      return
    }

    const fetchBalance = async () => {
      setIsLoadingBalance(true)
      try {
        const lamports = await connection.getBalance(publicKey)
        setBalance(lamports / LAMPORTS_PER_SOL)
      } catch (error) {
        console.error('Failed to fetch balance:', error)
        setBalance(null)
      } finally {
        setIsLoadingBalance(false)
      }
    }

    fetchBalance()
    
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [publicKey, connected, connection])

  // Shortened address display
  const shortenedAddress = useMemo(() => {
    if (!publicKey) return ''
    const base58 = publicKey.toBase58()
    return `${base58.slice(0, 4)}..${base58.slice(-4)}`
  }, [publicKey])

  return (
    <div className="flex items-center gap-3">
      {/* Balance Display (when connected) */}
      {connected && publicKey && (
        <div className="hidden md:flex items-center gap-2 px-3 py-2" style={{
          background: '#0a0a0f',
          border: '2px solid #333',
        }}>
          <span style={{ 
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '8px',
            color: '#888',
          }}>
            {shortenedAddress}
          </span>
          <span style={{ 
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '10px',
            color: '#ffd700',
          }}>
            {isLoadingBalance ? '...' : balance !== null ? `${balance.toFixed(2)} SOL` : '--'}
          </span>
        </div>
      )}

      {/* Wallet Button - Pixel Style */}
      <WalletMultiButton 
        style={{
          background: '#2a2a3a',
          border: '3px solid #ff6b35',
          borderRadius: '0',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          height: '40px',
          padding: '0 16px',
          boxShadow: '3px 3px 0 #000',
          transition: 'all 0.1s ease',
        }}
      />
    </div>
  )
}
