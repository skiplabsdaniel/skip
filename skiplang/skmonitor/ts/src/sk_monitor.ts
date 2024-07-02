import type * as Internal from "../skiplang-std/internal.js";
import type {
  ptr,
  float,
  Environment,
  Links,
  ToWasmManager,
  Utils,
  Nullable,
  Shared,
} from "../skipwasm-std/index.js";
import {
  SpanKind,
  SpanStatusCode,
  type Span,
  type SpanStatus,
  type Event,
} from "./sk_monitor_span.js";
import { Monitor } from "./sk_monitor_monitor.js";
import type {
  Attribute,
  AttributeValue,
  ScalarValue,
} from "./sk_monitor_common.js";

export { Monitor };

interface ToWasm {
  SKIP_SKMonitor_write: (content: ptr<Internal.String>) => void;
  SKIP_SKMonitor_traceIdOpt: () => Nullable<ptr<Internal.String>>;
  SKIP_SKMonitor_monitoringOpt: () => Nullable<ptr<Internal.String>>;
  SKIP_JS_now: () => float;
}

export type Collector = (span: Span) => void;

export type Builder = (monitor: Monitor) => Collector[];

export type Config = {
  maxSize?: number;
  traceId?: string;
  worker?: Worker;
  builder?: Builder;
};

type SkIntScalar = { int: string };
type SkScalar = string | number | boolean | SkIntScalar;
type SkValue = SkScalar | SkScalar[];

interface SkAttributes {
  [attributeKey: string]: SkValue;
}

type SkTime = [string, string];
type SkService = { name: string; version: string };
type SkStatus = { status: string; message: string };
type SkEvent = { name: string; attributes: SkAttributes; time: SkTime };

type SkSpan = {
  start: SkTime;
  traceId: string;
  spanId: string;
  name: string;
  end: SkTime;
  attributes: SkAttributes;
  events: SkEvent[];
  parentId?: string;
  service?: SkService;
  status?: SkStatus;
};

function convertValue(skValue: SkValue): AttributeValue {
  const type = typeof skValue;
  if (type === "string") {
    return { stringValue: skValue as string };
  } else if (type === "number") {
    return { doubleValue: skValue as number };
  } else if (type === "boolean") {
    return { boolValue: skValue as boolean };
  } else if (Array.isArray(skValue)) {
    const values = (skValue as SkValue[]).map(
      (v) => convertValue(v) as ScalarValue,
    );
    return { arrayValue: { values } };
  }
  const intVal = skValue as SkIntScalar;
  return { intValue: intVal.int };
}

function convertAttributes(skAttributes: SkAttributes): Attribute[] {
  const keys = Object.keys(skAttributes);
  const attributes: Attribute[] = [];
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const value = convertValue(skAttributes[key]!);
    attributes.push({ key, value });
  }
  return attributes;
}

function convertEvent(skEvent: SkEvent): Event {
  return {
    name: skEvent.name,
    attributes: convertAttributes(skEvent.attributes),
    timeUnixNano: skEvent.time[0] + skEvent.time[1],
    droppedAttributesCount: 0,
  };
}

function convertStatus(skStatus: SkStatus): SpanStatus {
  switch (skStatus.status) {
    case "Ok": {
      return { code: SpanStatusCode.OK };
    }
    case "Error": {
      return { code: SpanStatusCode.ERROR, message: skStatus.message };
    }
    case "Unset":
    default: {
      return { code: SpanStatusCode.UNSET };
    }
  }
}

class SKMonitorShared implements Shared {
  getName = () => "SKMonitor";

  config?: Config;
  collectors?: Collector[];

  monitor(config: Config) {
    this.config = config;
    if (this.config.builder) {
      const monitor = new Monitor(config.maxSize);
      this.collectors = this.config.builder(monitor);
    }
  }

  traceId(): Nullable<string> {
    const traceId = this.config ? this.config.traceId : undefined;
    return traceId ?? null;
  }

  monitorMode(): Nullable<string> {
    const trace = this.config ? this.config.builder !== undefined : undefined;
    if (trace === undefined) return null;
    let strMode: string = "memory";
    if (trace) {
      strMode = "on";
    }
    return strMode;
  }

  collect(skSpan: SkSpan) {
    if (!this.collectors) return;
    const span = {
      kind: SpanKind.CLIENT,
      name: skSpan.name,
      traceId: skSpan.traceId,
      spanId: skSpan.spanId,
      parentSpanId: skSpan.parentId ?? "",
      attributes: convertAttributes(skSpan.attributes),
      events: skSpan.events.map((e) => convertEvent(e)),
      status: skSpan.status ? convertStatus(skSpan.status) : undefined,
      startTimeUnixNano: skSpan.start[0] + skSpan.start[1],
      endTimeUnixNano: skSpan.end[0] + skSpan.end[1],
    };
    this.collectors.forEach((c) => c(span));
  }
}

class LinksImpl implements Links {
  private environment: Environment;
  private skmonitor: SKMonitorShared;

  write!: (content: ptr<Internal.String>) => void;
  traceIdOpt!: () => Nullable<ptr<Internal.String>>;
  monitoringOpt!: () => Nullable<ptr<Internal.String>>;

  constructor(environment: Environment) {
    this.environment = environment;
    this.skmonitor = new SKMonitorShared();
  }

  complete = (utils: Utils, _exports: object) => {
    this.write = (skContent: ptr<Internal.String>) => {
      if (!this.skmonitor.monitorMode()) return;
      this.collect(utils.importString(skContent));
    };
    this.traceIdOpt = () => {
      const traceId = this.skmonitor.traceId();
      return traceId !== null ? utils.exportString(traceId) : null;
    };
    this.monitoringOpt = () => {
      const mode = this.skmonitor.monitorMode();
      return mode !== null ? utils.exportString(mode) : null;
    };
    this.environment.shared.set("SKMonitor", this.skmonitor);
  };

  private collect(strSkSpan: string) {
    const skSpan = JSON.parse(strSkSpan) as SkSpan;
    this.skmonitor.collect(skSpan);
  }
}

class Manager implements ToWasmManager {
  constructor(private environment: Environment) {}

  prepare = (wasm: object) => {
    const toWasm = wasm as ToWasm;
    const links = new LinksImpl(this.environment);
    toWasm.SKIP_SKMonitor_write = (content: ptr<Internal.String>) =>
      links.write(content);
    toWasm.SKIP_SKMonitor_traceIdOpt = links.traceIdOpt.bind(links);
    toWasm.SKIP_SKMonitor_monitoringOpt = links.monitoringOpt.bind(links);
    toWasm.SKIP_JS_now = () => Date.now() / 1000;
    return links;
  };
}

/* @sk init */
/**
 * Init the Monitoring Wasm code manager according given environment
 * @param env The current environnement
 * @returns The Monitoring Wasm code manager
 */
export function init(env: Environment) {
  return Promise.resolve(new Manager(env));
}
