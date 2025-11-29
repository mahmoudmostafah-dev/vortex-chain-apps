import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  protected readonly apiService = this.api;
  protected selectedPeriod = signal<'day' | 'week' | 'month' | 'year'>('day');

  // Computed statistics
  protected stats = computed(() => {
    const trades = this.api.trades();
    const positions = this.api.positions();

    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.profit_percent > 0).length;
    const losses = trades.filter((t) => t.profit_percent < 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit_usdt || 0), 0);
    const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
    const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const openPositions = positions.length;

    return {
      totalTrades,
      wins,
      losses,
      winRate,
      totalProfit,
      totalFees,
      avgProfit,
      openPositions,
    };
  });

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    await Promise.all([this.api.fetchTrades(this.selectedPeriod()), this.api.fetchPositions()]);
  }

  async changePeriod(period: 'day' | 'week' | 'month' | 'year') {
    this.selectedPeriod.set(period);
    await this.api.fetchTrades(period);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
}
