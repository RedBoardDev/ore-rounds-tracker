# ORE Historical Rounds Collector

Stable collector for ORE round data with pre-fin and post-fin snapshots.

## Features

- **Two-phase collection**: Pre-fin snapshot (before round ends) + Post-fin completion (after round ends)
- **Parallel fetching**: Price, mining cost, and on-chain data fetched concurrently
- **Zero tolerance**: Missing critical data = round deleted + Discord notification
- **SQLite persistence**: Atomic transactions, normalized schema
- **Graceful shutdown**: Waits for in-flight operations

## Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Copy environment template and configure
cp env.example .env
# Edit .env with your RPC URLs and Discord webhook

# 3. Initialize database
yarn db:init

# 4. (Optional) Check database status
yarn db:check

# 5. Build and run
yarn build
yarn start

# Or run in development mode (auto-reload)
yarn dev
```

## Setup Checklist

1. **RPC URLs**: Get reliable Solana RPC endpoints (mainnet-beta)
   - HTTP: `RPC_URL=https://your-rpc.com`
   - WebSocket: `RPC_WS_URL=wss://your-rpc.com`

2. **Discord Webhook** (optional but recommended):
   - Create a webhook in your Discord server
   - Set `DISCORD_WEBHOOK_URL` in `.env`

3. **Database**:
   - Run `yarn db:init` to create the SQLite database
   - Database is auto-initialized on first run if not present

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Solana RPC HTTP endpoint | Required |
| `RPC_WS_URL` | Solana RPC WebSocket endpoint | Required |
| `DISCORD_WEBHOOK_URL` | Discord webhook for failure notifications | Optional |
| `PRE_FIN_THRESHOLD_SLOTS` | Slots before round end to trigger pre-fin | `20` |
| `DB_PATH` | Path to SQLite database file | `./data/rounds.db` |
| `LOG_LEVEL` | Logging verbosity (debug/info/warn/error) | `info` |

## Adding a New Data Source

1. Create a new fetcher in `src/infrastructure/fetchers/`:
   ```typescript
   // new-source.fetcher.ts
   export class NewSourceFetcher extends BaseFetcher<MyDataType> {
     constructor() { super("NewSource", { retries: 3 }); }
     protected async doFetch(): Promise<MyDataType> { ... }
   }
   ```

2. Export from `src/infrastructure/fetchers/index.ts`

3. Inject in the appropriate use case (`collect-pre-fin.ts` or `complete-post-fin.ts`)

## Database Schema

Two normalized tables:

- **`rounds`**: One row per round (metadata, prices, aggregates, post-fin results)
- **`tiles`**: 25 rows per round (per-tile EV, stake data, final values)

See `src/infrastructure/database/schema.sql` for full DDL.

## Failure Handling

If any critical data is missing (price fetch failed, slot_hash is zero, etc.):

1. The round is **deleted** from the database
2. A **Discord notification** is sent with the failure reason
3. No partial data is ever stored


