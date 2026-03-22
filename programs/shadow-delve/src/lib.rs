use anchor_lang::prelude::*;

// MagicBlock Ephemeral Rollups SDK imports
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

// Access control for TEE privacy
use ephemeral_rollups_sdk::access_control::instructions::CreatePermissionCpiBuilder;
use ephemeral_rollups_sdk::access_control::structs::{Member, MembersArgs, AUTHORITY_FLAG};
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;

declare_id!("GdsJcVVwzv8sMwyYuKXgKiYouPUEBPHQS54xD4Rd1kDh");

// Game constants
pub const GRID_SIZE: usize = 11;
pub const VISIBILITY_RADIUS: u8 = 2;
pub const MAX_HEALTH: u8 = 100;
pub const COMBAT_RANGE: u8 = 2;

// PDA seeds
pub const MATCH_SEED: &[u8] = b"match";
pub const PLAYER_SEED: &[u8] = b"player";
pub const DUNGEON_SEED: &[u8] = b"dungeon";
pub const COMBAT_SEED: &[u8] = b"combat";

#[ephemeral]
#[program]
pub mod shadow_delve {
    use super::*;

    // ============================================
    // MATCH SETUP INSTRUCTIONS (L1)
    // ============================================

    /// Create a new match - called on L1
    pub fn create_match(ctx: Context<CreateMatch>, match_id: u64) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        let clock = Clock::get()?;

        match_state.match_id = match_id;
        match_state.player1 = ctx.accounts.player.key();
        match_state.player2 = Pubkey::default();
        match_state.status = MatchStatus::Waiting;
        match_state.winner = None;
        match_state.vrf_seed = [0u8; 32];
        match_state.created_at = clock.unix_timestamp;
        match_state.ended_at = None;
        match_state.bump = ctx.bumps.match_state;

