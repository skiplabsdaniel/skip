/**
 * The @skipruntime/core package contains internal implementation detail for the Skip Framework and should not need to be used directly. See the public API exposed by the @skipruntime/helpers package.
 *
 * @packageDocumentation
 */

import type { Opaque } from "../skiplang-std/index.js";
import type {
  Pointer,
  Nullable,
  Exportable,
  TypedConverter,
  JsonConverter as CJConverter,
  CJType,
} from "../skiplang-json/index.js";
import {
  deepFreeze,
  SkManaged,
  checkOrCloneParam,
} from "../skiplang-json/index.js";

import { sknative } from "../skiplang-std/index.js";

import type { JsonObject as CJObject } from "../skiplang-json/index.js";

import type * as Internal from "./internal.js";
import type {
  CollectionUpdate,
  Context,
  EagerCollection,
  Entry,
  ExternalService,
  LazyCollection,
  LazyCompute,
  Mapper,
  NamedCollections,
  Values,
  DepSafe,
  Reducer,
  Resource,
  SkipService,
  Watermark,
  Json,
  JsonObject,
  JsonConverter,
  Data,
  DataConverter,
  NamedInputs,
} from "./api.js";

import {
  SkipClassNameError,
  SkipError,
  SkipNonUniqueValueError,
  SkipResourceInstanceInUseError,
  SkipUnknownCollectionError,
} from "./errors.js";
import {
  ResourceBuilder,
  type Notifier,
  type Handle,
  type FromBinding,
} from "./binding.js";

export * from "./api.js";
export * from "./errors.js";

export type JsonMapper = Mapper<Json, Json, Json, Json>;
export type DataMapper = Mapper<Json, Data, Json, Data>;
export type JSONLazyCompute = LazyCompute<Json, Json>;

function instantiateUserObject<Params extends DepSafe[], Result extends object>(
  what: string,
  ctor: new (...params: Params) => Result,
  params: Params,
): Result {
  const checkedParams = params.map(checkOrCloneParam) as Params;
  const obj = new ctor(...checkedParams);
  Object.freeze(obj);
  if (!obj.constructor.name) {
    throw new SkipClassNameError(
      `${what} classes must be defined at top-level.`,
    );
  }
  return obj;
}

class Handles {
  private nextID: number = 1;
  private readonly objects: any[] = [];
  private readonly freeIDs: number[] = [];

  register<T>(v: T): Handle<T> {
    const freeID = this.freeIDs.pop();
    const id = freeID ?? this.nextID++;
    this.objects[id] = v;
    return id as Handle<T>;
  }

  get<T>(id: Handle<T>): T {
    return this.objects[id] as T;
  }

  apply<R, P extends any[]>(id: Handle<(..._: P) => R>, parameters: P): R {
    const fn = this.get(id);
    return fn.apply(null, parameters);
  }

  deleteHandle<T>(id: Handle<T>): T {
    const current = this.get(id);
    this.objects[id] = null;
    this.freeIDs.push(id);
    return current;
  }
}

export class Stack {
  private readonly stack: Pointer<Internal.Context>[] = [];

  push(pointer: Pointer<Internal.Context>) {
    this.stack.push(pointer);
  }

  get(): Nullable<Pointer<Internal.Context>> {
    if (this.stack.length == 0) return null;
    return this.stack[this.stack.length - 1]!;
  }

  pop(): void {
    this.stack.pop();
  }
}

class LazyCollectionImpl<K extends Json, V extends Json>
  extends SkManaged
  implements LazyCollection<K, V>
{
  constructor(
    private readonly lazyCollection: string,
    private readonly refs: ToBinding,
  ) {
    super();
    Object.defineProperty(this, "refs", {
      enumerable: false,
    });
    Object.freeze(this);
  }

  getArray(key: K): (V & DepSafe)[] {
    return this.refs
      .json()
      .importJSON(
        this.refs.binding.SkipRuntime_LazyCollection__getArray(
          this.lazyCollection,
          this.refs.json().exportJSON(key),
        ),
      ) as (V & DepSafe)[];
  }

  getUnique(key: K, _default?: { ifNone?: V; ifMany?: V }): V & DepSafe {
    const values = this.getArray(key);
    switch (values.length) {
      case 1:
        return values[0]!;
      case 0:
        if (_default?.ifNone !== undefined) return deepFreeze(_default.ifNone);
        throw new SkipNonUniqueValueError();
      default:
        if (_default?.ifMany !== undefined) return deepFreeze(_default.ifMany);
        throw new SkipNonUniqueValueError();
    }
  }

  toJSON() {
    return { collection: this.lazyCollection };
  }
}

