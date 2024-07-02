import {
  Tracers,
  type Exporter as TraceExporter,
  type Trace,
} from "./sk_monitor_span.js";
import {
  Meters,
  type Metrics,
  type Exporter as MetricsExporter,
} from "./sk_monitor_metric.js";
import type { Attribute, Headers } from "./sk_monitor_common.js";
import {
  ConsoleMetricsExporter,
  ConsoleTraceExporter,
  IndexedDBMetricsExporter,
  IndexedDBTraceExporter,
  OptlMetricsHttpJSONExporter,
  OptlTraceHttpJSONExporter,
  UptraceMetricsHttpJSONExporter,
  UptraceTraceHttpJSONExporter,
  type Product,
} from "./sk_monitor_exporter.js";
export type { Exporter as TraceExporter } from "./sk_monitor_span.js";
export type { Exporter as MetricsExporter } from "./sk_monitor_metric.js";

export type Http = {
  url: string;
  headers: Headers;
  trace?: boolean;
  metrics?: boolean;
};

export type Uptrace = {
  url: string;
  product: Product;
  trace?: boolean;
  metrics?: boolean;
};

export type Config = {
  store?: {
    trace?: boolean;
    metrics?: boolean;
  };
  console?: {
    trace?: boolean;
    metrics?: boolean;
  };
  optlUrls: Http[];
  uptraceUrls: Uptrace[];
  maxQueueSize?: number;
};

type Timeout = ReturnType<typeof setInterval>;

export class Monitor {
  private tracers: Tracers[];
  private meters: Meters[];
  private timer?: Timeout;
  private maxSize: number;
  private traceSize: number;
  private metricSize: number;
  private traceExporters: TraceExporter[];
  private metricsExporters: MetricsExporter[];

  constructor(maxSize?: number) {
    this.tracers = [];
    this.meters = [];
    this.maxSize = maxSize ?? 4000;
    this.traceSize = 0;
    this.metricSize = 0;
    this.traceExporters = [];
    this.metricsExporters = [];
  }

  addTraceExporter(exporter: TraceExporter) {
    this.traceExporters.push(exporter);
  }

  addMetricsExporter(exporter: MetricsExporter) {
    this.metricsExporters.push(exporter);
  }

  createTracers(resource: Attribute[]): Tracers {
    resource.push({
      key: "service.name",
      value: { stringValue: "skmonitor.collector" },
    });
    resource.push({ key: "service.version", value: { stringValue: "0.0.1" } });
    const tracers = new Tracers(resource, this.notifyTrace.bind(this));
    this.tracers.push(tracers);
    return tracers;
  }

  createMeters(resource: Attribute[]): Meters {
    const meters = new Meters(resource, this.notifyMetrics.bind(this));
    this.meters.push(meters);
    return meters;
  }

  start(delay: number = 10000) {
    this.timer = setInterval(() => {
      this.exportTrace();
      this.exportMetrics();
    }, delay);
  }

  stop() {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private exportTrace() {
    if (this.traceSize == 0) return;
    const trace = this.trace();
    this.traceExporters.forEach((e) => e.export(trace));
    this.traceSize = 0;
  }

  private exportMetrics() {
    if (this.metricSize == 0) return;
    const metrics = this.metrics();
    this.metricsExporters.forEach((e) => e.export(metrics));
    this.metricSize = 0;
  }

  private notifyTrace() {
    this.traceSize++;
    if (this.traceSize < this.maxSize) return;
    this.exportTrace();
  }

  private notifyMetrics() {
    this.metricSize++;
    if (this.metricSize < this.maxSize) return;
    this.exportMetrics();
  }

  private trace(): Trace {
    return {
      resourceSpans: this.tracers.map((t) => t.purge()),
    };
  }

  private metrics(): Metrics {
    return {
      resourceMetrics: this.meters.map((m) => m.purge()),
    };
  }
}

export function create(config: Config): Monitor {
  const monitor = new Monitor(config.maxQueueSize);
  config.uptraceUrls.forEach((uptrace) => {
    const trace = uptrace.trace ?? true;
    const metrics = uptrace.metrics ?? true;
    if (trace) {
      monitor.addTraceExporter(
        new UptraceTraceHttpJSONExporter(new URL(uptrace.url), uptrace.product),
      );
    }
    if (metrics) {
      monitor.addMetricsExporter(
        new UptraceMetricsHttpJSONExporter(
          new URL(uptrace.url),
          uptrace.product,
        ),
      );
    }
  });
  config.optlUrls.forEach((optl) => {
    const trace = optl.trace ?? true;
    const metrics = optl.metrics ?? true;
    if (trace) {
      monitor.addTraceExporter(
        new OptlTraceHttpJSONExporter(new URL(optl.url), optl.headers),
      );
    }
    if (metrics) {
      monitor.addMetricsExporter(
        new OptlMetricsHttpJSONExporter(new URL(optl.url), optl.headers),
      );
    }
  });
  if (config.store) {
    const trace = config.store.trace ?? true;
    const metrics = config.store.metrics ?? true;
    if (trace || metrics) {
      const request = indexedDB.open("SKMonitor");
      request.onerror = (event) => {
        console.error(event);
      };
      request.onsuccess = (_) => {
        const db = request.result;
        if (trace) {
          monitor.addTraceExporter(new IndexedDBTraceExporter(db));
        }
        if (metrics) {
          monitor.addMetricsExporter(new IndexedDBMetricsExporter(db));
        }
      };
    }
  }
  if (config.console) {
    const trace = config.console.trace ?? true;
    const metrics = config.console.metrics ?? true;
    if (trace) {
      monitor.addTraceExporter(new ConsoleTraceExporter());
    }
    if (metrics) {
      monitor.addMetricsExporter(new ConsoleMetricsExporter());
    }
  }
  return monitor;
}
