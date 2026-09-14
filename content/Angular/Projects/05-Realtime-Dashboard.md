# Project 5 — Real-Time Dashboard

**Level:** Advanced
**Time estimate:** 120 – 150 minutes
**Phase prerequisite:** Phase 9 – Signals & State, Phase 10 – Advanced Components

---

## Overview

You will build a live-updating analytics dashboard where every metric tile is driven entirely by the Signals API: a simulated data feed pushes new readings on an interval, `computed()` signals derive rolling averages and trend direction, and an `effect()` logs/reacts to threshold breaches. Widget components use content projection (`<ng-content>`) so each tile can host arbitrary custom markup, and a `ViewChild` reference is used to imperatively trigger a chart component to redraw — going deep on the Signals API and advanced component composition.

---

## Prerequisites

- Project 4 completed or equivalent comfort with Signals-based services
- Phase 9 lessons completed (`signal`, `computed`, `effect`, `toSignal`)
- Phase 10 lessons completed (content projection, `ViewChild`/`ContentChild`, lifecycle hooks)

---

## Project Structure

```
realtime-dashboard/
└── src/app/
    ├── app.component.ts
    ├── models/
    │   └── metric.model.ts
    ├── services/
    │   └── metrics-feed.service.ts
    └── components/
        ├── dashboard-widget/
        │   └── dashboard-widget.component.ts
        ├── metric-tile/
        │   └── metric-tile.component.ts
        └── trend-chart/
            └── trend-chart.component.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the app

```bash
ng new realtime-dashboard --standalone --style=css --routing=false
cd realtime-dashboard
```

### Step 2 — Model: `src/app/models/metric.model.ts`

```typescript
export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: string;
  history: number[]; // last N readings, oldest first
}
```

### Step 3 — `MetricsFeedService`: `src/app/services/metrics-feed.service.ts`

This service simulates a live backend feed by pushing a new random reading every second into a Signal-held map of metrics, and exposes `computed()` derivations (rolling average, trend direction) for the UI to consume.

```typescript
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Metric } from '../models/metric.model';

const HISTORY_LENGTH = 20;

function nextReading(current: number): number {
  const delta = (Math.random() - 0.5) * 10;
  return Math.max(0, Math.round((current + delta) * 100) / 100);
}

