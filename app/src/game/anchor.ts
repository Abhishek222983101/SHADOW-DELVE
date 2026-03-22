import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import { AnchorWallet } from '@solana/wallet-adapter-react'
import idl from '../idl/shadow_delve.json'
import { PROGRAM_ID, DEVNET_RPC } from './constants'
import { Direction, Position, MatchStatus } from '../types/game'

// ============================================
// PROGRAM TYPES
// ============================================

// Match the Anchor IDL types
export interface MatchStateAccount {
  matchId: BN
  player1: PublicKey
  player2: PublicKey
  status: { waiting?: {}; ready?: {}; active?: {}; ended?: {} }
  winner: PublicKey | null
  vrfSeed: number[]
  createdAt: BN
  endedAt: BN | null
  bump: number
}

export interface PlayerStateAccount {
  player: PublicKey
  matchId: BN
  position: { x: number; y: number }
  health: number
  gold: BN
  isAlive: boolean
  bump: number
}

export interface DungeonStateAccount {
  matchId: BN
  grid: { floor?: {}; wall?: {}; exit?: {} }[][]
  treasures: { position: { x: number; y: number }; amount: BN; collected: boolean }[]
  exitPos: { x: number; y: number }
  spawn1: { x: number; y: number }
  spawn2: { x: number; y: number }
  vrfSeed: number[]
  bump: number
}

// ============================================
// ANCHOR CLIENT
// ============================================

export class ShadowDelveClient {
  private program: Program
  private connection: Connection
  private wallet: AnchorWallet | null = null

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(DEVNET_RPC, 'confirmed')
    
    // Create a read-only program instance
    const provider = new AnchorProvider(
      this.connection,
      // Dummy wallet for read-only operations
      {
        publicKey: PublicKey.default,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      },
      { commitment: 'confirmed' }
    )
    
    this.program = new Program(idl as Idl, provider)
  }

  // ============================================
  // WALLET CONNECTION
  // ============================================

  setWallet(wallet: AnchorWallet) {
    this.wallet = wallet
    const provider = new AnchorProvider(this.connection, wallet, { commitment: 'confirmed' })
    this.program = new Program(idl as Idl, provider)
  }

  getWallet(): AnchorWallet | null {
    return this.wallet
  }

  isConnected(): boolean {
    return this.wallet !== null
  }

  // ============================================
  // PDA DERIVATION
  // ============================================

  getMatchPDA(matchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('match'), matchId.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(PROGRAM_ID)
    )
  }

  getPlayerStatePDA(matchId: BN, player: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('player'), matchId.toArrayLike(Buffer, 'le', 8), player.toBuffer()],
      new PublicKey(PROGRAM_ID)
    )
  }

  getDungeonPDA(matchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('dungeon'), matchId.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(PROGRAM_ID)
    )
  }

  getCombatPDA(matchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('combat'), matchId.toArrayLike(Buffer, 'le', 8)],
      new PublicKey(PROGRAM_ID)
    )
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  async getMatchState(matchId: BN): Promise<MatchStateAccount | null> {
    try {
      const [matchPDA] = this.getMatchPDA(matchId)
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.matchState.fetch(matchPDA)
      return account as unknown as MatchStateAccount
    } catch {
      return null
    }
  }

  async getPlayerState(matchId: BN, player: PublicKey): Promise<PlayerStateAccount | null> {
    try {
      const [playerPDA] = this.getPlayerStatePDA(matchId, player)
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.playerState.fetch(playerPDA)
      return account as unknown as PlayerStateAccount
    } catch {
      return null
    }
  }

  async getDungeonState(matchId: BN): Promise<DungeonStateAccount | null> {
    try {
      const [dungeonPDA] = this.getDungeonPDA(matchId)
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.dungeonState.fetch(dungeonPDA)
      return account as unknown as DungeonStateAccount
    } catch {
      return null
    }
  }

  // ============================================
  // WRITE OPERATIONS (INSTRUCTIONS)
  // ============================================

  async createMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    
    const tx = await this.program.methods
      .createMatch(matchId)
      .accounts({
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    
    return tx
  }

  async joinMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    
    const tx = await this.program.methods
      .joinMatch()
      .accounts({
        matchState: matchPDA,
        player: this.wallet.publicKey,
      })
      .rpc()
    
    return tx
  }

  async initPlayerState(matchId: BN, spawnX: number, spawnY: number): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    const [playerPDA] = this.getPlayerStatePDA(matchId, this.wallet.publicKey)
    
    const tx = await this.program.methods
      .initPlayerState(spawnX, spawnY)
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    
    return tx
  }

  async movePlayer(matchId: BN, direction: Direction): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    const [playerPDA] = this.getPlayerStatePDA(matchId, this.wallet.publicKey)
    const [dungeonPDA] = this.getDungeonPDA(matchId)
    
    // Convert direction to IDL format
    const directionArg = { [direction.toLowerCase()]: {} }
    
    const tx = await this.program.methods
      .movePlayer(directionArg)
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
      })
      .rpc()
    
    return tx
  }

  async collectTreasure(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    const [playerPDA] = this.getPlayerStatePDA(matchId, this.wallet.publicKey)
    const [dungeonPDA] = this.getDungeonPDA(matchId)
    
    const tx = await this.program.methods
      .collectTreasure()
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
      })
      .rpc()
    
    return tx
  }

  async escape(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected')
    
    const [matchPDA] = this.getMatchPDA(matchId)
    const [playerPDA] = this.getPlayerStatePDA(matchId, this.wallet.publicKey)
    const [dungeonPDA] = this.getDungeonPDA(matchId)
    
    const tx = await this.program.methods
      .escape()
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
      })
      .rpc()
    
    return tx
  }

  // ============================================
  // UTILITY
  // ============================================

  generateMatchId(): BN {
    return new BN(Date.now())
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let clientInstance: ShadowDelveClient | null = null

export function getShadowDelveClient(connection?: Connection): ShadowDelveClient {
  if (!clientInstance) {
    clientInstance = new ShadowDelveClient(connection)
  }
  return clientInstance
}

// ============================================
// DIRECTION CONVERSION
// ============================================

export function directionToAnchor(direction: Direction): object {
  switch (direction) {
    case Direction.Up: return { up: {} }
    case Direction.Down: return { down: {} }
    case Direction.Left: return { left: {} }
    case Direction.Right: return { right: {} }
  }
}

export function anchorStatusToEnum(status: object): MatchStatus {
  if ('waiting' in status) return MatchStatus.Waiting
  if ('ready' in status) return MatchStatus.Ready
  if ('active' in status) return MatchStatus.Active
  if ('ended' in status) return MatchStatus.Ended
  return MatchStatus.Waiting
}