class EagerCollectionImpl<K extends Json, V extends Data>
  extends SkManaged
  implements EagerCollection<K, V>
{
  constructor(
    public readonly collection: string,
    private readonly refs: ToBinding,
  ) {
    super();
    Object.defineProperty(this, "refs", {
      enumerable: false,
    });
    Object.freeze(this);
  }

  getArray(key: K): (V & DepSafe)[] {
    return this.refs
      .data()
      .importJSON(
        this.refs.binding.SkipRuntime_Collection__getArray(
          this.collection,
          this.refs.json().exportJSON(key),
        ),
      ) as (V & DepSafe)[];
  }

  getUnique(key: K, _default?: { ifNone?: V; ifMany?: V }): V & DepSafe {
    const values = this.getArray(key);
    switch (values.length) {
      case 1:
        return values[0]!;
      case 0:
        if (_default?.ifNone !== undefined) return deepFreeze(_default.ifNone);
        throw new SkipNonUniqueValueError();
      default:
        if (_default?.ifMany !== undefined) return deepFreeze(_default.ifMany);
        throw new SkipNonUniqueValueError();
    }
  }

  size() {
    return Number(
      this.refs.binding.SkipRuntime_Collection__size(this.collection),
    );
  }

  slice(start: K, end: K): EagerCollection<K, V> {
    return this.slices([start, end]);
  }

  slices(...ranges: [K, K][]): EagerCollection<K, V> {
    const skcollection = this.refs.binding.SkipRuntime_Collection__slice(
      this.collection,
      this.refs.json().exportJSON(ranges),
    );
    return this.derive<K, V>(skcollection);
  }

  take(limit: number): EagerCollection<K, V> {
    const skcollection = this.refs.binding.SkipRuntime_Collection__take(
      this.collection,
      BigInt(limit),
    );
    return this.derive<K, V>(skcollection);
  }

  map<K2 extends Json, V2 extends Data, Params extends DepSafe[]>(
    mapper: new (...params: Params) => Mapper<K, V, K2, V2>,
    ...params: Params
  ): EagerCollection<K2, V2> {
    const mapperObj = instantiateUserObject("Mapper", mapper, params);
    const skmapper = this.refs.binding.SkipRuntime_createMapper(
      this.refs.handles.register(mapperObj),
    );
    const mapped = this.refs.binding.SkipRuntime_Collection__map(
      this.collection,
      skmapper,
    );
    return this.derive<K2, V2>(mapped);
  }

  mapReduce<K2 extends Json, V2 extends Data, MapperParams extends DepSafe[]>(
    mapper: new (...params: MapperParams) => Mapper<K, V, K2, V2>,
    ...mapperParams: MapperParams
  ) {
    return <Accum extends Json, ReducerParams extends DepSafe[]>(
      reducer: new (...params: ReducerParams) => Reducer<V2, Accum>,
      ...reducerParams: ReducerParams
    ) => {
      const mapperObj = instantiateUserObject("Mapper", mapper, mapperParams);
      const reducerObj = instantiateUserObject(
        "Reducer",
        reducer,
        reducerParams,
      );

      const skmapper = this.refs.binding.SkipRuntime_createMapper(
        this.refs.handles.register(mapperObj),
      );

      if (sknative in reducerObj && typeof reducerObj[sknative] == "string") {
        return this.derive<K2, Accum>(
          this.refs.binding.SkipRuntime_Collection__nativeMapReduce(
            this.collection,
            skmapper,
            reducerObj[sknative],
          ),
        );
      } else {
        const skreducer = this.refs.binding.SkipRuntime_createReducer(
          this.refs.handles.register(reducerObj),
          this.refs.json().exportJSON(reducerObj.initial),
        );
        return this.derive<K2, Accum>(
          this.refs.binding.SkipRuntime_Collection__mapReduce(
            this.collection,
            skmapper,
            skreducer,
          ),
        );
      }
    };
  }

  reduce<Accum extends Json, Params extends DepSafe[]>(
    reducer: new (...params: Params) => Reducer<V, Accum>,
    ...params: Params
  ): EagerCollection<K, Accum> {
    const reducerObj = instantiateUserObject("Reducer", reducer, params);
    if (sknative in reducerObj && typeof reducerObj[sknative] == "string") {
      return this.derive<K, Accum>(
        this.refs.binding.SkipRuntime_Collection__nativeReduce(
          this.collection,
          reducerObj[sknative],
        ),
      );
    } else {
      const skreducer = this.refs.binding.SkipRuntime_createReducer(
        this.refs.handles.register(reducerObj),
        this.refs.json().exportJSON(reducerObj.initial),
      );
      return this.derive<K, Accum>(
        this.refs.binding.SkipRuntime_Collection__reduce(
          this.collection,
          skreducer,
        ),
      );
    }
  }

  merge(...others: EagerCollection<K, V>[]): EagerCollection<K, V> {
    const otherNames = others.map((other) =>
      EagerCollectionImpl.getName(other),
    );
    const mapped = this.refs.binding.SkipRuntime_Collection__merge(
      this.collection,
      this.refs.json().exportJSON(otherNames),
    );
    return this.derive<K, V>(mapped);
  }

  private derive<K2 extends Json, V2 extends Data>(
    collection: string,
  ): EagerCollection<K2, V2> {
    return new EagerCollectionImpl<K2, V2>(collection, this.refs);
  }

  static getName<K extends Json, V extends Data>(
    coll: EagerCollection<K, V>,
  ): string {
    return (coll as EagerCollectionImpl<K, V>).collection;
  }

  toJSON() {
    return { collection: this.collection };
  }
}

