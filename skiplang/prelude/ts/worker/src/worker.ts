import type { int, Environment } from "../skipwasm-std/index.js";

export interface Wrk {
  postMessage: (message: any) => void;
  onMessage: (listener: (value: any) => void) => void;
  shutdown: () => void;
  terminate: () => void;
}

export interface WrkEnvironment extends Environment {
  createWorker: (url: URL, options?: WorkerOptions) => Wrk;
  createWorkerWrapper: (worker: Worker) => Wrk;
}

export type FnOptions = {
  wrap?: int;
  autoremove?: boolean;
  register?: boolean;
  remove?: string;
};

type Callable = Function | Caller;

export class Wrappable {
  wrappedId?: number;
}

let sourcesLastId = 0;

class UnmanagedMessage extends Error {}

export class Function {
  constructor(
    public fn: string,
    public parameters: any[],
    public options?: FnOptions,
  ) {}

  static as(obj: object) {
    if (!("fn" in obj) || !("parameters" in obj)) return null;
    const options = "options" in obj ? (obj.options! as FnOptions) : undefined;
    const fn = new Function(
      obj.fn! as string,
      obj.parameters! as any[],
      options,
    );
    return fn;
  }

  static isValid(obj: object) {
    return "fn" in obj && "parameters" in obj;
  }
}

export class Caller {
  constructor(
    public wrapped: number,
    public fn: string,
    public parameters: any[],
    public options?: FnOptions,
  ) {}

  static convert(obj: object) {
    if (!("wrapped" in obj) || !("fn" in obj) || !("parameters" in obj))
      return null;
    const options = "options" in obj ? (obj.options! as FnOptions) : undefined;
    const fn = new Caller(
      obj.wrapped! as number,
      obj.fn! as string,
      obj.parameters! as any[],
      options,
    );
    return fn;
  }

  static isValid(obj: object) {
    return "fn" in obj && "parameters" in obj;
  }
}

export class Return {
  constructor(
    public success: boolean,
    public value: any,
  ) {}

  static as(obj: object) {
    if (!("success" in obj) || !("value" in obj)) return null;
    return new Return(obj.success! as boolean, obj.value);
  }
}

export class MessageId {
  constructor(
    public source: number,
    public id: number,
  ) {}

  static as(obj: object) {
    if (!("source" in obj) || !("id" in obj)) return null;
    return new MessageId(obj.source! as number, obj.id! as number);
  }
}

export class Wrapped {
  constructor(public wrapped: number) {}

  static as(obj: object) {
    if (!("wrapped" in obj)) return null;
    return new Wrapped(obj.wrapped! as number);
  }
}

function asKey(messageId: MessageId) {
  return `${messageId.source}:${messageId.id}`;
}

export class Sender {
  constructor(
    public close: () => void,
    public send: <T>() => Promise<T>,
  ) {}
}

export class Message {
  constructor(
    public id: MessageId,
    public payload: unknown,
  ) {}

  private static convert(f: (_: object) => unknown, obj: object) {
    if (!("id" in obj && typeof obj.id === "object")) return null;
    if (!("payload" in obj && typeof obj.payload === "object")) return null;
    const { id, payload } = obj as { id: object; payload: object };
    const messageId = MessageId.as(id);
    const messagePayload = f(payload);
    if (!messageId || !messagePayload) return null;
    return new Message(messageId, messagePayload);
  }

  static asFunction(obj: object) {
    return Message.convert((x) => Function.as(x), obj);
  }

  static asCaller(obj: object) {
    return Message.convert((x) => Caller.convert(x), obj);
  }

  static asReturn(obj: object) {
    return Message.convert((x) => Return.as(x), obj);
  }
}

export class PromiseWorker {
  private lastId: number;
  private source: number;
  private worker: Wrk;
  private callbacks: Map<string, (...args: any[]) => any>;
  private subscriptions: Map<string, (...args: any[]) => void>;
  private mark: Date;
  private registered: Callable[];
  private unregister: Map<string, Function>;
  private reloaded: number;
  public reloading: boolean;

  private reload: () => Promise<void>;

  post: (fn: Function) => Promise<Sender>;
  onMessage: (message: MessageEvent) => void;
  check: () => boolean;

