/**
 * This package provides functionality to take a reactive service definition and spawn the http servers to expose it through HTTP/SSE.
 *
 * @packageDocumentation
 */

import {
  type ServiceInstance,
  type CollectionUpdate,
  type Entry,
  type Json,
  type SkipService,
  type SubscriptionID,
} from "@skipruntime/core";
import { controlService, streamingService } from "./rest.js";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { isMainThread, parentPort, Worker } from "worker_threads";

/**
 * A running Skip server.
 */
export type SkipServer = {
  /**
   * Stop accepting new connections, close existing connections, and halt a running service.
   */
  close: () => Promise<void>;
};

type Options = {
  streaming_port: number;
  control_port: number;
  platform?: "wasm" | "native";
  no_cors?: boolean;
};

function get<T>(
  request: WorkerRequest | undefined,
  param: string,
  def?: T,
): T | undefined {
  if (request && param in request) return request[param] as T;
  return def;
}

/**
 * Initialize and start a reactive Skip service.
 *
 * Calling `runService` will start a reactive service based on the `service` specification and `options`.
 * The service offers two interfaces over HTTP: a control API on `options.control_port`, and a streaming API on `options.streaming_port`.
 *
 * The service exposes resources and input collections specified by `service: SkipService`.
 * Resources can be read and input collections can be written.
 * Each input _collection_ has a _name_, and associates _keys_ to _values_.
 * Each resource has a _name_ and identifies a collection that associates _keys_ to _values_.
 *
 * The control API responds to the following HTTP requests:
 *
 * - `POST /v1/snapshot/:resource`:
 *   Synchronous read of an entire resource.
 *
 *  The body of the request must be a JSON-encoded value, which is passed as parameters to the resource constructor.
 *  Responds with the current contents of the named `resource` with the given parameters, instantiating the resource if needed.
 *  Data is returned as a JSON-encoded array of key/value entries, with each entry a tuple of the form `[key, [value1, value2, ...]]`.
 *
 * - `POST /v1/snapshot/:resource/lookup`:
 *   Synchronous read of a specific key in a resource.
 *
 *  The body of the request must be a JSON-encoded object with a `key` field and a `params` field.
 *  Responds with the values associated to `key` in the named `resource` with the given parameters, instantiating the resource if needed.
 *  Data is returned as a JSON-encoded array of values.
 *
 * - `PATCH /v1/inputs/:collection`:
 *   Partial write (update only the specified keys) of an input collection.
 *
 *   The `collection` must be the name of one of the service's input collections, that is, one of the keys of the `Inputs` type parameter.
 *   The body of the request must be a JSON-encoded value of type `CollectionUpdate.values`, that is `[Json, Json[]][]`: an array of entries each of which associates a key to an array of its new values.
 *   Updates the named `collection` with the key-values entries in the request body.
 *
 * - `POST /v1/streams/:resource`:
 *   Instantiate a resource and return a UUID to subscribe to updates.
 *
 *   Requires the request to have a `Content-Type: application/json` header.
 *   The body of the request must be a JSON-encoded value, which will be passed as parameters to the resource constructor.
 *   Instantiates the named `resource` with the given parameters and responds with a UUID that can be used to subscribe to updates.
 *
 * - `DELETE /v1/streams/:uuid`:
 *   Destroy a resource instance.
 *
 *   Destroys the resource instance identified by `uuid`.
 *   Under normal circumstances, resource instances are deleted automatically after some period of inactivity; this interface enables immediately deleting live streams under exceptional circumstances.
 *
 * - `GET /v1/healthcheck
 *   Check that the Skip service is running normally.
 *   Returns HTTP 200 if the service is healthy, for use in monitoring, deployments, and the like.
 *
 * The streaming API responds to the following HTTP requests:
 *
 * - `GET /v1/streams/:uuid`:
 *   Server-sent events endpoint to subscribe to updates of the resource instance represented by the UUID.
 *
 *   Requires the request to have an `Accept: text/event-stream` header.
 *   The `uuid` must have been obtained from a `POST /v1/streams` request, and not yet `DELETE`d.
 *   Provides an HTTP server-sent event stream of updates to the resource identified by `uuid`.
 *   Each event will be a serialization of a `CollectionUpdate` of the form:
 * ```
 *     event: (init | update)\n
 *     id: <watermark>\n
 *     data: <values>\n\n
 * ```
 *
 * @typeParam Inputs - Named collections from which the service computes.
 * @typeParam ResourceInputs - Named collections provided to resource computations.
 * @param service - The SkipService definition to run.
 * @param options - Service configuration options.
 * @param options.control_port - Port on which control service will listen.
 * @param options.streaming_port - Port on which streaming service will listen.
 * @param options.platform - Skip runtime platform to be used to run the service: either `wasm` (the default) or `native`.
 * @param options.no_cors - Disable CORS for the streaming endpoint.
 * @returns Object to manage the running server.
 */