class CollectionWriter<K extends Json, V extends Json> {
  constructor(
    public readonly collection: string,
    private readonly refs: ToBinding,
    private forkName: Nullable<string>,
  ) {}

  async update(values: Entry<K, V>[], isInit: boolean): Promise<void> {
    this.refs.setFork(this.forkName);
    const uuid = crypto.randomUUID();
    const fork = this.fork(uuid);
    try {
      await fork.update_(values, isInit);
      fork.merge();
    } catch (ex: unknown) {
      fork.abortFork();
      throw ex;
    }
  }

  private update_(values: Entry<K, V>[], isInit: boolean): Promise<void> {
    this.refs.setFork(this.getForkName());
    if (!this.refs.needGC()) {
      throw new SkipError("CollectionWriter.update cannot be performed.");
    }
    return this.refs.runAsync(() =>
      this.refs.binding.SkipRuntime_CollectionWriter__update(
        this.collection,
        this.refs.json().exportJSON(values),
        isInit,
      ),
    );
  }

  private fork(name: string): CollectionWriter<K, V> {
    this.refs.setFork(this.forkName);
    this.refs.fork(name);
    return new CollectionWriter(this.collection, this.refs, name);
  }

  private merge(): void {
    if (!this.forkName) throw new Error("Unable to merge fork on main.");
    this.refs.setFork(this.forkName);
    this.refs.merge();
  }

  private abortFork(): void {
    if (!this.forkName) throw new Error("Unable to abord fork on main.");
    this.refs.setFork(this.forkName);
    this.refs.abortFork();
  }

  private getForkName(): Nullable<string> {
    const forkName = this.forkName;
    if (!forkName) return null;
    if (
      !this.refs.runWithGC(() =>
        this.refs.binding.SkipRuntime_Runtime__forkExists(forkName),
      )
    ) {
      this.forkName = null;
    }
    return this.forkName;
  }
}

class ContextImpl implements Context {
  constructor(private readonly refs: ToBinding) {}

  createLazyCollection<
    K extends Json,
    V extends Json,
    Params extends DepSafe[],
  >(
    compute: new (...params: Params) => LazyCompute<K, V>,
    ...params: Params
  ): LazyCollection<K, V> {
    const computeObj = instantiateUserObject("LazyCompute", compute, params);
    const skcompute = this.refs.binding.SkipRuntime_createLazyCompute(
      this.refs.handles.register(computeObj),
    );
    const lazyCollection =
      this.refs.binding.SkipRuntime_Context__createLazyCollection(skcompute);
    return new LazyCollectionImpl<K, V>(lazyCollection, this.refs);
  }

  useExternalResource<K extends Json, V extends Json>(resource: {
    service: string;
    identifier: string;
    params?: Json;
  }): EagerCollection<K, V> {
    const collection =
      this.refs.binding.SkipRuntime_Context__useExternalResource(
        resource.service,
        resource.identifier,
        this.refs.json().exportJSON(resource.params ?? {}),
      );
    return new EagerCollectionImpl<K, V>(collection, this.refs);
  }

  jsonExtract(value: JsonObject, pattern: string): Json[] {
    const skdata = this.refs.data();
    return skdata.importJSON(
      this.refs.binding.SkipRuntime_Context__jsonExtract(
        skdata.exportJSON(value),
        pattern,
      ),
    ) as Json[];
  }
}

export class ServiceInstanceFactory {
  constructor(private init: (service: SkipService) => ServiceInstance) {}

  initService(service: SkipService): ServiceInstance {
    return this.init(service);
  }
}

export type SubscriptionID = Opaque<string, "subscription">;

/**
 * A `ServiceInstance` is a running instance of a `SkipService`, providing access to its resources
 * and operations to manage subscriptions and the service itself.
 */
export class ServiceInstance {
  constructor(
    private readonly refs: ToBinding,
    readonly forkName: Nullable<string>,
  ) {}

  /**
   * Instantiate a resource with some parameters and client session authentication token
   * @param identifier - The resource instance identifier
   * @param resource - A resource name, which must correspond to a key in this `SkipService`'s `resources` field
   * @param params - Resource parameters, which will be passed to the resource constructor specified in this `SkipService`'s `resources` field
   * @returns The resulting promise
   */
  instantiateResource(
    identifier: string,
    resource: string,
    params: Json,
  ): Promise<void> {
    this.refs.setFork(this.forkName);
    return this.refs.runAsync(() =>
      this.refs.binding.SkipRuntime_Runtime__createResource(
        identifier,
        resource,
        this.refs.json().exportJSON(params),
      ),
    );
  }