  constructor(createWorker: () => Wrk, reload?: number) {
    this.lastId = 0;
    this.worker = createWorker();
    this.source = ++sourcesLastId;
    this.callbacks = new Map();
    this.subscriptions = new Map();
    this.mark = new Date();
    this.registered = [];
    this.unregister = new Map();
    this.reloading = false;
    this.reloaded = 0;

    const unregister = (fn: Callable) => {
      for (let i = 0; i < this.registered.length; i++) {
        if (this.registered[i] == fn) {
          this.registered.splice(i, 1);
        }
      }
    };
    const checkRegistration = (fn: Callable) => {
      // Check unregistration first
      let unregisterId: string;
      if (fn instanceof Caller) {
        unregisterId = fn.wrapped.toString() + ":" + fn.fn;
      } else {
        unregisterId = fn.fn;
      }
      if (this.unregister.has(unregisterId)) {
        unregister(this.unregister.get(unregisterId)!);
        this.unregister.delete(unregisterId);
      }
      if (fn.options?.register) {
        this.registered.push(fn);
        if (fn.options.remove) {
          if (fn instanceof Caller) {
            this.unregister.set(
              fn.wrapped.toString() + ":" + fn.options.remove,
              fn,
            );
          } else {
            this.unregister.set(fn.options.remove, fn);
          }
        }
      }
    };
    this.post = async (fn: Function | Caller) => {
      if (!this.check()) {
        await this.reload();
      }
      checkRegistration(fn);
      const messageId = new MessageId(this.source, ++this.lastId);
      const subscribed = new Set<string>();
      const parameters = fn.parameters.map((p) => {
        if (typeof p == "function") {
          const subscriptionId = new MessageId(this.source, ++this.lastId);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const wfn = (result: Return) => void p.apply(null, result.value);
          const key = asKey(subscriptionId);
          this.subscriptions.set(key, wfn);
          subscribed.add(key);
          return subscriptionId;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return p;
        }
      });
      fn.parameters = parameters;
      const deleteSub = this.subscriptions.delete.bind(this.subscriptions);
      const deleteUnr = this.unregister.delete.bind(this.unregister);
      const setCallback = this.callbacks.set.bind(this.callbacks);
      const postMessage = this.worker.postMessage.bind(this.worker);
      return new Sender(
        () => {
          subscribed.forEach((key) => deleteSub(key));
          if (fn.options?.register) {
            unregister(fn);
            if (fn.options.remove) {
              let unregisterId: string;
              if (fn instanceof Caller) {
                unregisterId = fn.wrapped.toString() + ":" + fn.fn;
              } else {
                unregisterId = fn.fn;
              }
              deleteUnr(unregisterId);
            }
          }
        },
        () =>
          new Promise(function (resolve, reject) {
            setCallback(asKey(messageId), (result: Return) => {
              if (result.success) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                resolve(result.value);
              } else if (result.value instanceof Error) {
                reject(result.value);
              } else {
                reject(new Error(JSON.stringify(result.value)));
              }
            });
            const message = new Message(messageId, fn);
            postMessage(message);
          }),
      );
    };

    this.onMessage = (message: MessageEvent) => {
      this.mark = new Date();
      const msg = message.data ?? message;
      if (msg == "imhere") {
        return;
      }
      const data =
        typeof msg == "object" ? Message.asReturn(msg as object) : null;
      if (!data) {
        throw new UnmanagedMessage(JSON.stringify(message));
      } else {
        const result = data.payload as Return;
        const callId = asKey(data.id);
        const callback = this.callbacks.get(callId);
        if (callback) {
          this.callbacks.delete(callId);
          callback(data.payload);
          return;
        }
        const subscription = this.subscriptions.get(callId);
        if (subscription) {
          subscription(data.payload);
          return;
        }
        if (result.value instanceof Error) {
          throw result.value;
        } else
          throw new Error("Return with no callback" + JSON.stringify(data));
      }
    };
    this.check = () => {
      if (reload != undefined && reload > 0) {
        const diff = new Date().getTime() - this.mark.getTime();
        const seconds = diff / 1000;
        if (seconds > reload) {
          return false;
        }
      }
      return true;
    };
    this.reload = async () => {
      // Just in case is not really shutdown
      this.shutdown();
      this.reloading = true;
      const toRegister = this.registered;
      this.registered = [];
      this.callbacks = new Map();
      this.subscriptions = new Map();
      this.unregister = new Map();
      this.worker = createWorker();
      this.mark = new Date();
      this.worker.onMessage(this.onMessage);
      for (const fn of toRegister) {
        const sender = await this.post(fn);
        await sender.send();
      }
      this.reloading = false;
      this.reloaded++;
    };
    this.worker.onMessage(this.onMessage);
  }

  shutdown = () => {
    this.worker.shutdown();
  };

  terminate = () => {
    this.worker.terminate();
  };
}

