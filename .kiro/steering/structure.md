# Project Structure

## Directory Layout

```
backend/
├── src/
│   ├── bot-modular.js              # Main bot orchestrator (CURRENT)
│   ├── bot.js                      # Legacy monolithic bot (DEPRECATED)
│   ├── config/
│   │   └── settings.js             # Centralized configuration
│   ├── services/
│   │   ├── database.js             # SQLite operations
│   │   ├── exchange.js             # Binance API wrapper
│   │   ├── logger.js               # File-based logging
│   │   ├── telegram.js             # Telegram notifications
│   │   ├── websocket.js            # Real-time price streaming
│   │   └── technical-analysis.js   # Indicator calculations
│   └── utils/
│       ├── helpers.js              # Utility functions
│       └── diagnostics.js          # Diagnostic tools
├── logs/                           # Daily log files (YYYY-MM-DD.log)
├── index.js                        # Entry point
├── package.json                    # Dependencies
├── .env                            # Environment variables (NOT in git)
├── Dockerfile                      # Container definition
└── trades.db                       # SQLite database (NOT in git)

docs/                               # Documentation (markdown files)
docker-compose.yml                  # Docker orchestration
```

## Key Files

- **index.js**: Application entry point, loads `bot-modular.js`
- **bot-modular.js**: Main bot class, orchestrates all services
- **settings.js**: Single source of truth for all configuration
- **bot.js**: Old monolithic implementation - DO NOT USE

## Service Responsibilities

- **DatabaseService**: Trade persistence, position recovery, statistics
- **ExchangeService**: All Binance API calls with retry logic
- **TelegramService**: Notifications with cooldown management
- **LoggerService**: Daily rotating log files
- **WebSocketService**: Real-time price updates with auto-reconnect
- **TechnicalAnalysisService**: SMA, RSI, MACD, ATR calculations

## Conventions

- All services are classes with constructor injection of config
- Database operations use locking to prevent race conditions
- All external API calls wrapped in retry logic with exponential backoff
- Logs organized by date in `logs/` directory
- Comments in Arabic for business logic, English for technical details

## Documentation Guidelines

- **ALL markdown (.md) files** should be placed in the `docs/` folder
- This includes: guides, summaries, changelogs, architecture docs, etc.
- Exception: Root-level README.md can stay at project root
- When creating new documentation, always use `docs/` as the target directory
- Keep documentation organized and easy to find in one central location
