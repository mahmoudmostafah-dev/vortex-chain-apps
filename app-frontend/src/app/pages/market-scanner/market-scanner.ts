import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { interval, Subscription } from 'rxjs';

interface CoinData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

@Component({
  selector: 'app-market-scanner',
  imports: [CommonModule],
  templateUrl: './market-scanner.html',
  styleUrl: './market-scanner.scss',
})
export class MarketScanner implements OnInit, OnDestroy {
  protected coins = signal<CoinData[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected lastUpdate = signal<Date | null>(null);
  protected autoRefresh = signal(true);

  // Computed signals for stats
  protected gainersCount = computed(() => this.coins().filter((c) => c.change24h > 0).length);
  protected losersCount = computed(() => this.coins().filter((c) => c.change24h < 0).length);

  private refreshSubscription?: Subscription;
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    await this.loadCoins();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  async loadCoins() {
    try {
      this.loading.set(true);
      this.error.set(null);

      const response = await this.http
        .get<{ success: boolean; data: CoinData[] }>(`${this.API_URL}/market/top-coins?limit=50`)
        .toPromise();

      if (response?.success) {
        this.coins.set(response.data);
        this.lastUpdate.set(new Date());
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load market data');
    } finally {
      this.loading.set(false);
    }
  }

  startAutoRefresh() {
    if (this.autoRefresh()) {
      this.refreshSubscription = interval(60000).subscribe(() => {
        this.loadCoins();
      });
    }
  }

  stopAutoRefresh() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  getChangeClass(change: number): string {
    if (change > 5) return 'very-positive';
    if (change > 0) return 'positive';
    if (change < -5) return 'very-negative';
    return 'negative';
  }

  getSignalStrength(change: number, volume: number): string {
    const absChange = Math.abs(change);
    if (absChange > 10 && volume > 50_000_000) return '🔥 STRONG';
    if (absChange > 5 && volume > 20_000_000) return '⚡ MEDIUM';
    return '📊 WEAK';
  }

  formatMoney(value: number): string {
    if (value >= 1) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(value);
    }
  }

  formatVolume(value: number): string {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else {
      return `$${(value / 1_000).toFixed(2)}K`;
    }
  }

  formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  formatTime(date: Date | null): string {
    if (!date) return 'Never';
    return date.toLocaleTimeString();
  }
}
