# 🌀 Vortex-Chain Trading Bot with Dashboard

Automated cryptocurrency trading bot for Binance with a comprehensive Angular dashboard for monitoring trades, viewing reports, and analyzing logs.

## 📋 Features

### Trading Bot (Backend)

- **Automated Trading**: Scans top volume coins and executes trades based on technical analysis
- **Risk Management**: Stop loss, take profit, trailing stops, and daily loss limits
- **Paper Trading**: Test mode for risk-free strategy validation
- **OCO Orders**: 24/7 protection even when bot is offline
- **Capital Protection**: Automatic pause during market crashes
- **Advanced Features**: Trailing TP, Dynamic SL, Smart Re-entry

### Dashboard (Frontend)

- **Real-time Dashboard**: Monitor open positions and recent trades
- **Performance Reports**: Daily, weekly, monthly, and yearly statistics
- **Log Viewer**: Browse and search bot logs with filtering
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Binance API keys
- Telegram Bot token

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd vortex-chain-apps
```

2. Configure environment variables

```bash
cd app-backend
cp .env.example .env
# Edit .env with your API keys
```

3. Start the services

```bash
cd ..
docker-compose up -d --build
```

4. Access the dashboard

```
http://localhost:4200
```

## 📊 Dashboard Pages

### Dashboard

- Overview of trading performance
- Open positions table
- Recent trades history
- Key statistics (win rate, P/L, fees)

### Reports

- Daily breakdown of trades
- Performance metrics by period
- Best/worst day analysis
- Profit/loss trends

### Logs

- Real-time log viewing
- Filter by log level (INFO, WARNING, ERROR, etc.)
- Search functionality
- Download logs

## 🔧 Configuration

### Backend (.env)

```env
# API Server
API_PORT=3000

# Binance
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key

# Telegram
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading
PAPER_TRADING=true
PAPER_BALANCE=1000
RISK_PERCENTAGE=2
MAX_POSITIONS=5
```

### Frontend

The frontend automatically connects to the backend API through nginx proxy.

## 🐳 Docker Services

- **backend**: Trading bot + API server (port 3000)
- **frontend**: Angular dashboard (port 4200)

## 📖 Documentation

See the `docs/` folder for detailed documentation:

- `ADVANCED_FEATURES.md`: Trailing TP, Dynamic SL, Smart Re-entry
- `CAPITAL_PROTECTION.md`: Market crash protection
- `OCO_ORDERS.md`: OCO orders explanation
- `PAPER_TRADING.md`: Test mode guide
- `DEPLOYMENT_v5.1.md`: Deployment guide

## 🛠️ Development

### Backend

```bash
cd app-backend
npm install
npm start
```

### Frontend

```bash
cd app-frontend
npm install
ng serve
```

## 📝 API Endpoints

- `GET /api/health` - Health check
- `GET /api/trades?period=day` - Get trades by period
- `GET /api/positions` - Get open positions
- `GET /api/stats/daily?period=week` - Get daily statistics
- `GET /api/logs?date=2024-01-01` - Get logs by date
- `GET /api/logs/dates` - Get available log dates
- `GET /api/stats/summary` - Get summary statistics

## ⚠️ Disclaimer

This bot is for educational purposes. Trade at your own risk. Never invest more than you can afford to lose.

## 📄 License

ISC
