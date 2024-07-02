import type { ScopeInfo, Attribute } from "./sk_monitor_common.js";

export interface Exporter {
  export(trace: Trace): void;
}

export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4,
}

export type SpanStatus = {
  code: SpanStatusCode;
  message?: string;
};

export enum SpanStatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

export type Link = {
  traceId: string;
  spanId: string;
  attributes: Attribute[];
};

export type Event = {
  name: string;
  attributes: Attribute[];
  timeUnixNano: string;
  droppedAttributesCount: number;
};

export type Span = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: Attribute[];
  events?: Event[];
  links?: Link[];
  status?: SpanStatus;
  kind: SpanKind;
  droppedAttributesCount?: number;
  droppedEventCount?: number;
  droppedLinkCount?: number;
};

export type ScopeSpan = {
  scope: ScopeInfo;
  spans: Span[];
};

export type ResourceSpan = {
  resource: { attributes: Attribute[] };
  scopeSpans: ScopeSpan[];
};

export type Trace = {
  resourceSpans: ResourceSpan[];
};

export class Tracer {
  private scope: ScopeInfo;
  private spans: Span[];
  private notifier: () => void;

  constructor(scope: ScopeInfo, notifier: () => void) {
    this.scope = scope;
    this.spans = [];
    this.notifier = notifier;
  }

  add(span: Span) {
    this.spans.push(span);
    this.notifier();
  }

  purge(): ScopeSpan {
    return {
      scope: this.scope,
      spans: this.spans,
    };
  }

  size() {
    return this.spans.length;
  }
}

export class Tracers {
  private resource: Attribute[];
  private tracers: Tracer[];
  private notifier: () => void;

  constructor(resource: Attribute[], notifier: () => void) {
    this.resource = resource;
    this.tracers = [];
    this.notifier = notifier;
  }

  create(scope?: ScopeInfo) {
    const tracer = new Tracer(
      scope ?? {
        name: "io.skiplabs.skmonitor",
        version: "0.0.1",
        attributes: [],
      },
      this.notifier,
    );
    this.tracers.push(tracer);
    return tracer;
  }

  purge(): ResourceSpan {
    return {
      resource: { attributes: this.resource },
      scopeSpans: this.tracers.map((t) => t.purge()),
    };
  }

  size() {
    return this.tracers.reduce((p: number, c) => p + c.size(), 0);
  }
}
