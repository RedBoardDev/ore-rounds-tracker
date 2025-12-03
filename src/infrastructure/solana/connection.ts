import { Connection, PublicKey, type AccountInfo, type Commitment } from "@solana/web3.js";
import { getLogger } from "../../shared/logger.js";

/**
 * Solana connection wrapper with HTTP and WS endpoints.
 */
export class SolanaConnection {
  private readonly logger = getLogger().child("Solana");
  private connection: Connection | null = null;
  private currentSlot: bigint = 0n;
  private slotSubscriptionId: number | null = null;

  constructor(
    private readonly rpcUrl: string,
    private readonly wsUrl: string
  ) {}

  /**
   * Initialize the connection.
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing Solana connection", { rpcUrl: this.rpcUrl });

    this.connection = new Connection(this.rpcUrl, {
      wsEndpoint: this.wsUrl,
      commitment: "confirmed",
    });

    // * Fetch initial slot
    this.currentSlot = BigInt(await this.connection.getSlot());
    this.logger.info("Connected to Solana", { currentSlot: this.currentSlot.toString() });

    // * Subscribe to slot updates
    this.subscribeToSlotUpdates();
  }

  /**
   * Get the underlying Connection instance.
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error("Connection not initialized. Call initialize() first.");
    }
    return this.connection;
  }

  /**
   * Get the current slot.
   */
  getCurrentSlot(): bigint {
    return this.currentSlot;
  }

  /**
   * Fetch an account's data.
   */
  async getAccountInfo(
    address: PublicKey,
    commitment: Commitment = "confirmed"
  ): Promise<AccountInfo<Buffer> | null> {
    const conn = this.getConnection();
    return conn.getAccountInfo(address, commitment);
  }

  /**
   * Subscribe to account changes.
   * @returns Subscription ID for cleanup
   */
  subscribeToAccount(
    address: PublicKey,
    callback: (accountInfo: AccountInfo<Buffer>) => void,
    commitment: Commitment = "confirmed"
  ): number {
    const conn = this.getConnection();
    return conn.onAccountChange(
      address,
      (accountInfo) => {
        callback(accountInfo);
      },
      commitment
    );
  }

  /**
   * Unsubscribe from account changes.
   */
  async unsubscribeFromAccount(subscriptionId: number): Promise<void> {
    const conn = this.getConnection();
    await conn.removeAccountChangeListener(subscriptionId);
  }

  /**
   * Subscribe to slot updates to keep currentSlot fresh.
   */
  private subscribeToSlotUpdates(): void {
    const conn = this.getConnection();
    this.slotSubscriptionId = conn.onSlotChange((slotInfo) => {
      this.currentSlot = BigInt(slotInfo.slot);
    });
    this.logger.debug("Subscribed to slot updates");
  }

  /**
   * Close the connection and cleanup subscriptions.
   */
  async close(): Promise<void> {
    if (this.connection) {
      if (this.slotSubscriptionId !== null) {
        await this.connection.removeSlotChangeListener(this.slotSubscriptionId);
        this.slotSubscriptionId = null;
      }
      this.logger.info("Solana connection closed");
    }
  }
}

// * Singleton instance
let instance: SolanaConnection | null = null;

export function initSolanaConnection(rpcUrl: string, wsUrl: string): SolanaConnection {
  instance = new SolanaConnection(rpcUrl, wsUrl);
  return instance;
}

export function getSolanaConnection(): SolanaConnection {
  if (!instance) {
    throw new Error("Solana connection not initialized. Call initSolanaConnection() first.");
  }
  return instance;
}

