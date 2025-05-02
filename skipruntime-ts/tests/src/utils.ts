import { expect, isEqual } from "earl";
import type {
  Json,
  CollectionUpdate,
  SubscriptionID,
  Nullable,
  Entity,
  Graph,
  ServiceInstance,
  Entry,
  BuildInfo,
} from "@skipruntime/core";

export async function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAlternateConsoleError(
  altConsoleError: (...messages: any[]) => void,
  f: () => Promise<void>,
): Promise<void> {
  const systemConsoleError = console.error;
  console.error = altConsoleError;
  await f();
  console.error = systemConsoleError;
}

export async function withRetries(
  f: () => Promise<void>,
  maxRetries: number = 5,
  init: number = 100,
  exponent: number = 1.5,
): Promise<void> {
  let retries = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      await timeout(init * exponent ** retries);
      await f();
      break;
    } catch (e: unknown) {
      if (retries < maxRetries) retries++;
      else throw e;
    }
  }
}

export class Notifier {
  private updates: CollectionUpdate<Json, Json>[] = [];
  private sid: SubscriptionID;
  private resolver: Nullable<() => void> = null;

  constructor(
    private service: ServiceInstance,
    instance: string,
    private log: boolean = false,
  ) {
    this.sid = service.subscribe(instance, {
      subscribed: () => {},
      notify: (update) => {
        if (this.log) console.log("NOTIFY", JSON.stringify(update));
        this.updates.push(update);
        if (this.resolver) this.resolver();
      },
      close: () => {},
    });
  }

  check(
    checker: (updates: CollectionUpdate<Json, Json>[]) => void,
    clear: boolean = true,
  ): void {
    checker(this.updates);
    if (clear) this.updates = [];
  }

  checkInit<K extends Json, V extends Json>(values: Entry<K, V>[]) {
    this.check((updates) => {
      expect([
        updates.length,
        updates[0]!.isInitial ? true : false,
        updates[0]!.values,
      ]).toEqual([1, true, values]);
    });
  }

  checkUpdate<K extends Json, V extends Json>(values: Entry<K, V>[]) {
    this.check((updates) => {
      expect([
        updates.length,
        updates[0]?.isInitial ? true : false,
        updates[0]?.values,
      ]).toEqual([1, false, values]);
      return false;
    });
  }

  checkEmpty() {
    this.check((updates) => {
      expect(updates.length).toEqual(0);
    });
  }

  async waitNotification(
    checker: (updates: CollectionUpdate<Json, Json>[]) => boolean,
    timeout: number = 1000,
  ) {
    if (checker(this.updates)) return;
    return new Promise<void>((resolve, reject) => {
      try {
        let rejected = false;
        const timeoutHdl = setTimeout(() => {
          rejected = true;
          reject(new Error("Timeout"));
        }, timeout);
        this.resolver = () => {
          if (rejected) return;
          if (checker(this.updates)) {
            clearTimeout(timeoutHdl);
            resolve();
            this.updates = [];
          }
        };
      } catch (e: unknown) {
        reject(e as Error);
      }
    });
  }

  async wait<K extends Json, V extends Json>(
    values: [boolean, Entry<K, V>[]][],
    timeout: number = 1000,
  ) {
    return this.waitNotification((updates) => {
      const current = updates.map((u) => [
        u.isInitial ? true : false,
        u.values,
      ]);
      return isEqual(current, values);
    }, timeout);
  }

  close() {
    this.service.unsubscribe(this.sid);
  }
}

/// Graph

export function getName(entity: Entity): string {
  const name = entity.name;
  const result = name
    ? typeof name == "string"
      ? name
      : name.name
    : "unknonw";
  return result;
}

export function getEntityName(graph: Graph, idx: number): string {
  return getName(graph.entities[idx]!);
}

export function inputEntity(data: {
  name: string;
  alias?: string;
  outputs?: string[];
  metadata?: {
    name: string;
    params?: { type: string; value: Json }[];
    operator?: string;
  };
}): Entity {
  return {
    inputs: [],
    name: data.alias
      ? {
          alias: data.alias,
          name: data.name,
        }
      : {
          name: data.name,
        },
    outputs: data.outputs ?? [],
    reads: [],
  };
}

export function input(name: string) {
  return inputEntity({
    name: `/${name}/`,
    alias: name,
  });
}

export function inputOpEntity(data: {
  name: string;
  clazzName: string;
  params?: { type: string; value: Json }[];
  operator?: string;
  reads?: string[];
  outputs?: string[];
}): Entity {
  return {
    name: data.name,
    metadata: {
      buildinfos: [
        {
          name: data.clazzName,
          params: data.params ?? [],
        },
      ],
      operator: data.operator ?? "lazy",
    },
    reads: data.reads ?? [],
    outputs: data.outputs ?? [],
  };
}

export function opEntity(data: {
  name: string;
  clazzName: string;
  params?: { type: string; value: Json }[];
  operator?: string;
  inputs?: string[];
  reads?: string[];
  outputs?: string[];
  buildinfos?: BuildInfo[];
}): Entity {
  const buildinfos = data.buildinfos ?? [];
  return {
    name: {
      name: data.name,
    },
    metadata: {
      buildinfos: [
        {
          name: data.clazzName,
          params: data.params ?? [],
        },
        ...buildinfos,
      ],
      operator: data.operator ?? "map",
    },
    inputs: data.inputs ?? [],
    reads: data.reads ?? [],
    outputs: data.outputs ?? [],
  };
}

export function internOpEntity(data: {
  name: string;
  operator?: string;
  inputs?: string[];
  reads?: string[];
  outputs?: string[];
}): Entity {
  return {
    name: {
      name: data.name,
    },
    metadata: {
      operator: data.operator ?? "lazy",
    },
    inputs: data.inputs ?? [],
    reads: data.reads ?? [],
    outputs: data.outputs ?? [],
  };
}

export function dataParam(name: Json) {
  return {
    type: "data",
    value: name,
  };
}

export function colParam(value: string) {
  return {
    type: "collection",
    value,
  };
}

function escape(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkResourceOpName(
  graph: Graph,
  index: number,
  name: string,
  op: string = "map",
  params: string = "b64_e30.",
) {
  const opName = getEntityName(graph, index);
  expect(opName).toMatchRegex(
    new RegExp(
      `^\\/sk\\/resource_mappers\\/${name}\\/${escape(params)}\\/${op}\\/(?:ext_\\d+|sum|min|max|count)(?:\\.ext_\\d+|\\.sum|\\.min|\\.max|\\.count)?\\/$`,
    ),
  );
  return opName;
}

export function checkResourceInnerName(
  graph: Graph,
  index: number,
  name: string,
  op: string,
  params: string = "b64_e30.",
) {
  const opName = getEntityName(graph, index);
  expect(opName).toMatchRegex(
    new RegExp(
      `^\\/sk\\/resource_mappers\\/${name}\\/${escape(params)}\\/${op}\\/[0-9]+\\/$`,
    ),
  );
  return opName;
}

export function sorted(graph: Graph): Graph {
  const entities = graph.entities
    .map((e) => [getName(e), e] as [string, Entity])
    .sort()
    .map((v) => v[1]);
  return {
    entities,
    reads: graph.reads.sort(),
  };
}
