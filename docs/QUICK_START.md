# ⚡ Quick Start Guide

Get the Vortex-Chain Trading Bot with Dashboard running in 5 minutes!

## 1. Prerequisites Check

```bash
# Check Docker
docker --version

# Check Docker Compose
docker-compose --version
```

If not installed, get Docker from: https://docs.docker.com/get-docker/

## 2. Clone & Configure

```bash
# Navigate to project
cd vortex-chain-apps

# Setup backend environment
cd app-backend
cp .env.example .env
```

**Edit `.env` file** - Add your API keys:

```env
BINANCE_API_KEY=your_key_here
BINANCE_SECRET_KEY=your_secret_here
TELEGRAM_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

## 3. Start Everything

```bash
# Go back to root
cd ..

# Build and start
docker-compose up -d --build
```

Wait 2-3 minutes for build to complete.

## 4. Access Dashboard

Open browser: **http://localhost:4200**

You should see:

- 📊 Dashboard page
- 📈 Reports page
- 📝 Logs page

## 5. Verify Bot is Running

```bash
# Check logs
docker-compose logs -f backend

# You should see:
# "🚀 Vortex-Chain v5.0 MODULAR Edition"
# "API Server running on port 3000"
# "📝 PAPER TRADING" (if in test mode)
```

## 6. Test the Dashboard

1. **Dashboard** - View stats (may be empty initially)
2. **Reports** - Select period (week/month/year)
3. **Logs** - View today's bot activity

## Common Commands

```bash
# View logs
docker-compose logs -f backend

# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Stop and remove
docker-compose down
```

## What's Next?

✅ Bot is running in **Paper Trading** mode (safe, no real money)
✅ Monitor for 24 hours to see how it works
✅ Check Telegram for notifications
✅ Review dashboard reports

### To Go Live:

1. Stop: `docker-compose down`
2. Edit `app-backend/.env`: Set `PAPER_TRADING=false`
3. Ensure you have USDT in Binance (min $50)
4. Start: `docker-compose up -d`
5. **Monitor closely!**

## Troubleshooting

**Dashboard shows errors?**

```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Should return: {"status":"ok","timestamp":...}
```

**No trades appearing?**

- Normal! Bot scans every minute
- Needs specific market conditions
- Check logs: `docker-compose logs -f backend`

**Port already in use?**

- Change ports in `docker-compose.yml`
- Frontend: `4200:80` → `8080:80`
- Backend: `3000:3000` → `3001:3000`

## Need Help?

1. Read `SETUP.md` for detailed guide
2. Check `docs/` folder for features
3. Review logs for errors

Happy Trading! 🚀
