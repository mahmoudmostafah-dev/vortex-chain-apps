import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-logs',
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.html',
  styleUrl: './logs.scss',
})
export class Logs implements OnInit {
  protected logs = signal<string>('');
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected selectedDate = signal<string>(this.getTodayDate());
  protected filterLevel = signal<string>('ALL');
  protected searchTerm = signal<string>('');

  protected readonly logLevels = ['ALL', 'INFO', 'WARNING', 'ERROR', 'TRADE', 'SUCCESS'];

  constructor(private api: ApiService) {}

  async ngOnInit() {
    await this.loadLogs();
  }

  async loadLogs(date?: string) {
    this.loading.set(true);
    this.error.set(null);

    try {
      const logContent = await this.api.fetchLogs(date || this.selectedDate());
      this.logs.set(logContent);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      this.loading.set(false);
    }
  }

  async onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(input.value);
    await this.loadLogs(input.value);
  }

  onFilterChange(level: string) {
    this.filterLevel.set(level);
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  getFilteredLogs(): string[] {
    const lines = this.logs().split('\n');
    const level = this.filterLevel();
    const search = this.searchTerm().toLowerCase();

    return lines.filter((line) => {
      if (!line.trim()) return false;

      const matchesLevel = level === 'ALL' || line.includes(`[${level}]`);
      const matchesSearch = !search || line.toLowerCase().includes(search);

      return matchesLevel && matchesSearch;
    });
  }

  getLogClass(line: string): string {
    if (line.includes('[ERROR]')) return 'log-error';
    if (line.includes('[WARNING]')) return 'log-warning';
    if (line.includes('[SUCCESS]') || line.includes('[TRADE]')) return 'log-success';
    if (line.includes('[INFO]')) return 'log-info';
    return '';
  }

  downloadLogs() {
    const content = this.logs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vortex-logs-${this.selectedDate()}.log`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
