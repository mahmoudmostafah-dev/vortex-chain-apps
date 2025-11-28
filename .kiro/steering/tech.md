# Technology Stack

## Runtime & Language

- **Node.js 22+** (CommonJS modules)
- **JavaScript** (no TypeScript)

## Core Dependencies

- **ccxt** (^4.5.22) - Cryptocurrency exchange integration (Binance)
- **node-telegram-bot-api** (^0.64.0) - Telegram notifications
- **sqlite3** (^5.1.7) + **sqlite** (^5.1.1) - Local database
- **ta.js** (^1.16.3) - Technical analysis indicators
- **ws** (^8.18.3) - WebSocket client for real-time prices
- **dotenv** (^17.2.3) - Environment configuration

## Architecture

Modular service-oriented architecture with clear separation of concerns:

- **Services**: Database, Exchange, Telegram, Logger, WebSocket, Technical Analysis
- **Config**: Centralized settings in `src/config/settings.js`
- **Utils**: Helper functions for calculations and formatting

## Database

SQLite with two main tables:

- `trades` - Historical trade records
- `positions` - Active open positions (for recovery on restart)

## Common Commands

```bash
# Install dependencies
npm install

# Run locally
npm start

# Run with Docker
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

## Environment Variables

Required in `.env`:

- `BINANCE_API_KEY` - Binance API key
- `BINANCE_SECRET_KEY` - Binance secret key
- `TELEGRAM_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Telegram chat ID for notifications
- `MAX_POSITIONS` - Maximum concurrent positions (default: 5)
- `TRADE_USD` - Position size in USD (default: 50)

## Deployment

Docker-based deployment with volume mounts for logs and database persistence.
