import { Injectable, signal } from '@angular/core';

export interface Trade {
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

export interface Position {
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

export interface DailyStats {
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_profit: number;
  avg_profit: number;
  total_fees: number;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly API_URL = '/api';

  // Signals for reactive state
  trades = signal<Trade[]>([]);
  positions = signal<Position[]>([]);
  dailyStats = signal<DailyStats[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async fetchTrades(period: 'day' | 'week' | 'month' | 'year' = 'day'): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${this.API_URL}/trades?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      this.trades.set(data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching trades:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchPositions(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${this.API_URL}/positions`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      this.positions.set(data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching positions:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchDailyStats(period: 'week' | 'month' | 'year' = 'week'): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${this.API_URL}/stats/daily?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      this.dailyStats.set(data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching stats:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async fetchLogs(date?: string): Promise<string> {
    try {
      const url = date ? `${this.API_URL}/logs?date=${date}` : `${this.API_URL}/logs`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return await response.text();
    } catch (err) {
      console.error('Error fetching logs:', err);
      throw err;
    }
  }
}