@Injectable({ providedIn: 'root' })
export class MetricsFeedService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _metrics = signal<Record<string, Metric>>({
    cpu: { key: 'cpu', label: 'CPU Usage', value: 42, unit: '%', history: [] },
    latency: { key: 'latency', label: 'API Latency', value: 120, unit: 'ms', history: [] },
    users: { key: 'users', label: 'Active Users', value: 350, unit: '', history: [] },
  });

  readonly metrics = this._metrics.asReadonly();

  readonly averages = computed<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    for (const metric of Object.values(this._metrics())) {
      const hist = metric.history;
      result[metric.key] = hist.length
        ? Math.round((hist.reduce((a, b) => a + b, 0) / hist.length) * 100) / 100
        : metric.value;
    }
    return result;
  });

  constructor() {
    const intervalId = setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  private tick(): void {
    this._metrics.update(current => {
      const updated: Record<string, Metric> = {};
      for (const [key, metric] of Object.entries(current)) {
        const value = nextReading(metric.value);
        const history = [...metric.history, value].slice(-HISTORY_LENGTH);
        updated[key] = { ...metric, value, history };
      }
      return updated;
    });
  }
}
```

### Step 4 — `TrendChartComponent` (a minimal inline SVG sparkline, using `ViewChild`): `src/app/components/trend-chart/trend-chart.component.ts`

```typescript
import { Component, ElementRef, Input, ViewChild, effect, input } from '@angular/core';

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  template: `<svg #svg width="120" height="36" viewBox="0 0 120 36"></svg>`,
})
export class TrendChartComponent {
  readonly history = input.required<number[]>();
  @ViewChild('svg', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;

  constructor() {
    // Redraw the sparkline path whenever the history signal input changes.
    effect(() => this.redraw(this.history()));
  }

  /** Imperatively rebuilds the SVG polyline from the latest history values. */
  redraw(values: number[]): void {
    if (!values.length) return;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1 || 1)) * 120;
        const y = 36 - ((v - min) / range) * 36;
        return `${x},${y}`;
      })
      .join(' ');

    const svg = this.svgRef.nativeElement;
    svg.innerHTML = `<polyline points="${points}" fill="none" stroke="#4f8cff" stroke-width="2" />`;
  }
}
```

### Step 5 — `DashboardWidgetComponent` (content-projection shell): `src/app/components/dashboard-widget/dashboard-widget.component.ts`

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-widget',
  standalone: true,
  template: `
    <section class="widget">
      <header>
        <h3>{{ title() }}</h3>
      </header>
      <div class="widget__body">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    .widget { border: 1px solid #e2e5eb; border-radius: 10px; padding: 1rem; min-width: 220px; }
    header h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: #555; }
  `],
})
export class DashboardWidgetComponent {
  readonly title = input.required<string>();
}
```

### Step 6 — `MetricTileComponent`: `src/app/components/metric-tile/metric-tile.component.ts`

```typescript
import { Component, computed, input } from '@angular/core';
import { DashboardWidgetComponent } from '../dashboard-widget/dashboard-widget.component';
import { TrendChartComponent } from '../trend-chart/trend-chart.component';
import { Metric } from '../../models/metric.model';

@Component({
  selector: 'app-metric-tile',
  standalone: true,
  imports: [DashboardWidgetComponent, TrendChartComponent],
  template: `
    <app-dashboard-widget [title]="metric().label">
      <div class="value" [class.alert]="isAlert()">
        {{ metric().value }}{{ metric().unit }}
      </div>
      <p class="avg">avg: {{ average() }}{{ metric().unit }}</p>
      <app-trend-chart [history]="metric().history" />
    </app-dashboard-widget>
  `,
  styles: [`
    .value { font-size: 1.8rem; font-weight: 600; }
    .value.alert { color: #e63946; }
    .avg { color: #888; font-size: 0.8rem; margin: 0.2rem 0 0.5rem; }
  `],
})
export class MetricTileComponent {
  readonly metric = input.required<Metric>();
  readonly average = input.required<number>();
  readonly alertThreshold = input<number>(Infinity);

  readonly isAlert = computed(() => this.metric().value > this.alertThreshold());
}
```

### Step 7 — Wire up `AppComponent` with an `effect()` for alerting: `src/app/app.component.ts`

```typescript
import { Component, effect, inject } from '@angular/core';
import { MetricTileComponent } from './components/metric-tile/metric-tile.component';
import { MetricsFeedService } from './services/metrics-feed.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MetricTileComponent],
  template: `
    <h1>Live Ops Dashboard</h1>
    <div class="grid">
      @for (metric of feed.metrics() | keyvalue; track metric.key) {
        <app-metric-tile
          [metric]="metric.value"
          [average]="feed.averages()[metric.key]"
          [alertThreshold]="metric.key === 'latency' ? 200 : Infinity" />
      }
    </div>
  `,
  styles: [`
    .grid { display: flex; flex-wrap: wrap; gap: 1rem; }
  `],
})
export class AppComponent {
  readonly feed = inject(MetricsFeedService);
  readonly Infinity = Infinity;

  constructor() {
    // Side-effect: log to the console whenever latency crosses the alert threshold.
    effect(() => {
      const latency = this.feed.metrics()['latency'];
      if (latency && latency.value > 200) {
        console.warn(`High latency detected: ${latency.value}ms`);
      }
    });
  }
}
```

> Note: `keyvalue` requires importing `KeyValuePipe` from `@angular/common` into `AppComponent`'s `imports` array.

### Step 8 — Run it

```bash
ng serve -o
```

---

## How to Verify It Works

| Check | How | Expected result |
|-------|-----|-----------------|
| Live updates | Watch the dashboard for 5-10 seconds | All three tile values change every second without a manual refresh |
| Rolling average | Compare "avg" line to the raw value over time | Average changes more smoothly than the raw value |
| Sparkline redraws | Watch the small chart under each tile | Line shape updates each tick, reflecting the last 20 readings |
| Threshold alert | Wait until latency exceeds 200ms (or lower the threshold temporarily) | Latency tile's value turns red; console shows a `High latency detected` warning |
| Content projection | Inspect `DashboardWidgetComponent`'s rendered DOM | Widget header/body wrapper markup comes from the shell; the value/avg/chart content comes from the parent via `<ng-content>` |
| Cleanup | Navigate away or destroy the component tree (e.g. in a unit test) | `setInterval` is cleared via `DestroyRef.onDestroy` — no console errors about updates after destroy |

---

## Stretch Goals

1. **WebSocket-backed feed** — replace the `setInterval` simulation with a real or mock WebSocket connection wrapped in `toSignal()`.
2. **Configurable thresholds** — add a settings panel where the user can adjust each metric's alert threshold at runtime via an input bound to a signal.
3. **Multiple chart types** — extend `TrendChartComponent` to accept a `type` input (`'line' | 'bar'`) and render accordingly.
4. **Pause/resume** — add a button that pauses the feed's `effect()`-driven updates without destroying component state.
5. **Export snapshot** — add a "Export CSV" button that serializes the current `metrics()` signal value to a downloadable file.
