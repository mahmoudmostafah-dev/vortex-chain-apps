import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reports',
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  protected selectedPeriod = signal<'week' | 'month' | 'year'>('week');

  constructor(protected readonly api: ApiService) {}

  // Computed chart data
  protected chartData = computed(() => {
    const stats = this.api.dailyStats();
    return {
      labels: stats.map((s) => s.date),
      profits: stats.map((s) => s.total_profit),
      trades: stats.map((s) => s.total_trades),
      winRates: stats.map((s) => s.win_rate),
    };
  });

  // Computed summary
  protected summary = computed(() => {
    const stats = this.api.dailyStats();

    const totalTrades = stats.reduce((sum, s) => sum + s.total_trades, 0);
    const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = stats.reduce((sum, s) => sum + s.losses, 0);
    const totalProfit = stats.reduce((sum, s) => sum + s.total_profit, 0);
    const totalFees = stats.reduce((sum, s) => sum + s.total_fees, 0);
    const avgWinRate =
      stats.length > 0 ? stats.reduce((sum, s) => sum + s.win_rate, 0) / stats.length : 0;

    const bestDay = stats.reduce((best, s) => (s.total_profit > best.total_profit ? s : best), {
      total_profit: -Infinity,
      date: '',
    });

    const worstDay = stats.reduce((worst, s) => (s.total_profit < worst.total_profit ? s : worst), {
      total_profit: Infinity,
      date: '',
    });

    return {
      totalTrades,
      totalWins,
      totalLosses,
      totalProfit,
      totalFees,
      avgWinRate,
      bestDay: bestDay.total_profit !== -Infinity ? bestDay : null,
      worstDay: worstDay.total_profit !== Infinity ? worstDay : null,
      netProfit: totalProfit - totalFees,
    };
  });

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    await this.api.fetchDailyStats(this.selectedPeriod());
  }

  async changePeriod(period: 'week' | 'month' | 'year') {
    this.selectedPeriod.set(period);
    await this.api.fetchDailyStats(period);
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
    return `${value.toFixed(1)}%`;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }
}