        msg!("Match created: {:?}", match_state.match_id);
        Ok(())
    }

    /// Join an existing match - called on L1
    pub fn join_match(ctx: Context<JoinMatch>) -> Result<()> {
        require!(
            ctx.accounts.match_state.status == MatchStatus::Waiting,
            ErrorCode::MatchNotWaiting
        );
        require!(
            ctx.accounts.match_state.player2 == Pubkey::default(),
            ErrorCode::MatchFull
        );

        let match_state = &mut ctx.accounts.match_state;
        match_state.player2 = ctx.accounts.player.key();
        match_state.status = MatchStatus::Ready;

        msg!("Player 2 joined match: {:?}", match_state.match_id);
        Ok(())
    }

    /// Initialize player state
    pub fn init_player_state(
        ctx: Context<InitPlayerState>,
        spawn_x: u8,
        spawn_y: u8,
    ) -> Result<()> {
        let player_state = &mut ctx.accounts.player_state;
        player_state.player = ctx.accounts.player.key();
        player_state.match_id = ctx.accounts.match_state.match_id;
        player_state.position = (spawn_x, spawn_y);
        player_state.health = MAX_HEALTH;
        player_state.gold = 0;
        player_state.is_alive = true;
        player_state.bump = ctx.bumps.player_state;

        msg!("Player state initialized at ({}, {})", spawn_x, spawn_y);
        Ok(())
    }

    /// Generate dungeon using VRF seed
    pub fn generate_dungeon(ctx: Context<GenerateDungeon>, vrf_seed: [u8; 32]) -> Result<()> {
        let dungeon = &mut ctx.accounts.dungeon_state;
        dungeon.match_id = ctx.accounts.match_state.match_id;
        dungeon.vrf_seed = vrf_seed;
        dungeon.bump = ctx.bumps.dungeon_state;

        // Generate dungeon layout from seed
        let grid = generate_dungeon_grid(&vrf_seed);
        dungeon.grid = grid;

        // Place treasures
        dungeon.treasures = generate_treasures(&vrf_seed);

        // Place exit
        dungeon.exit_pos = generate_exit(&vrf_seed);

        // Initialize spawn positions for both players
        dungeon.spawn1 = (1, 1);
        dungeon.spawn2 = (GRID_SIZE as u8 - 2, GRID_SIZE as u8 - 2);

        msg!(
            "Dungeon generated with {} treasures",
            dungeon.treasures.len()
        );
        Ok(())
    }

    /// Start match after all setup is complete
    pub fn start_match(ctx: Context<StartMatch>) -> Result<()> {
        require!(
            ctx.accounts.match_state.status == MatchStatus::Ready,
            ErrorCode::MatchNotReady
        );

        let match_state = &mut ctx.accounts.match_state;
        match_state.status = MatchStatus::Active;

        msg!("Match started: {:?}", match_state.match_id);
        Ok(())
    }

    // ============================================
    // EPHEMERAL ROLLUP DELEGATION INSTRUCTIONS
    // ============================================

    /// Delegate match state to Ephemeral Rollup for fast, gasless gameplay
    /// This moves the account to the ER validator for high-speed transactions
    pub fn delegate_match(ctx: Context<DelegateMatch>) -> Result<()> {
        let match_id = ctx.accounts.match_state.match_id;

        ctx.accounts.delegate_match_state(
            &ctx.accounts.payer,
            &[MATCH_SEED, &match_id.to_le_bytes()],
            DelegateConfig {
                // Use default MagicBlock validator
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;

        msg!("Match {} delegated to Ephemeral Rollup", match_id);
        Ok(())
    }

    /// Delegate player state to ER for private gameplay
    pub fn delegate_player(ctx: Context<DelegatePlayer>) -> Result<()> {
        let match_key = ctx.accounts.match_state.key();
        let player_key = ctx.accounts.player.key();

        ctx.accounts.delegate_player_state(
            &ctx.accounts.player,
            &[PLAYER_SEED, match_key.as_ref(), player_key.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;

        msg!("Player state delegated to Ephemeral Rollup");
        Ok(())
    }

    /// Delegate dungeon state to ER
    pub fn delegate_dungeon(ctx: Context<DelegateDungeon>) -> Result<()> {
        let match_key = ctx.accounts.match_state.key();

        ctx.accounts.delegate_dungeon_state(
            &ctx.accounts.payer,
            &[DUNGEON_SEED, match_key.as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;

        msg!("Dungeon state delegated to Ephemeral Rollup");
        Ok(())
    }

    /// Undelegate and commit match results back to L1
    /// Called when match ends to settle final state on-chain
    pub fn undelegate_match(ctx: Context<UndelegateMatch>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.match_state.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        msg!("Match undelegated and committed to L1");
        Ok(())
    }

    /// Undelegate player state back to L1
    pub fn undelegate_player(ctx: Context<UndelegatePlayer>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.player_state.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        msg!("Player state undelegated and committed to L1");
        Ok(())
    }

    // ============================================
    // TEE PRIVACY INSTRUCTIONS
    // ============================================

    /// Create privacy permission for player state
    /// This ensures only the player can see their own position/gold
    pub fn create_player_permission(ctx: Context<CreatePlayerPermission>) -> Result<()> {
        let player_key = ctx.accounts.player.key();
        let match_key = ctx.accounts.match_state.key();

        // Only the player themselves can read their state
        let members = vec![Member {
            flags: AUTHORITY_FLAG, // Player is the authority
            pubkey: player_key,
        }];

        CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&ctx.accounts.player_state.to_account_info())
            .permission(&ctx.accounts.permission.to_account_info())
            .payer(&ctx.accounts.player.to_account_info())
            .system_program(&ctx.accounts.system_program.to_account_info())
            .args(MembersArgs {
                members: Some(members),
            })
            .invoke_signed(&[&[
                PLAYER_SEED,
                match_key.as_ref(),
                player_key.as_ref(),
                &[ctx.accounts.player_state.bump],
            ]])?;

        msg!("Privacy permission created for player");
        Ok(())
    }

    // ============================================
    // GAMEPLAY INSTRUCTIONS (Run on ER)
    // ============================================

    /// Move player - gasless on ER
    pub fn move_player(ctx: Context<MovePlayer>, direction: Direction) -> Result<MoveResult> {
        require!(ctx.accounts.player_state.is_alive, ErrorCode::PlayerDead);
        require!(
            ctx.accounts.match_state.status == MatchStatus::Active,
            ErrorCode::MatchNotActive
        );

        let player = &mut ctx.accounts.player_state;
        let dungeon = &ctx.accounts.dungeon_state;

        let (new_x, new_y) = match direction {
            Direction::Up => (player.position.0, player.position.1.saturating_sub(1)),
            Direction::Down => (player.position.0, player.position.1.saturating_add(1)),
            Direction::Left => (player.position.0.saturating_sub(1), player.position.1),
            Direction::Right => (player.position.0.saturating_add(1), player.position.1),
        };

        // Check bounds
        if new_x >= GRID_SIZE as u8 || new_y >= GRID_SIZE as u8 {
            return err!(ErrorCode::OutOfBounds);
        }

        // Check if tile is walkable
        if !is_walkable(dungeon.grid[new_y as usize][new_x as usize]) {
            return err!(ErrorCode::BlockedTile);
        }

        player.position = (new_x, new_y);

        // Check if player reached exit
        let reached_exit = player.position == dungeon.exit_pos;

        // Check proximity to other player (for combat trigger)
        let enemy_nearby =
            check_enemy_proximity(&ctx.accounts.player_state, &ctx.accounts.opponent_state);

        msg!("Player moved to ({}, {})", new_x, new_y);

        Ok(MoveResult {
            new_position: (new_x, new_y),
            reached_exit,
            enemy_nearby,
            enemy_in_combat_range: enemy_nearby
                && is_in_combat_range(&ctx.accounts.player_state, &ctx.accounts.opponent_state),
        })
    }

    /// Collect treasure at current position
    pub fn collect_treasure(ctx: Context<CollectTreasure>) -> Result<()> {
        let player = &mut ctx.accounts.player_state;
        let dungeon = &mut ctx.accounts.dungeon_state;

        let pos = player.position;

        // Find treasure at current position
        if let Some(treasure_idx) = dungeon
            .treasures
            .iter()
            .position(|t| t.position == pos && !t.collected)
        {
            let treasure = &mut dungeon.treasures[treasure_idx];
            player.gold += treasure.amount;
            treasure.collected = true;

            msg!(
                "Collected {} gold at ({}, {})",
                treasure.amount,
                pos.0,
                pos.1
            );
        }

        Ok(())
    }

    /// Check proximity to enemy player
    pub fn check_proximity(ctx: Context<CheckProximity>) -> Result<ProximityResult> {
        let player = &ctx.accounts.player_state;
        let opponent = &ctx.accounts.opponent_state;

        if !opponent.is_alive {
            return Ok(ProximityResult {
                enemy_nearby: false,
                distance: u8::MAX,
                in_combat_range: false,
            });
        }

        let distance = manhattan_distance(player.position, opponent.position);

        Ok(ProximityResult {
            enemy_nearby: distance <= VISIBILITY_RADIUS * 2,
            distance,
            in_combat_range: distance <= COMBAT_RANGE,
        })
    }

    // ============================================
    // COMBAT INSTRUCTIONS
    // ============================================

    /// Initialize combat state when players meet
    pub fn init_combat(ctx: Context<InitCombat>) -> Result<()> {
        let combat = &mut ctx.accounts.combat_state;
        combat.match_id = ctx.accounts.match_state.match_id;
        combat.player1_action = None;
        combat.player2_action = None;
        combat.round = 0;
        combat.resolved = false;
        combat.bump = ctx.bumps.combat_state;

        msg!("Combat initialized");
        Ok(())
    }

    /// Lock combat action (hidden from opponent until reveal)
    pub fn lock_combat_action(ctx: Context<LockCombatAction>, action: CombatAction) -> Result<()> {
        let combat = &mut ctx.accounts.combat_state;

        require!(!combat.resolved, ErrorCode::CombatAlreadyResolved);

        if ctx.accounts.player.key() == ctx.accounts.match_state.player1 {
            combat.player1_action = Some(action);
        } else {
            combat.player2_action = Some(action);
        }

        msg!("Combat action locked");
        Ok(())
    }

    /// Resolve combat using VRF result
    pub fn resolve_combat(
        ctx: Context<ResolveCombat>,
        vrf_result: [u8; 32],
    ) -> Result<CombatResult> {
        let combat = &mut ctx.accounts.combat_state;
        let player1_state = &mut ctx.accounts.player1_state;
        let player2_state = &mut ctx.accounts.player2_state;

        require!(
            combat.player1_action.is_some() && combat.player2_action.is_some(),
            ErrorCode::ActionsNotLocked
        );
        require!(!combat.resolved, ErrorCode::CombatAlreadyResolved);

        let action1 = combat.player1_action.unwrap();
        let action2 = combat.player2_action.unwrap();

        // Resolve combat
        let (damage1, damage2) = resolve_combat_actions(action1, action2, &vrf_result);

        player1_state.health = player1_state.health.saturating_sub(damage1);
        player2_state.health = player2_state.health.saturating_sub(damage2);

        // Check for deaths and handle gold drop
        let mut gold_dropped: u64 = 0;
        if player1_state.health == 0 {
            player1_state.is_alive = false;
            gold_dropped = player1_state.gold / 2; // Drop 50% of gold
            player1_state.gold -= gold_dropped;
            player2_state.gold += gold_dropped;
        }
        if player2_state.health == 0 {
            player2_state.is_alive = false;
            gold_dropped = player2_state.gold / 2;
            player2_state.gold -= gold_dropped;
            player1_state.gold += gold_dropped;
        }

        combat.resolved = true;
        combat.round += 1;

        let result = CombatResult {
            player1_damage: damage1,
            player2_damage: damage2,
            player1_health: player1_state.health,
            player2_health: player2_state.health,
            gold_dropped,
            winner: if !player1_state.is_alive {
                Some(player2_state.player)
            } else if !player2_state.is_alive {
                Some(player1_state.player)
            } else {
                None
            },
        };

        msg!(
            "Combat resolved: P1 took {} damage, P2 took {} damage",
            damage1,
            damage2
        );
        Ok(result)
    }

    // ============================================
    // END GAME INSTRUCTIONS
    // ============================================

    /// Escape with gold - ends match (commits to L1 via Magic Actions)
    pub fn escape(ctx: Context<Escape>) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        let player_state = &ctx.accounts.player_state;
        let dungeon = &ctx.accounts.dungeon_state;

        require!(
            player_state.position == dungeon.exit_pos,
            ErrorCode::NotAtExit
        );
        require!(
            match_state.status == MatchStatus::Active,
            ErrorCode::MatchNotActive
        );

        match_state.winner = Some(player_state.player);
        match_state.status = MatchStatus::Ended;
        match_state.ended_at = Some(Clock::get()?.unix_timestamp);

        msg!("Player escaped with {} gold!", player_state.gold);
        Ok(())
    }

    /// Forfeit match
    pub fn forfeit(ctx: Context<Forfeit>) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        let player_state = &mut ctx.accounts.player_state;

        player_state.is_alive = false;

        // Determine winner (the other player)
        if ctx.accounts.player.key() == match_state.player1 {
            match_state.winner = Some(match_state.player2);
        } else {
            match_state.winner = Some(match_state.player1);
        }
        match_state.status = MatchStatus::Ended;
        match_state.ended_at = Some(Clock::get()?.unix_timestamp);

        msg!("Player forfeited");
        Ok(())
    }

    /// Close match and settle - returns rent
    pub fn close_match(ctx: Context<CloseMatch>) -> Result<()> {
        require!(
            ctx.accounts.match_state.status == MatchStatus::Ended,
            ErrorCode::MatchNotEnded
        );

        msg!("Match closed");
        Ok(())
    }
}

// ============================================
// ACCOUNT STRUCTURES
// ============================================

#[account]
#[derive(InitSpace)]
pub struct MatchState {
    pub match_id: u64,
    pub player1: Pubkey,
    pub player2: Pubkey,
    pub status: MatchStatus,
    pub winner: Option<Pubkey>,
    pub vrf_seed: [u8; 32],
    pub created_at: i64,
    pub ended_at: Option<i64>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerState {
    pub player: Pubkey,
    pub match_id: u64,
    pub position: (u8, u8),
    pub health: u8,
    pub gold: u64,
    pub is_alive: bool,
    pub bump: u8,
}

#[account]
pub struct DungeonState {
    pub match_id: u64,
    pub vrf_seed: [u8; 32],
    pub grid: [[TileType; GRID_SIZE]; GRID_SIZE],
    pub treasures: Vec<Treasure>,
    pub exit_pos: (u8, u8),
    pub spawn1: (u8, u8),
    pub spawn2: (u8, u8),
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CombatState {
    pub match_id: u64,
    pub player1_action: Option<CombatAction>,
    pub player2_action: Option<CombatAction>,
    pub round: u8,
    pub resolved: bool,
    pub bump: u8,
}

// ============================================
// ENUMS AND HELPER STRUCTS
// ============================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MatchStatus {
    Waiting,
    Ready,
    Active,
    Ended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TileType {
    Floor,
    Wall,
    Exit,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CombatAction {
    Attack, // Quick attack, 15 base damage
    Block,  // Reduces incoming damage 50%, reflects 5
    Dodge,  // Avoid attack, vulnerable to block
    Heavy,  // Slow attack, 30 damage, can be dodged
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Treasure {
    pub position: (u8, u8),
    pub amount: u64,
    pub collected: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MoveResult {
    pub new_position: (u8, u8),
    pub reached_exit: bool,
    pub enemy_nearby: bool,
    pub enemy_in_combat_range: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProximityResult {
    pub enemy_nearby: bool,
    pub distance: u8,
    pub in_combat_range: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CombatResult {
    pub player1_damage: u8,
    pub player2_damage: u8,
    pub player1_health: u8,
    pub player2_health: u8,
    pub gold_dropped: u64,
    pub winner: Option<Pubkey>,
}

// ============================================
// ACCOUNT CONTEXTS - L1 SETUP
// ============================================

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + MatchState::INIT_SPACE,
        seeds = [MATCH_SEED, match_id.to_le_bytes().as_ref()],
        bump
    )]
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinMatch<'info> {
    #[account(mut, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartMatch<'info> {
    #[account(mut, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitPlayerState<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + PlayerState::INIT_SPACE,
        seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub player_state: Account<'info, PlayerState>,
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GenerateDungeon<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 8 + 32 + GRID_SIZE * GRID_SIZE + 4 + 200 + 8 + 4 + 1,
        seeds = [DUNGEON_SEED, match_state.key().as_ref()],
        bump
    )]
    pub dungeon_state: Account<'info, DungeonState>,
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ============================================
// ACCOUNT CONTEXTS - ER DELEGATION
// ============================================

#[delegate]
#[derive(Accounts)]
pub struct DelegateMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The match state PDA to delegate
    #[account(
        mut, 
        del,
        seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], 
        bump = match_state.bump
    )]
    pub match_state: Account<'info, MatchState>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    /// The player state PDA to delegate
    #[account(
        mut,
        del,
        seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()],
        bump = player_state.bump
    )]
    pub player_state: Account<'info, PlayerState>,
    pub match_state: Account<'info, MatchState>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateDungeon<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The dungeon state PDA to delegate
    #[account(
        mut,
        del,
        seeds = [DUNGEON_SEED, match_state.key().as_ref()],
        bump = dungeon_state.bump
    )]
    pub dungeon_state: Account<'info, DungeonState>,
    pub match_state: Account<'info, MatchState>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegatePlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), payer.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    pub match_state: Account<'info, MatchState>,
}