function apply<R>(
  post: (message: any) => void,
  id: MessageId,
  caller: any,
  fn: (...args: any) => Promise<R>,
  parameters: any[],
  conv: (res: any) => any = (v) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    v,
): void {
  try {
    const promise = fn.apply(caller, parameters);
    promise
      .then((result: any) => {
        post(new Message(id, new Return(true, conv(result))));
      })
      .catch((e: unknown) => {
        // Firefox doesn't transmit Worker message if an object of type Error is in the message.
        post(
          new Message(
            id,
            new Return(false, e instanceof Error ? e.message : e),
          ),
        );
      });
  } catch (e: unknown) {
    post(
      new Message(id, new Return(false, e instanceof Error ? e.message : e)),
    );
  }
}

let runner: object | undefined;

export interface Creator<T> {
  getName: () => string;
  getType: () => string;
  create: (...args: any[]) => Promise<T>;
  shutdown: (created: T) => Promise<void>;
}

export const imhere = (post: (message: any) => void) => {
  setInterval(() => post("imhere"), 1000);
};

export class State {
  runner?: object;
  wrapped: Map<number, { value: any; autoremove: boolean }>;

  constructor() {
    this.wrapped = new Map();
  }
}

export const onWorkerMessage = <T>(
  state: State,
  message: MessageEvent,
  post: (message: any) => void,
  close: () => void,
  creator: Creator<T>,
) => {
  if (state.runner && typeof message == "string" && message == "#shutdown") {
    void creator.shutdown(state.runner as T);
    close();
    return;
  }
  let data = Message.asCaller(message);
  if (!data) {
    data = Message.asFunction(message);
    if (!data) {
      post("Invalid worker message");
    } else {
      const fun = data.payload as Function;
      const parameters = fun.parameters.map((p) => {
        const subscription =
          typeof p == "object" ? MessageId.as(p as object) : null;
        if (subscription) {
          return (...args: any[]) => {
            post(new Message(subscription, new Return(true, args)));
          };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return p;
        }
      });
      if (fun.fn == creator.getName()) {
        if (state.runner) {
          post(
            new Message(
              data.id,
              new Return(false, creator.getType() + " already created"),
            ),
          );
        } else {
          apply(
            post,
            data.id,
            creator,
            creator.create,
            parameters,
            (created) => {
              runner = created as object;
              return null;
            },
          );
        }
      } else if (!state.runner) {
        post(
          new Message(data.id, new Return(false, "Database must be created")),
        );
      } else {
        // @ts-expect-error: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
        const fn = state.runner[fun.fn];
        if (typeof fn !== "function") {
          post(
            new Message(
              data.id,
              new Return(false, "Invalid database function " + fun.fn),
            ),
          );
        } else {
          const fn_at_assumed_type = fn as (...args: any) => Promise<unknown>;
          apply(
            post,
            data.id,
            runner,
            fn_at_assumed_type,
            parameters,
            (result: any) => {
              if (fun.options?.wrap !== undefined) {
                const wId = fun.options.wrap;
                state.wrapped.set(wId, {
                  value: result,
                  autoremove: fun.options.autoremove ? true : false,
                });
                if (result instanceof Wrappable) {
                  result.wrappedId = wId;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return result;
              }
            },
          );
        }
      }
    }
  } else {
    const caller = data.payload as Caller;
    const parameters = caller.parameters.map((p) => {
      const subscription =
        typeof p == "object" ? MessageId.as(p as object) : null;
      if (subscription) {
        return (...args: any[]) => {
          post(new Message(subscription, new Return(true, args)));
        };
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return p;
      }
    });
    const obj = state.wrapped.get(caller.wrapped);
    const fni =
      caller.fn == ""
        ? { fn: obj?.value, obj: null }
        : { fn: obj?.value[caller.fn], obj: obj?.value };
    if (typeof fni.fn !== "function") {
      post(
        new Message(
          data.id,
          new Return(false, "Invalid function " + caller.fn),
        ),
      );
    } else {
      const fn_at_assumed_type = fni.fn as (...args: any) => Promise<unknown>;
      apply(post, data.id, fni.obj, fn_at_assumed_type, parameters);
    }
    if (obj?.autoremove || caller.options?.autoremove) {
      state.wrapped.delete(caller.wrapped);
    }
  }
};