  /**
   * Creates if not exists and get all current values of specified resource
   * @param resource - the resource name corresponding to a key in remotes field of SkipService
   * @param params - the parameters of the resource used to build the resource with the corresponding constructor specified in remotes field of SkipService
   * @returns The current values of the corresponding resource with reactive response token to allow subscription
   */
  async getAll<K extends Json, V extends Json>(
    resource: string,
    params: Json = {},
  ): Promise<Entry<K, V>[]> {
    const uuid = crypto.randomUUID();
    await this.instantiateResource(uuid, resource, params);
    try {
      this.refs.setFork(this.forkName);
      const result = this.refs.runWithGC(() => {
        return this.refs
          .json()
          .importJSON(
            this.refs.binding.SkipRuntime_Runtime__getAll(
              resource,
              this.refs.json().exportJSON(params),
            ),
            true,
          );
      });
      if (typeof result == "number")
        throw this.refs.handles.deleteHandle(result as Handle<Error>);
      return result as Entry<K, V>[];
    } finally {
      this.closeResourceInstance(uuid);
    }
  }

  /**
   * Get the current value of a key in the specified resource instance, creating it if it doesn't already exist
   * @param resource - A resource name, which must correspond to a key in this `SkipService`'s `resources` field
   * @param key - A key to look up in the resource instance
   * @param params - Resource parameters, passed to the resource constructor specified in this `SkipService`'s `resources` field
   * @returns The current value(s) for this key in the specified resource instance
   */
  async getArray<K extends Json, V extends Json>(
    resource: string,
    key: K,
    params: Json = {},
  ): Promise<V[]> {
    const uuid = crypto.randomUUID();
    await this.instantiateResource(uuid, resource, params);
    try {
      this.refs.setFork(this.forkName);
      const skjson = this.refs.json();
      const result = this.refs.runWithGC(() => {
        return skjson.importJSON(
          this.refs.binding.SkipRuntime_Runtime__getForKey(
            resource,
            skjson.exportJSON(params),
            skjson.exportJSON(key),
          ),
          true,
        );
      });
      if (typeof result == "number")
        throw this.refs.handles.deleteHandle(result as Handle<Error>);
      return result as V[];
    } finally {
      this.closeResourceInstance(uuid);
    }
  }

  /**
   * Close the specified resource instance
   * @param resourceInstanceId - The resource identifier
   */
  closeResourceInstance(resourceInstanceId: string): void {
    this.refs.setFork(this.forkName);
    const errorHdl = this.refs.runWithGC(() => {
      return this.refs.binding.SkipRuntime_Runtime__closeResource(
        resourceInstanceId,
      );
    });
    if (errorHdl) throw this.refs.handles.deleteHandle(errorHdl);
  }

  /**
   * Initiate reactive subscription on a resource instance
   * @param resourceInstanceId - the resource instance identifier
   * @param notifier - the object containing subscription callbacks
   * @param notifier.subscribed - A callback to execute when subscription effectively done
   * @param notifier.notify - A callback to execute on collection updates
   * @param notifier.close - A callback to execute on resource close
   * @param watermark - the watermark where to start the subscription
   * @returns A subscription identifier
   */
  subscribe<K extends Json, V extends Json>(
    resourceInstanceId: string,
    notifier: {
      subscribed: () => void;
      notify: (update: CollectionUpdate<K, V>) => void;
      close: () => void;
    },
    watermark?: string,
  ): SubscriptionID {
    this.refs.setFork(this.forkName);
    const session = this.refs.runWithGC(() => {
      const sknotifier = this.refs.binding.SkipRuntime_createNotifier(
        this.refs.handles.register(notifier),
      );
      return this.refs.binding.SkipRuntime_Runtime__subscribe(
        resourceInstanceId,
        sknotifier,
        watermark ?? null,
      );
    });
    if (session == -1n) {
      throw new SkipUnknownCollectionError(
        `Unknown resource instance '${resourceInstanceId}'`,
      );
    } else if (session == -2n) {
      throw new SkipResourceInstanceInUseError(
        `Resource instance '${resourceInstanceId}' cannot be subscribed twice.`,
      );
    } else if (session < 0n) {
      throw this.refs.handles.deleteHandle(Number(-session) as Handle<Error>);
    }
    return resourceInstanceId as SubscriptionID;
  }

  /**
   * Terminate a client's subscription to a reactive resource instance
   * @param id - The subscription identifier returned by a call to `subscribe`
   */
  unsubscribe(id: SubscriptionID): void {
    this.refs.setFork(this.forkName);
    const errorHdl = this.refs.runWithGC(() => {
      return this.refs.binding.SkipRuntime_Runtime__unsubscribe(id);
    });
    if (errorHdl) {
      throw this.refs.handles.deleteHandle(errorHdl);
    }
  }

