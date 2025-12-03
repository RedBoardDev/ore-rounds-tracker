/**
 * Notification interface for error reporting.
 */
export interface INotifier {
  /**
   * Send a failure notification.
   * @param roundId - The round that failed (if known)
   * @param reason - Human-readable failure reason
   * @param details - Optional additional details
   */
  notifyFailure(
    roundId: bigint | null,
    reason: string,
    details?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Send an info notification.
   * @param title - Notification title
   * @param message - Notification message
   */
  notifyInfo(title: string, message: string): Promise<void>;
}

