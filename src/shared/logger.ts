type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
};

const RESET = "\x1b[0m";

/**
 * Simple structured logger with level filtering.
 */
export class Logger {
  private readonly minLevel: number;

  constructor(
    private readonly prefix: string,
    level: LogLevel = "info"
  ) {
    this.minLevel = LEVEL_PRIORITY[level];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const levelTag = level.toUpperCase().padEnd(5);

    let output = `${color}[${timestamp}] [${levelTag}] [${this.prefix}]${RESET} ${message}`;

    if (data && Object.keys(data).length > 0) {
      output += ` ${JSON.stringify(data)}`;
    }

    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  /**
   * Create a child logger with a sub-prefix.
   */
  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`, this.getLevelName());
  }

  private getLevelName(): LogLevel {
    const entries = Object.entries(LEVEL_PRIORITY) as [LogLevel, number][];
    const found = entries.find(([, priority]) => priority === this.minLevel);
    return found?.[0] ?? "info";
  }
}

/**
 * Global logger instance.
 */
let globalLogger: Logger | null = null;

export function initLogger(level: LogLevel = "info"): Logger {
  globalLogger = new Logger("Collector", level);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger("Collector", "info");
  }
  return globalLogger;
}

