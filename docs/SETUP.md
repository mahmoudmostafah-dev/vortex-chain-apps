# 🚀 Setup Guide - Vortex-Chain Trading Bot with Dashboard

## Prerequisites

- Docker & Docker Compose installed
- Binance account with API access
- Telegram Bot (optional but recommended)

## Step-by-Step Setup

### 1. Configure Backend

```bash
cd app-backend
cp .env.example .env
```

Edit `.env` file with your credentials:

```env
# API Server
API_PORT=3000

# Binance API (Get from https://www.binance.com/en/my/settings/api-management)
BINANCE_API_KEY=your_actual_api_key
BINANCE_SECRET_KEY=your_actual_secret_key

# Telegram (Get from @BotFather on Telegram)
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading Configuration
PAPER_TRADING=true          # Set to false for live trading
PAPER_BALANCE=1000          # Starting balance for paper trading
RISK_PERCENTAGE=2           # Risk 2% per trade
MAX_POSITIONS=5             # Maximum 5 open positions

# Capital Protection
CAPITAL_PROTECTION=true     # Enable market crash protection
```

### 2. Build and Start Services

From the root directory (`vortex-chain-apps/`):

```bash
docker-compose up -d --build
```

This will:

- Build the backend (trading bot + API server)
- Build the frontend (Angular dashboard)
- Start both services

### 3. Verify Services

Check if services are running:

```bash
docker-compose ps
```

You should see:

- `vortex-chain-bot` (backend) - running on port 3000
- `vortex-chain-dashboard` (frontend) - running on port 4200

### 4. Access Dashboard

Open your browser and navigate to:

```
http://localhost:4200
```

You should see the Vortex-Chain dashboard with three pages:

- **Dashboard**: Real-time trading overview
- **Reports**: Performance analytics
- **Logs**: Bot activity logs

### 5. Monitor Logs

View backend logs:

```bash
docker-compose logs -f backend
```

View frontend logs:

```bash
docker-compose logs -f frontend
```

## Testing the Setup

### 1. Paper Trading Mode (Recommended First)

The bot starts in paper trading mode by default (`PAPER_TRADING=true`). This allows you to:

- Test the bot without real money
- Verify API connections
- Check dashboard functionality
- Review trading signals

### 2. Check API Endpoints

Test the API manually:

```bash
# Health check
curl http://localhost:3000/api/health

# Get trades
curl http://localhost:3000/api/trades?period=day

# Get positions
curl http://localhost:3000/api/positions

# Get stats
curl http://localhost:3000/api/stats/daily?period=week
```

### 3. Verify Dashboard

1. Open http://localhost:4200
2. Navigate to Dashboard - should show stats (may be empty initially)
3. Navigate to Reports - should show period selector
4. Navigate to Logs - should show today's logs

## Switching to Live Trading

⚠️ **IMPORTANT**: Only switch to live trading after thoroughly testing in paper mode!

1. Stop the services:

```bash
docker-compose down
```

2. Edit `app-backend/.env`:

```env
PAPER_TRADING=false
```

3. Ensure you have sufficient USDT balance in Binance (minimum $50 recommended)

4. Restart services:

```bash
docker-compose up -d
```

5. Monitor closely via Telegram and dashboard

## Troubleshooting

### Backend won't start

Check logs:

```bash
docker-compose logs backend
```

Common issues:

- Invalid API keys → Check `.env` file
- Missing dependencies → Rebuild: `docker-compose up -d --build`
- Port 3000 in use → Change `API_PORT` in `.env`

### Frontend won't load

Check logs:

```bash
docker-compose logs frontend
```

Common issues:

- Backend not running → Start backend first
- Port 4200 in use → Change port in `docker-compose.yml`
- Build failed → Check Node.js version (requires 22+)

### Dashboard shows "Failed to fetch"

1. Verify backend is running: `curl http://localhost:3000/api/health`
2. Check browser console for errors (F12)
3. Verify nginx proxy configuration in `app-frontend/nginx.conf`

### No trades appearing

This is normal if:

- Market conditions don't meet signal criteria
- Paper trading mode with no matching signals
- Bot just started (needs time to scan)

Check logs to see scanning activity:

```bash
docker-compose logs -f backend | grep "Scanning"
```

## Updating

To update the bot:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

## Stopping the Bot

Temporary stop:

```bash
docker-compose stop
```

Complete shutdown:

```bash
docker-compose down
```

Remove everything (including database):

```bash
docker-compose down -v
```

## Data Persistence

The following data persists between restarts:

- `app-backend/trades.db` - Trade history and positions
- `app-backend/logs/` - Daily log files

To backup:

```bash
cp app-backend/trades.db trades-backup-$(date +%Y%m%d).db
tar -czf logs-backup-$(date +%Y%m%d).tar.gz app-backend/logs/
```

## Security Notes

1. **Never commit `.env` file** - Contains sensitive API keys
2. **Use IP whitelist** on Binance API settings
3. **Enable 2FA** on your Binance account
4. **Start with small amounts** when going live
5. **Monitor regularly** via Telegram and dashboard

## Getting Help

1. Check logs: `docker-compose logs -f backend`
2. Review documentation in `docs/` folder
3. Test in paper trading mode first
4. Verify API keys and permissions

## Next Steps

After successful setup:

1. ✅ Monitor paper trading for 24-48 hours
2. ✅ Review reports and understand bot behavior
3. ✅ Adjust settings in `app-backend/src/config/settings.js` if needed
4. ✅ Read `docs/ADVANCED_FEATURES.md` for optimization
5. ✅ Consider enabling OCO orders (see `docs/OCO_ORDERS.md`)

Happy Trading! 🚀