  /**
   * Update an input collection
   * @param collection - the name of the input collection to update
   * @param entries - entries to update in the collection.
   */
  async update<K extends Json, V extends Json>(
    collection: string,
    entries: Entry<K, V>[],
  ): Promise<void> {
    this.refs.setFork(this.forkName);
    const uuid = crypto.randomUUID();
    const fork = this.fork(uuid);
    try {
      await fork.update_(collection, entries);
      fork.merge();
    } catch (ex: unknown) {
      fork.abortFork();
      throw ex;
    }
  }

  private async update_<K extends Json, V extends Json>(
    collection: string,
    entries: Entry<K, V>[],
  ): Promise<void> {
    this.refs.setFork(this.forkName);
    const result = this.refs.runWithGC(() => {
      const json = this.refs.json();
      return json.importJSON(
        this.refs.binding.SkipRuntime_Runtime__update(
          collection,
          json.exportJSON(entries),
        ),
        true,
      );
    });
    if (Array.isArray(result)) {
      const handles = result as Handle<Promise<void>>[];
      const promises = handles.map((h) => this.refs.handles.deleteHandle(h));
      await Promise.all(promises);
    } else {
      const errorHdl = result as Handle<Error>;
      throw this.refs.handles.deleteHandle(errorHdl);
    }
  }

  /**
   * Close all resources and shut down the service.
   * Any subsequent calls on the service will result in errors.
   * @returns The promise of externals services shutdowns
   */
  close(): Promise<unknown> {
    this.refs.setFork(this.forkName);
    const result = this.refs.runWithGC(() => {
      return this.refs
        .json()
        .importJSON(this.refs.binding.SkipRuntime_closeService(), true);
    });
    if (Array.isArray(result)) {
      const handles = result as Handle<Promise<void>>[];
      const promises = handles.map((h) => this.refs.handles.deleteHandle(h));
      return Promise.all(promises);
    } else {
      const errorHdl = result as Handle<Error>;
      return Promise.reject(this.refs.handles.deleteHandle(errorHdl));
    }
  }

  /**
   * Fork the service with current specified name.
   * @param name - the name of the fork.
   * @returns The forked ServiceInstance
   */
  private fork(name: string): ServiceInstance {
    if (this.forkName) throw new Error(`Unable to fork ${this.forkName}.`);
    this.refs.setFork(this.forkName);
    this.refs.fork(name);
    return new ServiceInstance(this.refs, name);
  }

  private merge(): void {
    if (!this.forkName) throw new Error("Unable to merge fork on main.");
    this.refs.setFork(this.forkName);
    this.refs.merge();
  }

  private abortFork(): void {
    if (!this.forkName) throw new Error("Unable to abord fork on main.");
    this.refs.setFork(this.forkName);
    this.refs.abortFork();
  }
}

class ValuesImpl<T> implements Values<T> {
  /* Lazy Iterable/Sequence: values are generated from
    the Iterator pointer and stored in materialized.
    Once finished the pointer is nullified. */
  private readonly materialized: (T & DepSafe)[] = [];

  constructor(
    private readonly data: DataConverter,
    private readonly binding: FromBinding,
    private pointer: Pointer<Internal.NonEmptyIterator> | null,
  ) {
    this.pointer = pointer;
  }

  private next(): Nullable<T & DepSafe> {
    if (this.pointer === null) {
      return null;
    }

    const v = this.data.importOptJSON(
      this.binding.SkipRuntime_NonEmptyIterator__next(this.pointer),
    ) as Nullable<T & DepSafe>;

    if (v === null) {
      this.pointer = null;
    } else {
      this.materialized.push(v);
    }
    return v;
  }

  getUnique(_default?: { ifMany?: T }): T & DepSafe {
    if (this.materialized.length < 1) {
      this.next();
    }
    const first = this.materialized[0];
    if (
      first === undefined /* i.e. this.materialized.length == 0 */ ||
      this.materialized.length >= 2 ||
      this.next() !== null
    ) {
      if (_default?.ifMany !== undefined) return deepFreeze(_default.ifMany);
      throw new SkipNonUniqueValueError();
    }
    return first;
  }

  toArray(): (T & DepSafe)[] {
    while (this.next() !== null);
    return this.materialized;
  }

  [Symbol.iterator](): Iterator<T & DepSafe> {
    let i = 0;
    const next = (): IteratorResult<T & DepSafe> => {
      // Invariant: this.materialized.length >= i
      let value = this.materialized[i];
      if (value === undefined /* i.e. this.materialized.length == i */) {
        const next = this.next();
        if (next === null) {
          return { value: null, done: true };
        }
        value = next;
      }
      i++;
      return { value };
    };

    return { next };
  }
}

export class ToBinding {
  private readonly stack: Stack;
  private skjson?: JsonConverter;
  private skdata?: DataConverter;
  private forkName: Nullable<string>;
  readonly handles: Handles;

