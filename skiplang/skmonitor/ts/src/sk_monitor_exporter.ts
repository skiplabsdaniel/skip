import type { Metrics } from "./sk_monitor_metric.js";
import type { TraceExporter, MetricsExporter } from "./sk_monitor_monitor.js";
import type { Trace } from "./sk_monitor_span.js";
import type { Headers } from "./sk_monitor_common.js";

abstract class HttpJSONExporter {
  protected abstract url(): URL;

  protected headers(): Headers {
    return {};
  }

  protected post(value: object) {
    const request = new XMLHttpRequest();
    const failure = this.failure.bind(this);
    request.open("POST", this.url(), true);
    request.onload = function () {
      if (this.status < 200 && this.status >= 400) {
        failure(value, this.status);
      }
    };

    request.onerror = function (err: ProgressEvent) {
      // There was a connection error of some sort
      // TODO retry
      failure(value, 0, err);
    };
    request.setRequestHeader("Content-Type", "application/json");
    const headers = this.headers();
    const keys = Object.keys(this.headers());
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const value = headers[key]!;
      request.setRequestHeader(key, value);
    }
    request.send(JSON.stringify(value));
  }

  protected failure(
    _value: object,
    code: number,
    err?: ProgressEvent<EventTarget>,
  ): void {
    if (err) console.error(err);
    else console.error(`Monitor trace export failed with code: ${code}`);
  }
}

export type Product = {
  id: number;
  token: string;
};

abstract class OptlHttpJSONExporterBase extends HttpJSONExporter {
  private _headers: Headers;
  private _url: URL;

  constructor(url: URL, headers: Headers) {
    super();
    this._url = url;
    this._headers = headers;
  }

  protected abstract path(): string;

  protected url(): URL {
    return new URL(this.path(), this._url);
  }

  protected override headers(): Headers {
    return this._headers;
  }
}

const uptrace_dsn = (url: URL, product: Product) => {
  const uptrace_dsn = new URL(url, product.id.toString());
  uptrace_dsn.username = product.token;
  return uptrace_dsn;
};

abstract class UptraceHttpJSONExporter extends OptlHttpJSONExporterBase {
  constructor(url: URL, product: Product) {
    super(url, {
      "uptrace-dsn": uptrace_dsn(url, product).toString(),
    });
  }
}

export class UptraceTraceHttpJSONExporter
  extends UptraceHttpJSONExporter
  implements TraceExporter
{
  private _path: string;

  constructor(url: URL, product: Product, version: number = 2) {
    super(url, product);
    this._path = `/api/v${version}/spans`;
  }

  export(trace: Trace): void {
    this.post(trace);
  }

  protected path() {
    return this._path;
  }
}

export class OptlTraceHttpJSONExporter
  extends OptlHttpJSONExporterBase
  implements TraceExporter
{
  private _path: string;

  constructor(url: URL, headers: Headers = {}, version: number = 2) {
    super(url, headers);
    this._path = `/api/v${version}/spans`;
  }

  export(trace: Trace): void {
    this.post(trace);
  }

  protected path() {
    return this._path;
  }
}

export class UptraceMetricsHttpJSONExporter
  extends UptraceHttpJSONExporter
  implements MetricsExporter
{
  private _path: string;

  constructor(url: URL, product: Product, version: number = 2) {
    super(url, product);
    this._path = `/api/v${version}/metrics`;
  }

  export(metrics: Metrics): void {
    this.post(metrics);
  }

  protected path() {
    return this._path;
  }
}

export class OptlMetricsHttpJSONExporter
  extends OptlHttpJSONExporterBase
  implements MetricsExporter
{
  private _path: string;

  constructor(url: URL, headers: Headers = {}, version: number = 2) {
    super(url, headers);
    this._path = `/api/v${version}/metrics`;
  }

  export(metrics: Metrics): void {
    this.post(metrics);
  }

  protected path() {
    return this._path;
  }
}

export class ConsoleTraceExporter implements TraceExporter {
  export(trace: Trace): void {
    console.log(trace);
  }
}

export class ConsoleMetricsExporter implements MetricsExporter {
  export(metrics: Metrics): void {
    console.log(metrics);
  }
}

abstract class IndexedDBExporter {
  protected db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  protected abstract name(): string;

  protected insert(value: object) {
    const name = this.name();
    const transaction = this.db.transaction([name], "readwrite");
    // Handler for any unexpected error
    transaction.onerror = () => {
      console.error(transaction.error);
    };
    const objectStore = transaction.objectStore(name);
    objectStore.add(value);
  }
}

export class IndexedDBTraceExporter
  extends IndexedDBExporter
  implements TraceExporter
{
  export(trace: Trace): void {
    this.insert(trace);
  }

  protected name() {
    return "trace";
  }
}

export class IndexedDBMetricsExporter
  extends IndexedDBExporter
  implements MetricsExporter
{
  export(metrics: Metrics): void {
    this.insert(metrics);
  }

  protected name() {
    return "metrics";
  }
}
