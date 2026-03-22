# Shadow Delve

![Shadow Delve Banner](https://img.shields.io/badge/Shadow_Delve-Solana_PvP-ff6b35?style=for-the-badge) ![MagicBlock TEE](https://img.shields.io/badge/Powered_by-MagicBlock_TEE-9b59b6?style=for-the-badge)

Shadow Delve is a fully on-chain, 2-player dungeon crawler PvP game built on Solana. Players spawn in a beautifully rendered retro 8-bit village, enter a matchmaking lobby, and are thrown into a procedurally generated dungeon to hunt for treasure, navigate the fog of war, and battle each other to the death.

Built for the **MagicBlock Hackathon**, Shadow Delve leverages **Ephemeral Rollups (ER)** and **Trusted Execution Environments (TEE)** to create a private, high-frequency gaming experience that would be impossible on a standard Layer 1 blockchain.

## 🌟 The Core Idea & Innovation

Historically, fully on-chain games struggle with two major limitations:
1. **Latency:** Waiting for block confirmations makes real-time movement impossible.
2. **Hidden Information:** All state on a public blockchain is transparent, making concepts like "Fog of War" or hidden player positions trivial to exploit by querying the RPC.

**Shadow Delve solves both of these using MagicBlock's Ephemeral Rollups (TEE):**

By delegating the `MatchState` and `DungeonState` accounts from Solana L1 Devnet to the MagicBlock Private Ephemeral Rollup (PER), we achieve:

* **Zero-Latency Gameplay:** Grid-based player movement and item collection happen with near-zero latency. The TEE processes state transitions instantly, providing a smooth, responsive, tick-based feel.
* **Cryptographic Fog of War:** Because the delegated game state is processed within a Secure Enclave (Intel SGX), the opponent's true position is physically hidden from the client until they are within a specific grid radius (line of sight). Players traverse the dungeon blindly. You cannot cheat by querying the RPC because the TEE only returns your localized view of the state.

Players move through the dungeon gathering gold, unaware of their opponent's location. When two players collide on the same grid tile, the TEE instantly detects the collision and locks the state into a real-time combat phase. Upon death or escaping the dungeon, the final state is undelegated and settled back to the Solana L1.

## 🏗️ Architecture & Integration

### Solana Program (Anchor)
The core logic is written in Rust using the Anchor framework. It handles:
- Matchmaking (`create_match`, `join_match`)
- Procedural Dungeon Generation (seeded VRF)
- Player state tracking (Position, Health, Gold)
- High-frequency movements (`move_player`, `collect_treasure`)
- Combat resolution

**Program ID (Devnet):** `GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh`

### MagicBlock Integration Structure
1. **Match Creation (L1):** Player 1 creates a match and generates a dungeon on the Solana Devnet.
2. **Delegation (L1 -> ER):** Player 1 calls the MagicBlock Delegation Program to transfer ownership of the `MatchState` and `DungeonState` PDAs to the TEE Validator (`FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`).
3. **TEE Authentication:** Player 2 connects to the TEE RPC via cryptographic Challenge-Response, using their wallet's `signMessage` to generate an auth token.
4. **Join & Play (ER):** Player 2 joins the delegated match directly on the Ephemeral Rollup. Gameplay ensues at high frequency.
5. **Undelegation (ER -> L1):** Once the match concludes, the accounts are pushed back to the L1 via Magic Actions.

### Frontend Client
The app is a React (Vite) application utilizing:
- `@magicblock-labs/ephemeral-rollups-sdk` for TEE authentication and RPC routing.
- HTML5 Canvas for rendering the 8-bit PicoVillage assets, fog of war masking, and dynamic lighting.
- `@solana/wallet-adapter-react` for signing transactions.

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+)
- pnpm or yarn
- Rust & Cargo
- Solana CLI
- Anchor CLI (`0.30.1`)

### 1. Build the Solana Program
```bash
cd programs/shadow-delve
anchor build
```

### 2. Start the Frontend App
```bash
cd app
pnpm install
pnpm dev
```
Navigate to `http://localhost:3000` to play. 

*Note: To test the PvP features, you will need to open two separate browser windows (or use an incognito window) with two different Solana wallets (e.g., Phantom and Backpack) connected to Devnet.*

## 🎮 Gameplay Flow

1. **The Village (L1):** You start in the Village, an interactive waiting area. Walk into the Tavern to access the Matchmaking Lobby.
2. **The Lobby (L1 -> TEE):** Host a match. This triggers the Anchor instructions to initialize the game state on Devnet and immediately delegates the state to the MagicBlock TEE. Share your Match ID with a friend.
3. **The Dungeon (TEE):** Once the opponent joins, both players are spawned into the dungeon. The screen is dark except for your immediate surroundings. Use WASD/Arrow keys to navigate. Collect gold chests.
4. **The Collision:** Because of the TEE, you cannot see the opponent until they enter your visual radius. If you step on the same tile, combat initiates.
5. **Settlement (TEE -> L1):** Defeat your opponent or find the exit to win. The state is undelegated, and your stats are recorded back on Solana L1.

## 🛠️ Built With
- [Solana](https://solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [MagicBlock Ephemeral Rollups](https://magicblock.gg/)
- React + Vite + TypeScript
- PicoVillage Tile Assets

---
*Created for the MagicBlock Hackathon 2026*