  constructor(
    public binding: FromBinding,
    public runWithGC: <T>(fn: () => T) => T,
    private getConverter: (
      eagerCollectionBuilder: (
        object: Exportable<never>,
      ) => EagerCollection<Json, Data>,
      lazyCollectionBuilder: (
        object: Exportable<never>,
      ) => LazyCollection<Json, Json>,
    ) => [JsonConverter, DataConverter],
    private getError: (skExc: Pointer<Internal.Exception>) => Error,
  ) {
    this.stack = new Stack();
    this.handles = new Handles();
    this.forkName = null;
  }

  register<T>(v: T): Handle<T> {
    return this.handles.register(v);
  }

  deleteHandle<T>(id: Handle<T>): T {
    return this.handles.deleteHandle(id);
  }

  SkipRuntime_getErrorHdl(exn: Pointer<Internal.Exception>): Handle<Error> {
    return this.handles.register(this.getError(exn));
  }

  SkipRuntime_pushContext(context: Pointer<Internal.Context>): void {
    this.stack.push(context);
  }

  SkipRuntime_popContext(): void {
    this.stack.pop();
  }

  SkipRuntime_getContext(): Nullable<Pointer<Internal.Context>> {
    return this.stack.get();
  }

  SkipRuntime_getFork(): Nullable<string> {
    return this.forkName;
  }

  setFork(name: Nullable<string>): void {
    this.forkName = name;
  }

  // Mapper

  SkipRuntime_Mapper__mapEntry(
    skmapper: Handle<DataMapper>,
    key: Pointer<Internal.CJSON>,
    values: Pointer<Internal.NonEmptyIterator>,
  ): Pointer<Internal.CJArray> {
    const data = this.getDataConverter();
    const json = this.getJsonConverter();

    const mapper = this.handles.get(skmapper);
    const context = new ContextImpl(this);
    const result = mapper.mapEntry(
      json.importJSON(key) as Json,
      new ValuesImpl<Json>(data, this.binding, values),
      context,
    );
    return json.exportJSON(Array.from(result));
  }

  SkipRuntime_deleteMapper(mapper: Handle<DataMapper>): void {
    this.handles.deleteHandle(mapper);
  }

  // LazyCompute

  SkipRuntime_LazyCompute__compute(
    sklazyCompute: Handle<JSONLazyCompute>,
    self: string,
    skkey: Pointer<Internal.CJSON>,
  ): Pointer<Internal.CJArray> {
    const skjson = this.getJsonConverter();
    const lazyCompute = this.handles.get(sklazyCompute);
    const context = new ContextImpl(this);
    const result = lazyCompute.compute(
      new LazyCollectionImpl<Json, Json>(self, this),
      skjson.importJSON(skkey) as Json,
      context,
    );
    return skjson.exportJSON(Array.from(result));
  }

  SkipRuntime_deleteLazyCompute(lazyCompute: Handle<JSONLazyCompute>): void {
    this.handles.deleteHandle(lazyCompute);
  }

  // Resource

  SkipRuntime_Resource__instantiate(
    skresource: Handle<Resource>,
    skcollections: Pointer<Internal.CJObject>,
  ): string {
    const skjson = this.getJsonConverter();
    const resource = this.handles.get(skresource);
    const collections: NamedCollections = {};
    const keysIds = skjson.importJSON(skcollections) as {
      [key: string]: string;
    };
    for (const [key, name] of Object.entries(keysIds)) {
      collections[key] = new EagerCollectionImpl<Json, Data>(name, this);
    }
    const collection = resource.instantiate(collections, new ContextImpl(this));
    return EagerCollectionImpl.getName(collection);
  }

  SkipRuntime_deleteResource(resource: Handle<Resource>): void {
    this.handles.deleteHandle(resource);
  }

  // ResourceBuilder

  SkipRuntime_ResourceBuilder__build(
    skbuilder: Handle<ResourceBuilder>,
    skparams: Pointer<Internal.CJObject>,
  ): Pointer<Internal.Resource> {
    const skjson = this.getJsonConverter();
    const builder = this.handles.get(skbuilder);
    const resource = builder.build(skjson.importJSON(skparams) as Json);
    return this.binding.SkipRuntime_createResource(
      this.handles.register(resource),
    );
  }

  SkipRuntime_deleteResourceBuilder(builder: Handle<ResourceBuilder>): void {
    this.handles.deleteHandle(builder);
  }

  // Service

