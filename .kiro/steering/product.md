# Product Overview

Vortex-Chain is an automated cryptocurrency trading bot for Binance spot trading. The bot uses technical analysis indicators (SMA, RSI, MACD, ATR) to identify trading opportunities and execute trades automatically with risk management controls.

## Core Features

- Automated scanning of high-volume USDT trading pairs
- Technical analysis-based signal generation (Golden Cross, MACD crossovers, volume surges)
- Risk-managed position sizing (2% risk per trade, max 5 concurrent positions)
- Dynamic stop-loss and take-profit management
- Limit orders to minimize slippage
- Real-time price updates via WebSocket with REST API fallback
- Telegram notifications for all trading activities
- SQLite database for trade history and position recovery
- Daily performance reports and statistics

## Risk Management

- Stop Loss: 2.5% per trade
- Take Profit: 7% per trade
- Trailing Stop: 3.5% from peak
- Daily Loss Limit: -5% (auto-stop)
- Minimum Position: $15 USD
- Risk/Reward Ratio: 1:2.8

## Target Users

Cryptocurrency traders looking for automated trading with conservative risk management on Binance spot markets.