// ============================================
// ACCOUNT CONTEXTS - TEE PRIVACY
// ============================================

#[derive(Accounts)]
pub struct CreatePlayerPermission<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()],
        bump = player_state.bump
    )]
    pub player_state: Account<'info, PlayerState>,
    pub match_state: Account<'info, MatchState>,
    /// CHECK: Permission account created by permission program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,
    /// CHECK: Permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// ============================================
// ACCOUNT CONTEXTS - GAMEPLAY
// ============================================

#[derive(Accounts)]
pub struct MovePlayer<'info> {
    #[account(seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(seeds = [PLAYER_SEED, match_state.key().as_ref(), opponent.key().as_ref()], bump)]
    pub opponent_state: Account<'info, PlayerState>,
    pub dungeon_state: Account<'info, DungeonState>,
    pub player: Signer<'info>,
    /// CHECK: Opponent account
    pub opponent: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CollectTreasure<'info> {
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(mut, seeds = [DUNGEON_SEED, match_state.key().as_ref()], bump = dungeon_state.bump)]
    pub dungeon_state: Account<'info, DungeonState>,
    pub match_state: Account<'info, MatchState>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckProximity<'info> {
    #[account(seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    #[account(seeds = [PLAYER_SEED, match_state.key().as_ref(), opponent.key().as_ref()], bump)]
    pub opponent_state: Account<'info, PlayerState>,
    pub player: Signer<'info>,
    /// CHECK: Opponent account
    pub opponent: AccountInfo<'info>,
}