  SkipRuntime_Service__createGraph(
    skservice: Handle<SkipService>,
    skcollections: Pointer<Internal.CJObject>,
  ): Pointer<Internal.CJObject> {
    const skjson = this.getJsonConverter();
    const service = this.handles.get(skservice);
    const collections: NamedInputs = {};
    const keysIds = skjson.importJSON(skcollections) as {
      [key: string]: string;
    };
    for (const [key, name] of Object.entries(keysIds)) {
      collections[key] = new EagerCollectionImpl<Json, Json>(name, this);
    }
    const result = service.createGraph(collections, new ContextImpl(this));
    const collectionsNames: { [name: string]: string } = {};
    for (const [name, collection] of Object.entries(result)) {
      collectionsNames[name] = EagerCollectionImpl.getName(collection);
    }
    return skjson.exportJSON(collectionsNames);
  }

  SkipRuntime_deleteService(service: Handle<SkipService>): void {
    this.handles.deleteHandle(service);
  }

  // Notifier

  SkipRuntime_Notifier__subscribed<K extends Json, V extends Json>(
    sknotifier: Handle<Notifier<K, V>>,
  ): void {
    const notifier = this.handles.get(sknotifier);
    notifier.subscribed();
  }

  SkipRuntime_Notifier__notify<K extends Json, V extends Json>(
    sknotifier: Handle<Notifier<K, V>>,
    skvalues: Pointer<Internal.CJArray<Internal.CJArray<Internal.CJSON>>>,
    watermark: Watermark,
    isUpdates: number,
  ) {
    const skjson = this.getJsonConverter();
    const notifier = this.handles.get(sknotifier);
    const values = skjson.importJSON(skvalues, true) as Entry<K, V>[];
    const isInitial = isUpdates ? false : true;
    notifier.notify({
      values,
      watermark,
      isInitial,
    });
  }

  SkipRuntime_Notifier__close<K extends Json, V extends Json>(
    sknotifier: Handle<Notifier<K, V>>,
  ): void {
    const notifier = this.handles.get(sknotifier);
    notifier.close();
  }

  SkipRuntime_deleteNotifier<K extends Json, V extends Json>(
    notifier: Handle<Notifier<K, V>>,
  ): void {
    this.handles.deleteHandle(notifier);
  }

  // Reducer

  SkipRuntime_Reducer__add(
    skreducer: Handle<Reducer<Data, Json>>,
    skacc: Nullable<Pointer<Internal.CJSON>>,
    skvalue: Pointer<Internal.CJSON>,
  ): Pointer<Internal.CJSON> {
    const json = this.getJsonConverter();
    const data = this.getDataConverter();
    const reducer = this.handles.get(skreducer);
    const value = data.importJSON(skvalue) as Data & DepSafe;
    const acc = json.importOptJSON(skacc) as Nullable<Json>;
    const result = reducer.add(acc, value);
    return json.exportJSON(result);
  }

  SkipRuntime_Reducer__remove(
    skreducer: Handle<Reducer<Data, Json>>,
    skacc: Pointer<Internal.CJSON>,
    skvalue: Pointer<Internal.CJSON>,
  ): Pointer<Internal.CJSON> {
    const json = this.getJsonConverter();
    const data = this.getDataConverter();
    const reducer = this.handles.get(skreducer);
    const value = data.importJSON(skvalue) as Data & DepSafe;
    const acc = json.importJSON(skacc) as Json;
    const result = reducer.remove(acc, value);
    return json.exportJSON(result);
  }

  SkipRuntime_deleteReducer(reducer: Handle<Reducer<Data, Json>>): void {
    this.handles.deleteHandle(reducer);
  }

  // ExternalService

  SkipRuntime_ExternalService__subscribe(
    sksupplier: Handle<ExternalService>,
    writerId: string,
    instance: string,
    resource: string,
    skparams: Pointer<Internal.CJObject>,
  ): Handle<Promise<void>> {
    const skjson = this.getJsonConverter();
    const supplier = this.handles.get(sksupplier);
    const writer = new CollectionWriter(writerId, this, this.forkName);
    const params = skjson.importJSON(skparams, true) as Json;
    // Ensure notification is made outside the current context update
    return this.handles.register(
      new Promise((resolve, reject) => {
        setTimeout(() => {
          supplier
            .subscribe(instance, resource, params, {
              update: writer.update.bind(writer),
              error: (_) => {},
            })
            .then(resolve)
            .catch(reject);
        }, 0);
      }),
    );
  }

  SkipRuntime_ExternalService__unsubscribe(
    sksupplier: Handle<ExternalService>,
    instance: string,
  ): void {
    const supplier = this.handles.get(sksupplier);
    supplier.unsubscribe(instance);
  }

  SkipRuntime_ExternalService__shutdown(
    sksupplier: Handle<ExternalService>,
  ): Handle<Promise<void>> {
    const supplier = this.handles.get(sksupplier);
    return this.handles.register(supplier.shutdown());
  }

  SkipRuntime_deleteExternalService(supplier: Handle<ExternalService>): void {
    this.handles.deleteHandle(supplier);
  }

  // Executor

