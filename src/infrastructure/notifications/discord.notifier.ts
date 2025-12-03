import type { INotifier } from "../../domain/interfaces/notifier.js";
import { getLogger } from "../../shared/logger.js";

const FETCH_TIMEOUT_MS = 10_000;

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: DiscordField[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Discord webhook notifier for error and info notifications.
 */
export class DiscordNotifier implements INotifier {
  private readonly logger = getLogger().child("Discord");

  constructor(private readonly webhookUrl: string | undefined) {
    if (!webhookUrl) {
      this.logger.warn("Discord webhook URL not configured - notifications disabled");
    }
  }

  /**
   * Send a failure notification.
   */
  async notifyFailure(
    roundId: bigint | null,
    reason: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const fields: DiscordField[] = [];

    if (roundId !== null) {
      fields.push({ name: "Round ID", value: roundId.toString(), inline: true });
    }

    fields.push({ name: "Reason", value: reason });

    if (details) {
      for (const [key, value] of Object.entries(details)) {
        if (value !== undefined && value !== null) {
          fields.push({
            name: key,
            value: typeof value === "string" ? value : JSON.stringify(value),
            inline: true,
          });
        }
      }
    }

    await this.sendEmbed({
      title: "❌ Round Collection Failed",
      color: 0xe74c3c, // Red
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "ORE History Collector" },
    });
  }

  /**
   * Send an info notification.
   */
  async notifyInfo(title: string, message: string): Promise<void> {
    await this.sendEmbed({
      title: `ℹ️ ${title}`,
      description: message,
      color: 0x3498db, // Blue
      timestamp: new Date().toISOString(),
      footer: { text: "ORE History Collector" },
    });
  }

  /**
   * Send an embed to the Discord webhook.
   */
  private async sendEmbed(embed: DiscordEmbed): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.debug("Discord notification skipped (no webhook URL)", { title: embed.title });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const payload = {
        username: "ORE Collector",
        embeds: [embed],
      };

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn("Discord webhook failed", { status: response.status });
      } else {
        this.logger.debug("Discord notification sent", { title: embed.title });
      }
    } catch (error) {
      this.logger.warn("Failed to send Discord notification", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

