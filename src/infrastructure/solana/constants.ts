import { PublicKey } from "@solana/web3.js";

// * ORE Program ID
export const PROGRAM_ID = new PublicKey("oreV3EG1i9BEgiAJ8b177Z2S2rMarzak4NMv1kULvWv");

// * ORE Token Mint
export const ORE_MINT = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");

// * SOL Token Mint (native wrapped SOL)
export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// * Split address for distributed top miner rewards
export const SPLIT_ADDRESS = new PublicKey("SpLiT11111111111111111111111111111111111112");

// * PDA Seeds
export const BOARD_SEED = Buffer.from("board");
export const ROUND_SEED = Buffer.from("round");
export const MINER_SEED = Buffer.from("miner");
export const TREASURY_SEED = Buffer.from("treasury");

// * Round timing constants
export const ONE_MINUTE_SLOTS = 150;
export const INTERMISSION_SLOTS = 35;

// * Token decimals
export const ORE_TOKEN_DECIMALS = 11;
export const ONE_ORE = 10 ** ORE_TOKEN_DECIMALS; // 100_000_000_000

// * Max supply
export const MAX_SUPPLY = 5_000_000 * ONE_ORE;