  async initService(service: SkipService): Promise<ServiceInstance> {
    this.setFork(null);
    await this.runAsync(() => {
      const skExternalServices =
        this.binding.SkipRuntime_ExternalServiceMap__create();
      if (service.externalServices) {
        for (const [name, remote] of Object.entries(service.externalServices)) {
          const skremote = this.binding.SkipRuntime_createExternalService(
            this.handles.register(remote),
          );
          this.binding.SkipRuntime_ExternalServiceMap__add(
            skExternalServices,
            name,
            skremote,
          );
        }
      }
      const skresources = this.binding.SkipRuntime_ResourceBuilderMap__create();
      for (const [name, builder] of Object.entries(service.resources)) {
        const skbuilder = this.binding.SkipRuntime_createResourceBuilder(
          this.handles.register(new ResourceBuilder(builder)),
        );
        this.binding.SkipRuntime_ResourceBuilderMap__add(
          skresources,
          name,
          skbuilder,
        );
      }
      const skservice = this.binding.SkipRuntime_createService(
        this.handles.register(service),
        this.json().exportJSON(service.initialData ?? {}),
        skresources,
        skExternalServices,
      );
      return this.binding.SkipRuntime_initService(skservice);
    });
    return new ServiceInstance(this, null);
  }

  //
  private buildEagerCollection(object: Exportable<never>) {
    return new EagerCollectionImpl<Json, Data>(
      (object as CJObject<never>)["collection"] as string,
      this,
    );
  }

  private buildLazyCollection(object: Exportable<never>) {
    return new LazyCollectionImpl<Json, Json>(
      (object as CJObject<never>)["collection"] as string,
      this,
    );
  }

  private checkConverters() {
    if (this.skdata == undefined || this.skjson == undefined) {
      [this.skjson, this.skdata] = this.getConverter(
        this.buildEagerCollection.bind(this),
        this.buildLazyCollection.bind(this),
      );
    }
  }

  private getJsonConverter() {
    this.checkConverters();
    return this.skjson!;
  }

  private getDataConverter() {
    this.checkConverters();
    return this.skdata!;
  }

  public needGC() {
    return this.SkipRuntime_getContext() == null;
  }

  public json() {
    return this.getJsonConverter();
  }

  public data() {
    return this.getDataConverter();
  }

  fork(name: string): void {
    const errorHdl = this.runWithGC(() =>
      this.binding.SkipRuntime_Runtime__fork(name),
    );
    if (errorHdl) throw this.handles.deleteHandle(errorHdl);
  }

  merge(): void {
    const errorHdl = this.runWithGC(() =>
      this.binding.SkipRuntime_Runtime__merge(),
    );
    if (errorHdl) throw this.handles.deleteHandle(errorHdl);
  }

  abortFork(): void {
    const errorHdl = this.runWithGC(() =>
      this.binding.SkipRuntime_Runtime__abortFork(),
    );
    if (errorHdl) throw this.handles.deleteHandle(errorHdl);
  }

  async runAsync(fn: () => Pointer<Internal.CJSON>): Promise<void> {
    const result = this.runWithGC(() => {
      return this.json().importJSON(fn(), true);
    });
    if (Array.isArray(result)) {
      const handles = result as Handle<Promise<void>>[];
      const promises = handles.map((h) => this.handles.deleteHandle(h));
      await Promise.all(promises);
    } else {
      const errorHdl = result as Handle<Error>;
      throw this.handles.deleteHandle(errorHdl);
    }
  }
}

const EagerCollectionType = "SkipRuntime.EagerCollection" as CJType;
const LazyCollectionType = "SkipRuntime.LazyCollection" as CJType;

export class JconConverterWithCollections
  implements
    TypedConverter<EagerCollection<Json, Data> | LazyCollection<Json, Json>>
{
  constructor(
    private predefined: CJConverter<never>,
    private eagerCollectionBuilder: (
      object: Exportable<never>,
    ) => EagerCollection<Json, Data>,
    private lazyCollectionBuilder: (
      object: Exportable<never>,
    ) => LazyCollection<Json, Json>,
  ) {}

  import(
    type: CJType,
    value: Pointer<Internal.CJSON>,
  ): EagerCollection<Json, Data> | LazyCollection<Json, Json> {
    if (type !== EagerCollectionType && type !== LazyCollectionType) {
      throw new SkipError(`Unknown Json custom type ${type}`);
    }
    const object = this.predefined.importJSON(value);
    if (type === EagerCollectionType) {
      return this.eagerCollectionBuilder(object);
    }
    return this.lazyCollectionBuilder(object);
  }

  export(
    value: CJObject<EagerCollection<Json, Data> | LazyCollection<Json, Json>>,
  ): [Nullable<CJType>, JsonObject] {
    if (value instanceof EagerCollectionImpl) {
      return [EagerCollectionType, value.toJSON()];
    } else if (value instanceof LazyCollectionImpl) {
      return [LazyCollectionType, value.toJSON()];
    } else {
      return [LazyCollectionType, value as JsonObject];
    }
  }
}
