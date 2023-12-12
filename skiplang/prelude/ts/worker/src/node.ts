import type { Environment } from "../skipwasm-std/index.js";
import type { Wrk, WrkEnvironment } from "./worker.js";

import * as path from "path";
import { Worker as NodeWorker } from "worker_threads";

class WrkImpl implements Wrk {
  constructor(private readonly worker: NodeWorker) {}

  static fromPath(url: URL, options: WorkerOptions | undefined): Wrk {
    const filename = "./" + path.relative(process.cwd(), url.pathname);
    return new this(new NodeWorker(filename, options));
  }

  postMessage = (message: any) => {
    this.worker.postMessage(message);
  };

  onMessage = (listener: (value: any) => void) => {
    this.worker.on("message", listener);
  };

  shutdown = () => this.worker.postMessage("#shutdown");

  terminate = () => this.worker.terminate();
}

export function complete(env: Environment) {
  const wrkenv = env as WrkEnvironment;
  wrkenv.createWorker = (url: URL, options?: WorkerOptions) =>
    WrkImpl.fromPath(url, options);
  wrkenv.createWorkerWrapper = (_worker: Worker) => {
    throw new Error("Not implemented");
  };
}