// ============================================
// ACCOUNT CONTEXTS - COMBAT
// ============================================

#[derive(Accounts)]
pub struct InitCombat<'info> {
    #[account(
        init,
        payer = player,
        space = 8 + CombatState::INIT_SPACE,
        seeds = [COMBAT_SEED, match_state.key().as_ref()],
        bump
    )]
    pub combat_state: Account<'info, CombatState>,
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockCombatAction<'info> {
    #[account(seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut, seeds = [COMBAT_SEED, match_state.key().as_ref()], bump = combat_state.bump)]
    pub combat_state: Account<'info, CombatState>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveCombat<'info> {
    #[account(seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut, seeds = [COMBAT_SEED, match_state.key().as_ref()], bump = combat_state.bump)]
    pub combat_state: Account<'info, CombatState>,
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), match_state.player1.as_ref()], bump)]
    pub player1_state: Account<'info, PlayerState>,
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), match_state.player2.as_ref()], bump)]
    pub player2_state: Account<'info, PlayerState>,
}

// ============================================
// ACCOUNT CONTEXTS - END GAME
// ============================================

#[derive(Accounts)]
pub struct Escape<'info> {
    #[account(mut, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    pub dungeon_state: Account<'info, DungeonState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct Forfeit<'info> {
    #[account(mut, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut, seeds = [PLAYER_SEED, match_state.key().as_ref(), player.key().as_ref()], bump = player_state.bump)]
    pub player_state: Account<'info, PlayerState>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseMatch<'info> {
    #[account(mut, close = player, seeds = [MATCH_SEED, match_state.match_id.to_le_bytes().as_ref()], bump = match_state.bump)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub player: Signer<'info>,
}