export async function runService(
  service: SkipService,
  options: Options = {
    streaming_port: 8080,
    control_port: 8081,
    platform: "wasm",
    no_cors: false,
  },
  url?: string,
): Promise<SkipServer> {
  if (isMainThread) {
    let instance: ServiceInstance;
    if (url) {
      instance = await initWorkerService(url);
    } else {
      instance = await initService(service, options);
    }

    const controlHttpServer = controlService(instance).listen(
      options.control_port,
      () => {
        console.log(
          `Skip control service listening on port ${options.control_port.toString()}`,
        );
      },
    );
    const wrapMiddleware = (app: Express) => {
      if (options.no_cors) {
        return express().use(no_cors).use(app);
      }
      return app;
    };
    const streamingHttpServer = wrapMiddleware(
      streamingService(instance),
    ).listen(options.streaming_port, () => {
      console.log(
        `Skip streaming service listening on port ${options.streaming_port.toString()}`,
      );
    });

    return {
      close: async () => {
        controlHttpServer.close();
        await instance.close();
        streamingHttpServer.close();
      },
    };
  } else {
    try {
      const instance = await initService(service, options);
      parentPort?.postMessage("service-ready");
      const messageHandler = (message: WorkerMessage) => {
        const request = message.data as WorkerRequest;
        const resourceInstanceId = get<string>(request, "resourceInstanceId");
        switch (request.type) {
          case "instantiate-resource":
            instance
              .instantiateResource(
                request["identifier"] as string,
                request["resource"] as string,
                request["params"] as Json,
              )
              .then((_) => {
                parentPort?.postMessage({
                  id: message.id,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
          case "get-all":
            instance
              .getAll(
                request["resource"] as string,
                get<Json>(request, "params", {}),
              )
              .then((data) => {
                parentPort?.postMessage({
                  id: message.id,
                  data,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
          case "get-array":
            instance
              .getArray(
                request["resource"] as string,
                request["key"] as Json,
                get<Json>(request, "params", {}),
              )
              .then((data) => {
                parentPort?.postMessage({
                  id: message.id,
                  data,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
          case "close-resource-instance":
            instance.closeResourceInstance(resourceInstanceId!);
            break;
          case "subscribe":
            instance
              .subscribe(
                resourceInstanceId!,
                {
                  subscribed: () => {
                    parentPort?.postMessage({
                      data: {
                        type: "notifier-subscribed",
                        subscription: resourceInstanceId!,
                      },
                    });
                  },
                  notify: (update) => {
                    parentPort?.postMessage({
                      data: {
                        type: "notifier-notify",
                        subscription: resourceInstanceId!,
                        update,
                      },
                    });
                  },
                  close: () => {
                    parentPort?.postMessage({
                      data: {
                        type: "notifier-close",
                        subscription: resourceInstanceId,
                      },
                    });
                  },
                },
                get<string>(request, "watermark"),
              )
              .then((subscriptionID) => {
                parentPort?.postMessage({
                  id: message.id,
                  data: subscriptionID,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
          case "unsubscribe":
            instance.unsubscribe(request["id"] as SubscriptionID);
            break;
          case "update":
            instance
              .update(
                request["collection"] as string,
                request["entries"] as Entry<Json, Json>[],
              )
              .then((_) => {
                parentPort?.postMessage({
                  id: message.id,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
          case "close":
            instance
              .close()
              .then((data) => {
                parentPort?.postMessage({
                  id: message.id,
                  data,
                });
              })
              .catch((e: unknown) =>
                parentPort?.postMessage({
                  id: message.id,
                  error: (e as Error).message,
                }),
              );
            break;
        }
      };
      parentPort?.on("message", messageHandler);
    } catch (e: unknown) {
      parentPort?.postMessage((e as Error).message);
    }
    return {
      close: () => {
        return Promise.resolve();
      },
    };
  }
}

async function initWorkerService(url: string): Promise<ServiceInstance> {
  return new Promise<ServiceInstance>((resolve, reject) => {
    const worker = new Worker(url);
    const notifiers = new Map<string, Notifier<Json, Json>>();
    const requests = new Map<string, Executor<unknown>>();
    worker.on("message", (message: WorkerMessage | string) => {
      if (typeof message == "string") {
        if (message == "service-ready") {
          resolve(new WorkerManager(worker, notifiers, requests));
        } else {
          reject(new Error(message));
        }
      } else {
        if (message.id) {
          const executor = requests.get(message.id)!;
          if (message.error) {
            executor.reject(new Error(message.error));
          } else {
            executor.resolve(message.data);
          }
        } else if (message.data?.subscription) {
          const event = message.data as WorkerEvent;
          const notifier = notifiers.get(event.subscription);
          if (notifier) {
            switch (event.type) {
              case "notifier-subscribed":
                notifier.subscribed();
                break;
              case "notifier-notify":
                notifier.notify(event.update!);
                break;
              case "notifier-close":
                notifier.close();
                break;
            }
          }
        }
      }
    });

    worker.on("error", (error) => {
      console.error("Worker error:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
      });
    });
  });
}

async function initService(service: SkipService, options: Options) {
  let runtime;
  if (options.platform == "native") {
    try {
      runtime = await import("@skipruntime/native");
    } catch (e) {
      console.error(
        'Error loading Skip runtime for specified "native" platform: ',
      );
      throw e;
    }
  } else {
    try {
      runtime = await import("@skipruntime/wasm");
    } catch (e) {
      console.error(
        'Error loading Skip runtime for specified "wasm" platform: ',
      );
      throw e;
    }
  }
  return runtime.initService(service);
}

function no_cors(req: Request, res: Response, next: NextFunction) {
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Origin", "*");
  if (req.method.toUpperCase() == "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Content-Length", "0");
    res.end();
  } else {
    next();
  }
}

type RequestType =
  | "instantiate-resource"
  | "get-all"
  | "get-array"
  | "close-resource-instance"
  | "subscribe"
  | "unsubscribe"
  | "update"
  | "close";

type WorkerRequest = {
  type: RequestType;
  [key: string]: Json | SubscriptionID | undefined;
};

type WorkerEvent = {
  type: "notifier-subscribed" | "notifier-notify" | "notifier-close";
  subscription: string;
  update?: CollectionUpdate<Json, Json>;
};

type Notifier<K extends Json, V extends Json> = {
  subscribed: () => void;
  notify: (update: CollectionUpdate<K, V>) => void;
  close: () => void;
};

type WorkerMessage = {
  id?: string;
  data?: WorkerRequest | WorkerEvent;
  error?: string;
};

type Executor<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: Error) => void;
};

class WorkerManager implements ServiceInstance {
  constructor(
    private worker: Worker,
    private notifiers: Map<string, Notifier<Json, Json>>,
    private requests: Map<string, Executor<unknown>>,
    private subscriptions: Map<SubscriptionID, string> = new Map(),
  ) {}

  instantiateResource(
    identifier: string,
    resource: string,
    params: Json,
  ): Promise<void> {
    const request: WorkerRequest = {
      type: "instantiate-resource",
      identifier,
      resource,
      params,
    };
    return this.request(request);
  }

  getAll<K extends Json, V extends Json>(
    resource: string,
    params: Json = {},
  ): Promise<Entry<K, V>[]> {
    const request: WorkerRequest = {
      type: "get-all",
      resource,
      params,
    };
    return this.request(request);
  }

  getArray<K extends Json, V extends Json>(
    resource: string,
    key: K,
    params: Json = {},
  ): Promise<V[]> {
    const request: WorkerRequest = {
      type: "get-array",
      resource,
      key,
      params,
    };
    return this.request(request);
  }

  closeResourceInstance(resourceInstanceId: string): void {
    const request: WorkerRequest = {
      type: "close-resource-instance",
      resourceInstanceId,
    };
    this.call(request);
  }

  async subscribe<K extends Json, V extends Json>(
    resourceInstanceId: string,
    notifier: Notifier<K, V>,
    watermark?: string,
  ): Promise<SubscriptionID> {
    this.notifiers.set(resourceInstanceId, notifier as Notifier<Json, Json>);
    const request: WorkerRequest = {
      type: "subscribe",
      resourceInstanceId,
      watermark,
    };
    try {
      const id = await this.request<SubscriptionID>(request);
      this.subscriptions.set(id, resourceInstanceId);
      return id;
    } catch (e: unknown) {
      this.notifiers.delete(resourceInstanceId);
      throw e;
    }
  }

  unsubscribe(id: SubscriptionID): void {
    const request: WorkerRequest = {
      type: "unsubscribe",
      id,
    };
    this.call(request);
    const subscription = this.subscriptions.get(id);
    if (subscription) {
      this.subscriptions.delete(id);
      this.notifiers.delete(subscription);
    }
  }

  update<K extends Json, V extends Json>(
    collection: string,
    entries: Entry<K, V>[],
  ): Promise<void> {
    const request: WorkerRequest = {
      type: "update",
      collection,
      entries,
    };
    return this.request(request);
  }

  close(): Promise<unknown> {
    const request: WorkerRequest = {
      type: "close",
    };
    return this.request(request).then((_) => this.worker.terminate());
  }

  private request<T>(request: WorkerRequest): Promise<T> {
    const requestId = Math.random().toString(36).substring(2);
    return new Promise<T>((resolve, reject) => {
      this.requests.set(requestId, { resolve, reject } as Executor<unknown>);
      this.worker.postMessage({ id: requestId, data: request });
    });
  }

  private call(request: WorkerRequest): void {
    const requestId = Math.random().toString(36).substring(2);
    this.worker.postMessage({ id: requestId, data: request });
  }
}
