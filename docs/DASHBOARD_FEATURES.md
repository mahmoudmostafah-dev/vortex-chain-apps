# 📊 Dashboard Features Documentation

## Overview

The Vortex-Chain Dashboard is a comprehensive Angular-based web interface for monitoring and analyzing your trading bot's performance in real-time.

## Architecture

### Frontend (Angular 20.3)

- **Framework**: Angular with standalone components
- **State Management**: Signal-based reactive state
- **Styling**: SCSS with responsive design
- **Build**: esbuild via Angular CLI
- **Deployment**: Nginx in Docker container

### Backend API (Express.js)

- **Server**: Express.js REST API
- **Database**: SQLite3 with async operations
- **CORS**: Enabled for cross-origin requests
- **Port**: 3000 (configurable via API_PORT)

## Pages

### 1. Dashboard (`/dashboard`)

**Purpose**: Real-time overview of trading activity

**Features**:

- **Statistics Cards**:

  - Total Trades
  - Win Rate (with W/L breakdown)
  - Total P/L
  - Average Profit
  - Total Fees
  - Open Positions count

- **Open Positions Table**:

  - Symbol
  - Entry Price
  - Amount
  - Stop Loss
  - Take Profit
  - Timestamp

- **Recent Trades Table**:

  - Symbol
  - Side (BUY/SELL badge)
  - Entry/Exit prices
  - Profit % and $
  - Reason
  - Timestamp

- **Period Selector**: Day, Week, Month, Year

**Data Updates**: Manual refresh (reload page or change period)

### 2. Reports (`/reports`)

**Purpose**: Detailed performance analytics

**Features**:

- **Summary Cards**:

  - Total Trades
  - Average Win Rate
  - Total Profit
  - Total Fees
  - Net Profit
  - Best Day (highlighted green)
  - Worst Day (highlighted red)

- **Daily Breakdown Table**:

  - Date
  - Trades count
  - Wins/Losses
  - Win Rate %
  - Total P/L
  - Average P/L
  - Fees
  - **Total Row** with aggregated stats

- **Period Selector**: Week, Month, Year

**Use Cases**:

- Identify best/worst trading days
- Track win rate trends
- Analyze fee impact
- Compare daily performance

### 3. Logs (`/logs`)

**Purpose**: View and analyze bot activity logs

**Features**:

- **Date Picker**: Select any date to view logs
- **Download Button**: Export logs as .log file
- **Filter Buttons**: ALL, INFO, WARNING, ERROR, TRADE, SUCCESS
- **Search Box**: Real-time search with clear button
- **Log Viewer**:

  - Line numbers
  - Syntax highlighting by log level
  - Color-coded entries (errors=red, warnings=yellow, success=green)
  - Scrollable container
  - Monospace font for readability

- **Footer Stats**: Total lines and selected date

**Use Cases**:

- Debug trading issues
- Monitor bot activity
- Track specific symbols
- Analyze error patterns

## API Endpoints

### Health Check

```
GET /api/health
Response: { status: 'ok', timestamp: 1234567890 }
```

### Get Trades

```
GET /api/trades?period=day|week|month|year
Response: Array of trade objects
```

### Get Positions

```
GET /api/positions
Response: Array of open position objects
```

### Get Daily Statistics

```
GET /api/stats/daily?period=week|month|year
Response: Array of daily stat objects
```

### Get Logs

```
GET /api/logs?date=2024-01-01
Response: Plain text log content
```

### Get Available Log Dates

```
GET /api/logs/dates
Response: Array of date strings
```

### Get Summary Statistics

```
GET /api/stats/summary
Response: { all_time: {...}, today: {...} }
```

## Data Models

### Trade

```typescript
{
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number;
  amount: number;
  profit_percent: number;
  profit_usdt: number;
  fees: number;
  reason: string;
  timestamp: number;
}
```

### Position

```typescript
{
  symbol: string;
  entry_price: number;
  amount: number;
  highest_price: number;
  stop_loss: number;
  take_profit: number;
  atr_stop: number;
  oco_order_id: string;
  timestamp: number;
}
```

### DailyStats

```typescript
{
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_profit: number;
  avg_profit: number;
  total_fees: number;
}
```

## Responsive Design

### Desktop (>768px)

- Full sidebar with labels
- Multi-column stat grids
- Full-width tables
- Optimal spacing

### Mobile (<768px)

- Collapsed sidebar (icons only)
- Single/dual column grids
- Horizontal scroll tables
- Compact spacing

## Color Scheme

### Primary Colors

- **Background**: #f3f4f6 (light gray)
- **Sidebar**: #1e293b → #0f172a (dark gradient)
- **Accent**: #4f46e5 (indigo)
- **Cards**: #ffffff (white)

### Status Colors

- **Positive**: #10b981 (green)
- **Negative**: #ef4444 (red)
- **Warning**: #fbbf24 (yellow)
- **Info**: #60a5fa (blue)

### Text Colors

- **Primary**: #1a1a1a (near black)
- **Secondary**: #6b7280 (gray)
- **Muted**: #94a3b8 (light gray)

## Performance Optimizations

1. **Signal-based State**: Reactive updates without zone.js
2. **Lazy Loading**: Routes loaded on demand
3. **Computed Values**: Cached calculations
4. **Nginx Caching**: Static assets cached for 1 year
5. **Gzip Compression**: Reduced transfer size

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Features

1. **CORS**: Configured for backend API only
2. **No Credentials in Frontend**: All sensitive data in backend
3. **API Proxy**: Nginx proxies API requests
4. **No Direct Database Access**: All queries through API

## Future Enhancements

Potential features for future versions:

- [ ] Real-time WebSocket updates
- [ ] Interactive charts (Chart.js/D3.js)
- [ ] Trade execution from dashboard
- [ ] Bot configuration UI
- [ ] Alert notifications
- [ ] Export reports to PDF/CSV
- [ ] Dark mode toggle
- [ ] Multi-language support
- [ ] Performance comparison charts
- [ ] Strategy backtesting UI

## Troubleshooting

### Dashboard not loading

1. Check backend is running: `docker-compose ps`
2. Verify API health: `curl http://localhost:3000/api/health`
3. Check browser console (F12) for errors

### Data not appearing

1. Verify bot has executed trades
2. Check database: `sqlite3 app-backend/trades.db "SELECT COUNT(*) FROM trades;"`
3. Review API response in Network tab (F12)

### Logs not showing

1. Verify log files exist: `ls app-backend/logs/`
2. Check date format (YYYY-MM-DD)
3. Ensure backend has write permissions

## Development

### Run Frontend Locally

```bash
cd app-frontend
npm install
ng serve
# Access at http://localhost:4200
```

### Run Backend Locally

```bash
cd app-backend
npm install
npm start
# API at http://localhost:3000
```

### Build for Production

```bash
# Frontend
cd app-frontend
npm run build

# Backend (no build needed, Node.js)
cd app-backend
npm install --omit=dev
```

## Contributing

When adding new features:

1. Follow Angular standalone component pattern
2. Use signals for reactive state
3. Add TypeScript interfaces for data models
4. Maintain responsive design
5. Update this documentation
6. Test on mobile devices

## License

ISC - Same as main project