// ============================================
// ERROR CODES
// ============================================

#[error_code]
pub enum ErrorCode {
    #[msg("Match is not waiting for players")]
    MatchNotWaiting,
    #[msg("Match is full")]
    MatchFull,
    #[msg("Match is not ready")]
    MatchNotReady,
    #[msg("Match is not active")]
    MatchNotActive,
    #[msg("Match has not ended")]
    MatchNotEnded,
    #[msg("Player is dead")]
    PlayerDead,
    #[msg("Movement out of bounds")]
    OutOfBounds,
    #[msg("Tile is blocked")]
    BlockedTile,
    #[msg("Not at exit position")]
    NotAtExit,
    #[msg("Combat already resolved")]
    CombatAlreadyResolved,
    #[msg("Combat actions not locked")]
    ActionsNotLocked,
    #[msg("Unauthorized - not your player state")]
    Unauthorized,
    #[msg("Invalid delegation state")]
    InvalidDelegation,
}

// ============================================
// HELPER FUNCTIONS
// ============================================

fn generate_dungeon_grid(seed: &[u8; 32]) -> [[TileType; GRID_SIZE]; GRID_SIZE] {
    let mut grid = [[TileType::Wall; GRID_SIZE]; GRID_SIZE];

    // Simple dungeon generation using seed
    for y in 1..GRID_SIZE - 1 {
        for x in 1..GRID_SIZE - 1 {
            let idx = (y * GRID_SIZE + x) % 32;
            if seed[idx] % 4 != 0 {
                grid[y][x] = TileType::Floor;
            }
        }
    }

    // Ensure spawns are floor
    grid[1][1] = TileType::Floor;
    grid[GRID_SIZE - 2][GRID_SIZE - 2] = TileType::Floor;

    // Create some guaranteed paths
    for i in 1..GRID_SIZE - 1 {
        grid[1][i] = TileType::Floor;
        grid[GRID_SIZE - 2][i] = TileType::Floor;
        grid[i][1] = TileType::Floor;
        grid[i][GRID_SIZE - 2] = TileType::Floor;
    }

    grid
}

