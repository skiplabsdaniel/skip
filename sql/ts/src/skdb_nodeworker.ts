import {
  onWorkerMessage,
  type Creator,
  imhere,
} from "../skipwasm-worker/worker.js";
import { parentPort } from "worker_threads";
import type { SKDB } from "./skdb_types.js";
import { createSkdb } from "./node.js";

class DbCreator implements Creator<SKDB> {
  getName() {
    return "create";
  }

  getType() {
    return "Database";
  }

  create(dbName: string, disableWarnings: boolean) {
    return createSkdb({
      dbName,
      disableWarnings,
      asWorker: false,
    });
  }
}

const post = (message: any) => {
  parentPort?.postMessage(message);
};

const close = () => {
  parentPort?.close();
};

const onMessage = (message: MessageEvent) =>
  onWorkerMessage(message, post, close, new DbCreator());

parentPort?.on("message", onMessage);
imhere(post);
