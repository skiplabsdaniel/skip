import {
  deepEquals,
  type Attribute,
  type ScopeInfo,
} from "./sk_monitor_common.js";

export interface Exporter {
  export(metrics: Metrics): void;
}

export type HDataPoints = {
  dataPoints: HDataPoint[];
  aggregationTemporality: 2;
};

export type HDataPoint = {
  startTimeUnixNano: string;
  timeUnixNano: string;
  count: string;
  sum: number;
  min: number;
  max: number;
  attributes?: Attribute[];
};

export type CDataPoints = {
  dataPoints: CDataPoint[];
  aggregationTemporality: 2;
  isMonotonic: true;
};

export type CDataPoint = {
  startTimeUnixNano: string;
  timeUnixNano: string;
  asInt: string;
  attributes?: Attribute[];
};

export type HMetric = {
  name: string;
  unit: string;
  description?: string;
  histogram: HDataPoints;
};

export type CMetric = {
  name: string;
  unit: string;
  description?: string;
  sum: CDataPoints;
};

export type Metric = HMetric | CMetric;

export type ScopeMetric = {
  scope: ScopeInfo;
  metrics: Metric[];
};

export type ResourceMetric = {
  resource: { attributes: Attribute[] };
  scopeMetrics: ScopeMetric[];
};

export type Metrics = {
  resourceMetrics: ResourceMetric[];
};

class HValue {
  start = new Date();
  count: number = 0;
  sum: number = 0;
  min?: number = 0;
  max?: number = 0;
  time?: Date;
  attributes?: Attribute[];

  record(value: number, attributes?: Attribute[]) {
    this.count++;
    this.sum += value;
    this.min = this.min ? Math.min(this.min, value) : value;
    this.max = this.max ? Math.max(this.max, value) : value;
    this.attributes = attributes;
    this.time = this.time ? new Date() : this.start;
  }
}

interface MetricCollector {
  purge(): Metric;
  size(): number;
}

export interface Histogram extends MetricCollector {
  record(value: number, attributes?: Attribute[]): void;
}

class HistogramImpl implements Histogram {
  name: string;
  unit: string;
  description?: string;
  values: HValue[] = [];
  current?: HValue;
  attributes?: Attribute[];
  private notifier: () => void;

  constructor(
    name: string,
    unit: string,
    description?: string,
    notifier: () => void = () => {
      return;
    },
  ) {
    this.name = name;
    this.unit = unit;
    this.description = description;
    this.notifier = notifier;
  }

  record(value: number, attributes?: Attribute[]) {
    if (
      !this.attributes ||
      !this.current ||
      !deepEquals(this.attributes, attributes)
    ) {
      if (this.current) {
        this.values.push(this.current);
      }
      this.current = new HValue();
      this.attributes = attributes;
      this.notifier();
    }
    this.current.record(value);
  }

  purge(): HMetric {
    if (this.current) {
      this.current.time = new Date();
      this.values.push(this.current);
    }
    const dataPoints: HDataPoint[] = [];
    this.values.forEach((v) => {
      if (v.min !== undefined && v.max !== undefined) {
        dataPoints.push({
          startTimeUnixNano: v.start.getTime().toString() + "000",
          timeUnixNano: v.time
            ? v.time.getTime().toString() + "000"
            : v.start.getTime().toString() + "000",

          count: Math.trunc(v.count).toString(),
          sum: v.sum,
          min: v.min,
          max: v.max,
          attributes: v.attributes,
        });
      }
    });
    this.current = undefined;
    this.attributes = undefined;
    this.values = [];
    return {
      name: this.name,
      unit: this.unit,
      description: this.description,
      histogram: {
        dataPoints,
        aggregationTemporality: 2,
      },
    };
  }

  size() {
    return this.values.length + (this.current ? 1 : 0);
  }
}

class CValue {
  start = new Date();
  sum: number = 0;
  time?: Date;
  attributes?: Attribute[];

  add(value: number, attributes?: Attribute[]) {
    this.sum += value;
    this.attributes = attributes;
    this.time = this.time ? new Date() : this.start;
  }
}

export interface Counter extends MetricCollector {
  add(value: number, attributes?: Attribute[]): void;
  purge(): CMetric;
}

class CounterImpl implements Counter {
  name: string;
  unit: string;
  description?: string;
  values: CValue[] = [];
  current?: CValue;
  attributes?: Attribute[];
  private notifier: () => void;

  constructor(
    name: string,
    unit: string,
    description?: string,
    notifier: () => void = () => {
      return;
    },
  ) {
    this.name = name;
    this.unit = unit;
    this.description = description;
    this.notifier = notifier;
  }

  add(value: number, attributes?: Attribute[]) {
    if (
      !this.attributes ||
      !this.current ||
      !deepEquals(this.attributes, attributes)
    ) {
      if (this.current) {
        this.values.push(this.current);
      }
      this.current = new CValue();
      this.attributes = attributes;
      this.notifier();
    }
    this.current.add(value);
  }

  purge(): CMetric {
    if (this.current) {
      this.current.time = new Date();
      this.values.push(this.current);
    }
    const dataPoints = this.values.map((v) => {
      return {
        startTimeUnixNano: v.start.getTime().toString() + "000",
        timeUnixNano: v.time
          ? v.time.getTime().toString() + "000"
          : v.start.getTime().toString() + "000",
        asInt: Math.trunc(v.sum).toString(),
        attributes: v.attributes,
      };
    });
    this.current = undefined;
    this.attributes = undefined;
    this.values = [];
    return {
      name: this.name,
      unit: this.unit,
      description: this.description,
      sum: {
        dataPoints,
        aggregationTemporality: 2,
        isMonotonic: true,
      },
    };
  }

  size() {
    return this.values.length + (this.current ? 1 : 0);
  }
}

export class Meter {
  private scope: ScopeInfo;
  private collectors: MetricCollector[];
  private notifier: () => void;

  constructor(scope: ScopeInfo, notifier: () => void) {
    this.scope = scope;
    this.collectors = [];
    this.notifier = notifier;
  }

  createCounter(name: string, unit: string, description?: string) {
    const counter = new CounterImpl(name, unit, description, this.notifier);
    this.collectors.push(counter);
    return counter;
  }

  createHistogram(name: string, unit: string, description?: string) {
    const histogram = new HistogramImpl(name, unit, description, this.notifier);
    this.collectors.push(histogram);
    return histogram;
  }

  purge(): ScopeMetric {
    return {
      scope: this.scope,
      metrics: this.collectors.map((c) => c.purge()),
    };
  }

  size() {
    return this.collectors.reduce((p: number, c) => p + c.size(), 0);
  }
}

export class Meters {
  resource: Attribute[];
  meters: Meter[];
  private notifier: () => void;

  constructor(resource: Attribute[], notifier: () => void) {
    this.resource = resource;
    this.meters = [];
    this.notifier = notifier;
  }

  create(scope: ScopeInfo) {
    const meter = new Meter(scope, this.notifier);
    this.meters.push(meter);
    return meter;
  }

  purge(): ResourceMetric {
    return {
      resource: { attributes: this.resource },
      scopeMetrics: this.meters.map((m) => m.purge()),
    };
  }

  size() {
    return this.meters.reduce((p: number, c) => p + c.size(), 0);
  }
}