fn generate_treasures(seed: &[u8; 32]) -> Vec<Treasure> {
    let mut treasures = Vec::new();
    let num_treasures = (seed[0] % 4) as usize + 3; // 3-6 treasures

    for i in 0..num_treasures {
        let idx = (i * 4) % 28;
        let x = (seed[idx] as usize) % (GRID_SIZE - 2) + 1;
        let y = (seed[idx + 1] as usize) % (GRID_SIZE - 2) + 1;
        let amount = ((seed[idx + 2] as u64) % 50 + 10) * 10; // 100-500 gold

        treasures.push(Treasure {
            position: (x as u8, y as u8),
            amount,
            collected: false,
        });
    }

    treasures
}

fn generate_exit(seed: &[u8; 32]) -> (u8, u8) {
    // Exit in middle-ish area
    let x = (seed[16] % 5) as u8 + 3;
    let y = (seed[17] % 5) as u8 + 3;
    (x, y)
}

fn is_walkable(tile: TileType) -> bool {
    matches!(tile, TileType::Floor | TileType::Exit)
}

fn manhattan_distance(pos1: (u8, u8), pos2: (u8, u8)) -> u8 {
    let dx = if pos1.0 > pos2.0 {
        pos1.0 - pos2.0
    } else {
        pos2.0 - pos1.0
    };
    let dy = if pos1.1 > pos2.1 {
        pos1.1 - pos2.1
    } else {
        pos2.1 - pos1.1
    };
    dx + dy
}

