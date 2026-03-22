import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Commitment,
} from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/shadow_delve.json";
import { PROGRAM_ID, DEVNET_RPC, MAGICBLOCK } from "./constants";
import { Direction, MatchStatus } from "../types/game";
import { getAuthToken as getMagicAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";

// ============================================
// PROGRAM TYPES
// ============================================

export interface MatchStateAccount {
  matchId: BN;
  player1: PublicKey;
  player2: PublicKey;
  status: { waiting?: {}; ready?: {}; active?: {}; ended?: {} };
  winner: PublicKey | null;
  vrfSeed: number[];
  createdAt: BN;
  endedAt: BN | null;
  bump: number;
}

export interface PlayerStateAccount {
  player: PublicKey;
  matchId: BN;
  position: { x: number; y: number };
  health: number;
  gold: BN;
  isAlive: boolean;
  bump: number;
}

export interface DungeonStateAccount {
  matchId: BN;
  grid: { floor?: {}; wall?: {}; exit?: {} }[][];
  treasures: {
    position: { x: number; y: number };
    amount: BN;
    collected: boolean;
  }[];
  exitPos: { x: number; y: number };
  spawn1: { x: number; y: number };
  spawn2: { x: number; y: number };
  vrfSeed: number[];
  bump: number;
}

// ============================================
// TEE AUTH TOKEN MANAGEMENT
// ============================================

interface TEEAuthToken {
  token: string;
  expiresAt: number;
}

let cachedAuthToken: TEEAuthToken | null = null;

/**
 * Get authentication token for TEE access
 * Uses MagicBlock SDK's authentication
 */
export async function getAuthToken(
  wallet: AnchorWallet,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  if (cachedAuthToken && cachedAuthToken.expiresAt > Date.now()) {
    return cachedAuthToken.token;
  }

  const token = await getMagicAuthToken(
    MAGICBLOCK.TEE_RPC,
    wallet.publicKey,
    signMessage
  );

  cachedAuthToken = {
    token: token.token,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  return token.token;
}

export function clearAuthToken(): void {
  cachedAuthToken = null;
}

// ============================================
// CONNECTION HELPERS
// ============================================

export function createTEEConnection(authToken?: string): Connection {
  const config: {
    commitment: Commitment;
    httpHeaders?: Record<string, string>;
  } = {
    commitment: "confirmed",
  };

  let rpcUrl = MAGICBLOCK.TEE_RPC;

  if (authToken) {
    config.httpHeaders = {
      Authorization: `Bearer ${authToken}`,
    };
    // The MagicBlock TEE RPC requires the token in the query params for some routes
    rpcUrl = `${MAGICBLOCK.TEE_RPC}?token=${authToken}`;
  }

  return new Connection(rpcUrl, config);
}

export function createDevnetConnection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

// ============================================
// ANCHOR CLIENT
// ============================================

export class ShadowDelveClient {
  private program: Program;
  private connection: Connection;
  private teeConnection: Connection | null = null;
  private wallet: AnchorWallet | null = null;

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(DEVNET_RPC, "confirmed");

    const provider = new AnchorProvider(
      this.connection,
      {
        publicKey: PublicKey.default,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      },
      { commitment: "confirmed" }
    );

    this.program = new Program(idl as Idl, provider);
  }

  // ============================================
  // WALLET CONNECTION
  // ============================================

  setWallet(wallet: AnchorWallet) {
    this.wallet = wallet;
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(idl as Idl, provider);
  }

  getWallet(): AnchorWallet | null {
    return this.wallet;
  }

  isConnected(): boolean {
    return this.wallet !== null;
  }

  // ============================================
  // TEE CONNECTION
  // ============================================

  async initTEEConnection(
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  ): Promise<void> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const authToken = await getAuthToken(this.wallet, signMessage);
    this.teeConnection = createTEEConnection(authToken);
  }

  getTEEConnection(): Connection | null {
    return this.teeConnection;
  }

  getTEEProgram(): Program | null {
    if (!this.teeConnection || !this.wallet) return null;

    const provider = new AnchorProvider(this.teeConnection, this.wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as Idl, provider);
  }

  // ============================================
  // PDA DERIVATION
  // ============================================

  getMatchPDA(matchId: BN): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("match"), matchId.toArrayLike(Buffer, "le", 8)],
      new PublicKey(PROGRAM_ID)
    );
  }

  getPlayerStatePDA(
    matchPDA: PublicKey,
    player: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("player"), matchPDA.toBuffer(), player.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  }

  getDungeonPDA(matchPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("dungeon"), matchPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  }

  getCombatPDA(matchPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("combat"), matchPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  }

  getDelegationRecordPDA(accountPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("delegation"), accountPDA.toBuffer()],
      new PublicKey(MAGICBLOCK.DELEGATION_PROGRAM)
    );
  }

  getDelegationMetadataPDA(accountPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("delegation-metadata"), accountPDA.toBuffer()],
      new PublicKey(MAGICBLOCK.DELEGATION_PROGRAM)
    );
  }

  getBufferPDA(accountPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("buffer"), accountPDA.toBuffer()],
      new PublicKey(PROGRAM_ID)
    );
  }

  // ============================================
  // READ OPERATIONS (L1 - Devnet)
  // ============================================

  async getMatchState(matchId: BN): Promise<MatchStateAccount | null> {
    try {
      const [matchPDA] = this.getMatchPDA(matchId);
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.matchState.fetch(matchPDA);
      return account as unknown as MatchStateAccount;
    } catch {
      return null;
    }
  }

  async getPlayerState(
    matchId: BN,
    player: PublicKey
  ): Promise<PlayerStateAccount | null> {
    try {
      const [matchPDA] = this.getMatchPDA(matchId);
      const [playerPDA] = this.getPlayerStatePDA(matchPDA, player);
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.playerState.fetch(playerPDA);
      return account as unknown as PlayerStateAccount;
    } catch {
      return null;
    }
  }

  async getDungeonState(matchId: BN): Promise<DungeonStateAccount | null> {
    try {
      const [matchPDA] = this.getMatchPDA(matchId);
      const [dungeonPDA] = this.getDungeonPDA(matchPDA);
      // @ts-expect-error - IDL types are dynamically generated
      const account = await this.program.account.dungeonState.fetch(dungeonPDA);
      return account as unknown as DungeonStateAccount;
    } catch {
      return null;
    }
  }

  // ============================================
  // READ OPERATIONS (TEE - Private State)
  // ============================================

  async getPlayerStateTEE(
    matchId: BN,
    player: PublicKey
  ): Promise<PlayerStateAccount | null> {
    const teeProgram = this.getTEEProgram();
    if (!teeProgram) {
      console.warn("TEE connection not initialized, falling back to L1");
      return this.getPlayerState(matchId, player);
    }

    try {
      const [matchPDA] = this.getMatchPDA(matchId);
      const [playerPDA] = this.getPlayerStatePDA(matchPDA, player);
      // @ts-expect-error - IDL types are dynamically generated
      const account = await teeProgram.account.playerState.fetch(playerPDA);
      return account as unknown as PlayerStateAccount;
    } catch (err) {
      console.warn("Failed to fetch from TEE, falling back to L1:", err);
      return this.getPlayerState(matchId, player);
    }
  }

  async getDungeonStateTEE(matchId: BN): Promise<DungeonStateAccount | null> {
    const teeProgram = this.getTEEProgram();
    if (!teeProgram) {
      return this.getDungeonState(matchId);
    }

    try {
      const [matchPDA] = this.getMatchPDA(matchId);
      const [dungeonPDA] = this.getDungeonPDA(matchPDA);
      // @ts-expect-error - IDL types are dynamically generated
      const account = await teeProgram.account.dungeonState.fetch(dungeonPDA);
      return account as unknown as DungeonStateAccount;
    } catch (err) {
      console.warn("Failed to fetch dungeon from TEE:", err);
      return this.getDungeonState(matchId);
    }
  }

  // ============================================
  // WRITE OPERATIONS - L1 (Match Setup)
  // ============================================

  async createMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);

    const tx = await this.program.methods
      .createMatch(matchId)
      .accounts({
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async joinMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);

    const tx = await program.methods
      .joinMatch()
      .accounts({
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async initPlayerState(
    matchId: BN,
    spawnX: number,
    spawnY: number
  ): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);

    const tx = await this.program.methods
      .initPlayerState(spawnX, spawnY)
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async generateDungeon(matchId: BN, vrfSeed: number[]): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [dungeonPDA] = this.getDungeonPDA(matchPDA);

    const tx = await this.program.methods
      .generateDungeon(vrfSeed)
      .accounts({
        dungeonState: dungeonPDA,
        matchState: matchPDA,
        payer: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async startMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);

    const tx = await program.methods
      .startMatch()
      .accounts({
        matchState: matchPDA,
        player: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // ============================================
  // DELEGATION OPERATIONS - Move to TEE
  // ============================================

  async delegateMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [bufferPDA] = this.getBufferPDA(matchPDA);
    const [delegationRecordPDA] = this.getDelegationRecordPDA(matchPDA);
    const [delegationMetadataPDA] = this.getDelegationMetadataPDA(matchPDA);

    const tx = await this.program.methods
      .delegateMatch()
      .accounts({
        payer: this.wallet.publicKey,
        bufferMatchState: bufferPDA,
        delegationRecordMatchState: delegationRecordPDA,
        delegationMetadataMatchState: delegationMetadataPDA,
        matchState: matchPDA,
        ownerProgram: new PublicKey(PROGRAM_ID),
        delegationProgram: new PublicKey(MAGICBLOCK.DELEGATION_PROGRAM),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async delegatePlayer(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);
    const [bufferPDA] = this.getBufferPDA(playerPDA);
    const [delegationRecordPDA] = this.getDelegationRecordPDA(playerPDA);
    const [delegationMetadataPDA] = this.getDelegationMetadataPDA(playerPDA);

    const tx = await this.program.methods
      .delegatePlayer()
      .accounts({
        player: this.wallet.publicKey,
        bufferPlayerState: bufferPDA,
        delegationRecordPlayerState: delegationRecordPDA,
        delegationMetadataPlayerState: delegationMetadataPDA,
        playerState: playerPDA,
        matchState: matchPDA,
        ownerProgram: new PublicKey(PROGRAM_ID),
        delegationProgram: new PublicKey(MAGICBLOCK.DELEGATION_PROGRAM),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async delegateDungeon(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [dungeonPDA] = this.getDungeonPDA(matchPDA);
    const [bufferPDA] = this.getBufferPDA(dungeonPDA);
    const [delegationRecordPDA] = this.getDelegationRecordPDA(dungeonPDA);
    const [delegationMetadataPDA] = this.getDelegationMetadataPDA(dungeonPDA);

    const tx = await this.program.methods
      .delegateDungeon()
      .accounts({
        payer: this.wallet.publicKey,
        bufferDungeonState: bufferPDA,
        delegationRecordDungeonState: delegationRecordPDA,
        delegationMetadataDungeonState: delegationMetadataPDA,
        dungeonState: dungeonPDA,
        matchState: matchPDA,
        ownerProgram: new PublicKey(PROGRAM_ID),
        delegationProgram: new PublicKey(MAGICBLOCK.DELEGATION_PROGRAM),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async createPlayerPermission(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);

    const [permissionPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("permission"),
        playerPDA.toBuffer(),
        this.wallet.publicKey.toBuffer(),
      ],
      new PublicKey(MAGICBLOCK.PERMISSION_PROGRAM)
    );

    const tx = await this.program.methods
      .createPlayerPermission()
      .accounts({
        player: this.wallet.publicKey,
        playerState: playerPDA,
        matchState: matchPDA,
        permission: permissionPDA,
        permissionProgram: new PublicKey(MAGICBLOCK.PERMISSION_PROGRAM),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ============================================
  // GAMEPLAY OPERATIONS - Run on TEE
  // ============================================

  async movePlayer(
    matchId: BN,
    direction: Direction,
    opponentPubkey: PublicKey
  ): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);
    const [opponentPDA] = this.getPlayerStatePDA(matchPDA, opponentPubkey);
    const [dungeonPDA] = this.getDungeonPDA(matchPDA);

    const directionArg = { [direction.toLowerCase()]: {} };

    const tx = await program.methods
      .movePlayer(directionArg)
      .accounts({
        playerState: playerPDA,
        opponentState: opponentPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
        opponent: opponentPubkey,
      })
      .rpc();

    return tx;
  }

  async collectTreasure(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);
    const [dungeonPDA] = this.getDungeonPDA(matchPDA);

    const tx = await program.methods
      .collectTreasure()
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  async escape(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);
    const [dungeonPDA] = this.getDungeonPDA(matchPDA);

    const tx = await program.methods
      .escape()
      .accounts({
        playerState: playerPDA,
        matchState: matchPDA,
        dungeonState: dungeonPDA,
        player: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // ============================================
  // COMBAT OPERATIONS
  // ============================================

  async initCombat(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);
    const [combatPDA] = this.getCombatPDA(matchPDA);

    const tx = await program.methods
      .initCombat()
      .accounts({
        combatState: combatPDA,
        matchState: matchPDA,
        player: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  async lockCombatAction(
    matchId: BN,
    action: "attack" | "block" | "dodge" | "heavy"
  ): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram() || this.program;

    const [matchPDA] = this.getMatchPDA(matchId);
    const [combatPDA] = this.getCombatPDA(matchPDA);

    const actionArg = { [action]: {} };

    const tx = await program.methods
      .lockCombatAction(actionArg)
      .accounts({
        matchState: matchPDA,
        combatState: combatPDA,
        player: this.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  // ============================================
  // UNDELEGATION - Return to L1
  // ============================================

  async undelegateMatch(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram();
    if (!program) throw new Error("TEE connection required for undelegation");

    const [matchPDA] = this.getMatchPDA(matchId);

    const tx = await program.methods
      .undelegateMatch()
      .accounts({
        payer: this.wallet.publicKey,
        matchState: matchPDA,
        magicProgram: new PublicKey(MAGICBLOCK.MAGIC_PROGRAM),
        magicContext: new PublicKey(MAGICBLOCK.MAGIC_CONTEXT),
      })
      .rpc();

    return tx;
  }

  async undelegatePlayer(matchId: BN): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not connected");

    const program = this.getTEEProgram();
    if (!program) throw new Error("TEE connection required for undelegation");

    const [matchPDA] = this.getMatchPDA(matchId);
    const [playerPDA] = this.getPlayerStatePDA(matchPDA, this.wallet.publicKey);

    const tx = await program.methods
      .undelegatePlayer()
      .accounts({
        payer: this.wallet.publicKey,
        playerState: playerPDA,
        matchState: matchPDA,
        magicProgram: new PublicKey(MAGICBLOCK.MAGIC_PROGRAM),
        magicContext: new PublicKey(MAGICBLOCK.MAGIC_CONTEXT),
      })
      .rpc();

    return tx;
  }

  // ============================================
  // UTILITY
  // ============================================

  generateMatchId(): BN {
    return new BN(Date.now());
  }

  generateVRFSeed(): number[] {
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    return Array.from(seed);
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let clientInstance: ShadowDelveClient | null = null;

export function getShadowDelveClient(
  connection?: Connection
): ShadowDelveClient {
  if (!clientInstance) {
    clientInstance = new ShadowDelveClient(connection);
  }
  return clientInstance;
}

export function resetShadowDelveClient(): void {
  clientInstance = null;
  clearAuthToken();
}

// ============================================
// DIRECTION CONVERSION
// ============================================

export function directionToAnchor(direction: Direction): object {
  switch (direction) {
    case Direction.Up:
      return { up: {} };
    case Direction.Down:
      return { down: {} };
    case Direction.Left:
      return { left: {} };
    case Direction.Right:
      return { right: {} };
  }
}

export function anchorStatusToEnum(status: object): MatchStatus {
  if ("waiting" in status) return MatchStatus.Waiting;
  if ("ready" in status) return MatchStatus.Ready;
  if ("active" in status) return MatchStatus.Active;
  if ("ended" in status) return MatchStatus.Ended;
  return MatchStatus.Waiting;
}