fn check_enemy_proximity(player: &PlayerState, opponent: &PlayerState) -> bool {
    if !opponent.is_alive {
        return false;
    }
    manhattan_distance(player.position, opponent.position) <= VISIBILITY_RADIUS * 2
}

fn is_in_combat_range(player: &PlayerState, opponent: &PlayerState) -> bool {
    if !opponent.is_alive {
        return false;
    }
    manhattan_distance(player.position, opponent.position) <= COMBAT_RANGE
}

/// Resolve combat with new sword combat system
/// Attack (15 dmg) < Block (reflects 5) < Dodge (evade) < Heavy (30 dmg) < Attack
fn resolve_combat_actions(
    action1: CombatAction,
    action2: CombatAction,
    vrf: &[u8; 32],
) -> (u8, u8) {
    // Base damages
    let attack_damage: u8 = 15;
    let heavy_damage: u8 = 30;
    let block_reflect: u8 = 5;

    // VRF-based critical hit (10% chance = 2x damage)
    let crit1 = vrf[0] % 10 == 0;
    let crit2 = vrf[1] % 10 == 0;
    let crit_mult = |base: u8, is_crit: bool| if is_crit { base * 2 } else { base };

    match (action1, action2) {
        // Attack vs Attack - both take damage
        (CombatAction::Attack, CombatAction::Attack) => (
            crit_mult(attack_damage, crit2),
            crit_mult(attack_damage, crit1),
        ),

        // Attack vs Block - attacker takes reflect damage
        (CombatAction::Attack, CombatAction::Block) => (block_reflect, 0),
        (CombatAction::Block, CombatAction::Attack) => (0, block_reflect),

        // Attack vs Dodge - miss, no damage
        (CombatAction::Attack, CombatAction::Dodge) => (0, 0),
        (CombatAction::Dodge, CombatAction::Attack) => (0, 0),

        // Attack vs Heavy - attack interrupts heavy, heavy user takes damage
        (CombatAction::Attack, CombatAction::Heavy) => (0, crit_mult(attack_damage, crit1)),
        (CombatAction::Heavy, CombatAction::Attack) => (crit_mult(attack_damage, crit2), 0),

        // Block vs Block - stalemate
        (CombatAction::Block, CombatAction::Block) => (0, 0),

        // Block vs Dodge - blocker catches dodger off-guard
        (CombatAction::Block, CombatAction::Dodge) => (0, block_reflect),
        (CombatAction::Dodge, CombatAction::Block) => (block_reflect, 0),

        // Block vs Heavy - block reduces heavy damage by 50%
        (CombatAction::Block, CombatAction::Heavy) => {
            (crit_mult(heavy_damage / 2, crit2), block_reflect)
        }
        (CombatAction::Heavy, CombatAction::Block) => {
            (block_reflect, crit_mult(heavy_damage / 2, crit1))
        }

        // Dodge vs Dodge - both miss
        (CombatAction::Dodge, CombatAction::Dodge) => (0, 0),

        // Dodge vs Heavy - dodge avoids heavy completely
        (CombatAction::Dodge, CombatAction::Heavy) => (0, 0),
        (CombatAction::Heavy, CombatAction::Dodge) => (0, 0),

        // Heavy vs Heavy - both take full damage
        (CombatAction::Heavy, CombatAction::Heavy) => (
            crit_mult(heavy_damage, crit2),
            crit_mult(heavy_damage, crit1),
        ),
    }
}
