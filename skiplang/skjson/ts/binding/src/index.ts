import * as Internal from "./internal.js";
import { Type, type Binding, type CJType } from "./binding.js";
import type { Pointer, Nullable } from "../skiplang-std/index.js";
export type { Pointer, Nullable, Binding, CJType };
export { Type };

export const sk_isObjectProxy: unique symbol = Symbol();
export const sk_managed: unique symbol = Symbol.for("Skip.managed");

/**
 * Values that are either unmodifiable or tracked by the Skip Runtime.
 *
 * A `Managed` value is either managed by the Skip Runtime, in which case its modifications are carefully tracked by the reactive computation system, or it is deep-frozen, meaning that it cannot be modified and neither can its sub-objects, recursively.
 * See `deepFreeze` to make an object `Managed`.
 *
 * `Managed` values are important because they can be used in code that will be executed by the reactive computation system without introducing the possibility of stale or unreproducible results.
 */
export type Managed = {
  /**
   * @ignore
   * @hidden
   */
  [sk_managed]: true;
};

export abstract class Frozen implements Managed {
  // tsc misses that Object.defineProperty in the constructor inits this
  [sk_managed]!: true;

  constructor() {
    this.freeze();
  }

  protected abstract freeze(): void;
}

export function sk_freeze<T extends object>(x: T): T & Managed {
  return Object.defineProperty(x, sk_managed, {
    enumerable: false,
    writable: false,
    value: true,
  }) as T & Managed;
}

export function isSkManaged(x: any): x is Managed {
  return sk_managed in x && x[sk_managed] === true;
}

export abstract class SkManaged extends Frozen {
  protected freeze() {
    sk_freeze(this);
  }
}

/**
 * A `DepSafe` value is _dependency-safe_ and can be used safely in reactive computations.
 *
 * A value can be safely used as a dependency of a reactive computation if it is:
 * 1. a primitive JavaScript value (boolean, number, string, etc.)
 * 2. managed by the Skip runtime, which will correctly track dependencies, or
 * 3. a deep-frozen and therefore constant JavaScript object.
 *
 * Values used in reactive computations must be dependency-safe so that reactive computations can be reevaluated as needed with consistent semantics.
 *
 * All objects/values that come _out_ of the Skip runtime are dependency-safe.
 * Non-Skip objects can be made dependency-safe by passing them to `deepFreeze`, which recursively freezes their fields and returns a constant `Managed` object.
 */
export type DepSafe =
  | null
  | boolean
  | number
  | bigint
  | string
  | symbol
  | Managed;

export function checkOrCloneParam<T>(value: T): T {
  if (
    typeof value == "boolean" ||
    typeof value == "number" ||
    typeof value == "string"
  )
    return value;
  if (typeof value == "object") {
    if (value === null) return value;
    if (isObjectProxy(value)) return value.clone() as T;
    if (isSkManaged(value)) return value;
    throw new Error("Invalid object: must be deep-frozen.");
  }
  throw new Error(`'${typeof value}' cannot be deep-frozen.`);
}

/**
 * _Deep-freeze_ an object, making it dependency-safe.
 *
 * This function is similar to {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze | Object.freeze()} but freezes the object and deep-freezes all its properties, recursively.
 * The object is then not only _immutable_ but also _constant_.
 * Note that as a result all objects reachable from the parameter will be frozen and no longer mutable or extensible, even from other references.
 *
 * The argument object and all its properties, recursively, must not already be frozen by `Object.freeze` (or else `deepFreeze` cannot mark them deep-frozen).
 * Undefined, function (and hence class) values cannot be deep-frozen.
 *
 * The primary use for this function is to satisfy the requirement that all parameters to Skip `Mapper` or `Reducer` constructors must be dependency-safe: objects that have not been constructed by Skip can be passed to `deepFreeze()` before passing them to a `Mapper` or `Reducer` constructor.
 *
 * @typeParam T - Type of value to deep-freeze.
 * @param value - The object to deep-freeze.
 * @returns The same object that was passed in.
 */
export function deepFreeze<T>(value: T): T & DepSafe {
  if (
    typeof value == "boolean" ||
    typeof value == "number" ||
    typeof value == "bigint" ||
    typeof value == "string" ||
    typeof value == "symbol"
  ) {
    return value;
  } else if (typeof value == "object") {
    if (value === null) {
      return value;
    } else if (isSkManaged(value)) {
      return value;
    } else if (Object.isFrozen(value)) {
      throw new Error(`Cannot deep-freeze an Object.frozen value.`);
    } else if (Array.isArray(value)) {
      for (const elt of value) {
        deepFreeze(elt);
      }
      return Object.freeze(sk_freeze(value));
    } else {
      for (const val of Object.values(value)) {
        deepFreeze(val);
      }
      return Object.freeze(sk_freeze(value));
    }
  } else {
    // typeof value == "function" || typeof value == "undefined"
    throw new Error(`'${typeof value}' values cannot be deep-frozen.`);
  }
}

/**
 * JSON-serializable values.
 *
 * The `Json` type describes JSON-serializable values and serves as an upper bound on keys and values in the Skip Runtime, ensuring that they can be serialized and managed by the reactive computation engine.
 *
 * `Json` values are compared by the Skip Runtime in the following way:
 * - null < false < true < numbers < strings < arrays < objects
 * - strings are compared lexicographically
 * - arrays are compared lexicographically
 * - objects are compared lexicographically based on their key-value pairs ordered by keys
 */
export type Json<T> =
  | boolean
  | number
  | string
  | (Json<T> | null)[]
  | JsonObject<T>
  | T;

/**
 * Objects containing `Json` values.
 */
export type JsonObject<T> = { [key: string]: Json<T> | null };

export type Exportable<T> =
  | null
  | undefined
  | Json<T>
  | ObjectProxy<T, { [k: string]: Exportable<T> }>
  | (readonly Exportable<T>[] & Managed);

export type ObjectProxy<T, Base extends { [k: string]: Exportable<T> }> = {
  [sk_isObjectProxy]: true;
  [sk_managed]: true;
  __pointer: Pointer<Internal.CJSON>;
  clone: () => ObjectProxy<T, Base>;
  toJSON: () => Base;
  keys: IterableIterator<keyof Base>;
} & Base;

export interface TypedConverter<T> {
  import(c: CJType, value: Pointer<Internal.CJSON>): T | undefined;
  export(value: Exportable<T>): [Nullable<CJType>, JsonObject<never>];
}

export function isObjectProxy<T>(
  x: any,
): x is ObjectProxy<T, { [k: string]: Exportable<T> }> {
  return sk_isObjectProxy in x && (x[sk_isObjectProxy] as boolean);
}

export const reactiveObject = {
  get<T, Base extends { [k: string]: Exportable<T> }>(
    hdl: ObjectHandle<T, Internal.CJObjectBase>,
    prop: string | symbol,
    self: ObjectProxy<T, Base>,
  ): any {
    if (prop === sk_isObjectProxy) return true;
    if (prop === sk_managed) return true;
    if (prop === "__pointer") return hdl.pointer;
    if (prop === "clone") return (): ObjectProxy<T, Base> => clone(self);
    if (prop === "toJSON") return hdl.toJSON.bind(hdl);
    if (prop === "toString") return hdl.toString.bind(hdl);
    if (prop === "keys") return hdl.keys();
    if (typeof prop === "symbol") return undefined;
    return hdl.get(prop);
  },
  set<T>(
    _hdl: ObjectHandle<T, Internal.CJObjectBase>,
    _prop: string | symbol,
    _value: any,
  ) {
    throw new Error("Reactive object cannot be modified.");
  },
  has<T>(
    hdl: ObjectHandle<T, Internal.CJObjectBase>,
    prop: string | symbol,
  ): boolean {
    if (prop === sk_isObjectProxy) return true;
    if (prop === sk_managed) return true;
    if (prop === "__pointer") return true;
    if (prop === "clone") return true;
    if (prop === "keys") return true;
    if (prop === "toJSON") return true;
    if (prop === "toString") return true;
    if (typeof prop === "symbol") return false;
    return hdl.has(prop);
  },
  ownKeys<T>(hdl: ObjectHandle<T, Internal.CJObjectBase>) {
    return Array.from(hdl.keys());
  },
  getOwnPropertyDescriptor<T>(
    hdl: ObjectHandle<T, Internal.CJObjectBase>,
    prop: string | symbol,
  ) {
    if (typeof prop === "symbol") return undefined;
    return hdl.getOwnPropertyDescriptor(prop);
  },
};

export function clone<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(clone) as T;
    } else if (isObjectProxy(value)) {
      return Object.fromEntries(
        Array.from(value.keys).map((k) => [k, clone(value[k])]),
      ) as T;
    } else {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]): [string, any] => [k, clone(v)]),
      ) as T;
    }
  } else {
    return value;
  }
}

function interpretPointer<T1, T extends Internal.CJSON>(
  binding: Binding,
  pointer: Nullable<Pointer<T>>,
  conv?: TypedConverter<T1>,
): Exportable<T1> {
  if (pointer === null) return null;
  let cjtype = binding.SKIP_SKJSON_typeOf(pointer);
  if (typeof cjtype == "string") {
    if (conv) {
      const res = conv.import(cjtype, pointer);
      if (res) return res;
      console.log(
        "interpretPointer",
        cjtype,
        res,
        new Error("Missing convertion"),
      );
      cjtype = Type.Object;
    } else {
      cjtype = Type.Object;
    }
  }
  switch (cjtype) {
    case Type.Null:
      return null;
    case Type.Boolean:
      return binding.SKIP_SKJSON_asBoolean(pointer);
    case Type.Int:
    case Type.Float:
      return binding.SKIP_SKJSON_asNumber(pointer);
    case Type.String:
      return binding.SKIP_SKJSON_asString(pointer);
    case Type.Array: {
      const aPtr = binding.SKIP_SKJSON_asArray(pointer);
      const length = binding.SKIP_SKJSON_arraySize(aPtr);
      const array = Array.from({ length }, (_, idx) =>
        interpretPointer<T1, Internal.CJSON>(
          binding,
          binding.SKIP_SKJSON_at(aPtr, idx),
          conv,
        ),
      );
      return sk_freeze(array);
    }
    case Type.Object: {
      const oPtr = binding.SKIP_SKJSON_asObject(pointer);
      return new Proxy(
        new ObjectHandle<T1, Internal.CJObjectBase>(binding, oPtr, conv),
        reactiveObject,
      ) as unknown as ObjectProxy<T1, { [k: string]: Exportable<T1> }>;
    }
    case Type.Undefined:
    default:
      return undefined;
  }
}

class ObjectHandle<T1, T extends Internal.CJObjectBase> {
  private fields?: Map<string, number>;

  constructor(
    private readonly binding: Binding,
    public readonly pointer: Pointer<T>,
    private readonly conv?: TypedConverter<T1>,
  ) {}

  private getFieldAt(idx: number): Exportable<T1> {
    return interpretPointer(
      this.binding,
      this.binding.SKIP_SKJSON_get(this.pointer, idx),
      this.conv,
    );
  }

  private objectFields() {
    if (!this.fields) {
      this.fields = new Map();
      const size = this.binding.SKIP_SKJSON_objectSize(this.pointer);
      for (let i = 0; i < size; i++) {
        const field = this.binding.SKIP_SKJSON_fieldAt(this.pointer, i);
        if (!field) break;
        this.fields.set(field, i);
      }
    }
    return this.fields;
  }

  toJSON() {
    return Object.fromEntries(
      Array.from(this.objectFields()).map(([k, ptr]) => [
        k,
        this.getFieldAt(ptr),
      ]),
    );
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  // Hijacks NodeJS' console.log
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toString();
  }

  keys() {
    return this.objectFields().keys();
  }

  get(prop: string) {
    const idx = this.objectFields().get(prop);
    if (idx === undefined) return undefined;
    return this.getFieldAt(idx);
  }

  has(prop: string) {
    return this.objectFields().has(prop);
  }

  getOwnPropertyDescriptor(prop: string) {
    const idx = this.objectFields().get(prop);
    if (idx === undefined) return undefined;
    const value = this.getFieldAt(idx);
    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value,
    };
  }
}

export function exportJSON<T>(
  binding: Binding,
  value: Exportable<T>,
  conv?: TypedConverter<T>,
): Pointer<Internal.CJSON> {
  if (value === null || value === undefined) {
    return binding.SKIP_SKJSON_createCJNull();
  } else if (typeof value == "boolean") {
    return binding.SKIP_SKJSON_createCJBool(value);
  } else if (typeof value == "number") {
    if (value === Math.trunc(value)) {
      return binding.SKIP_SKJSON_createCJInt(value);
    } else {
      return binding.SKIP_SKJSON_createCJFloat(value);
    }
  } else if (typeof value == "string") {
    return binding.SKIP_SKJSON_createCJString(value);
  } else if (Array.isArray(value)) {
    const arr = binding.SKIP_SKJSON_startCJArray();
    value.forEach((v) => {
      binding.SKIP_SKJSON_addToCJArray(arr, exportJSON(binding, v, conv));
    });
    return binding.SKIP_SKJSON_endCJArray(arr);
  } else if (typeof value == "object") {
    if (isObjectProxy(value)) {
      return value.__pointer;
    } else {
      const [type, object] = conv ? conv.export(value) : [null, value];
      const obj = binding.SKIP_SKJSON_startCJObject();
      Object.entries(object).forEach(([key, val]) => {
        binding.SKIP_SKJSON_addToCJObject(
          obj,
          key,
          exportJSON(binding, val, conv),
        );
      });
      if (type) {
        return binding.SKIP_SKJSON_createCJTyped(obj, type);
      } else {
        return binding.SKIP_SKJSON_endCJObject(obj);
      }
    }
  } else {
    throw new Error(`'${typeof value}' cannot be exported to wasm.`);
  }
}

export function importJSON<T1, T extends Internal.CJSON>(
  binding: Binding,
  pointer: Pointer<T>,
  conv?: TypedConverter<T1>,
  copy?: boolean,
): Exportable<T1> {
  const value = interpretPointer<T1, T>(binding, pointer, conv);
  return copy && value !== null ? clone(value) : value;
}

export interface JsonConverter<T> {
  importJSON(value: Pointer<Internal.CJSON>, copy?: boolean): Exportable<T>;
  exportJSON(v: null | undefined): Pointer<Internal.CJNull>;
  exportJSON(v: boolean): Pointer<Internal.CJBool>;
  exportJSON(v: number): Pointer<Internal.CJFloat | Internal.CJInt>;
  exportJSON(v: string): Pointer<Internal.CJString>;
  exportJSON(v: any[]): Pointer<Internal.CJArray>;
  exportJSON(v: JsonObject<T>): Pointer<Internal.CJObject>;
  exportJSON(v: Nullable<Json<T>>): Pointer<Internal.CJSON>;
  exportJSON<T extends Internal.CJSON>(
    v: ObjectProxy<T, { [k: string]: Exportable<T> }> & {
      __pointer: Pointer<T>;
    },
  ): Pointer<T>;
  importOptJSON(
    value: Nullable<Pointer<Internal.CJSON>>,
    copy?: boolean,
  ): Exportable<T>;
  is(v: Pointer<Internal.CJSON>, type: Type): boolean;
  clone<T>(v: T): T;
  derive<T1>(conv: TypedConverter<T1>): JsonConverter<T1>;
  strict(): JsonConverter<never>;
}

export class JsonConverterImpl<T> implements JsonConverter<T> {
  constructor(
    private binding: Binding,
    private conv?: TypedConverter<T>,
  ) {}

  importJSON(value: Pointer<Internal.CJSON>, copy?: boolean): Exportable<T> {
    return importJSON(this.binding, value, this.conv, copy);
  }

  exportJSON(v: Exportable<T> | Exportable<never>): Pointer<Internal.CJSON> {
    return exportJSON(this.binding, v, this.conv);
  }

  public clone<T>(v: T): T {
    return clone(v);
  }

  public is(v: Pointer<Internal.CJSON>, type: Type | CJType): boolean {
    return this.binding.SKIP_SKJSON_typeOf(v) == type;
  }

  importOptJSON(
    value: Nullable<Pointer<Internal.CJSON>>,
    copy?: boolean,
  ): Exportable<T> {
    if (value === null) {
      return null;
    }
    return this.importJSON(value, copy);
  }

  derive<T1>(conv: TypedConverter<T1>): JsonConverter<T1> {
    return new JsonConverterImpl(this.binding, conv);
  }

  strict(): JsonConverter<never> {
    return new JsonConverterImpl<never>(this.binding);
  }
}

export function buildJsonConverter<T>(
  binding: Binding,
  conv?: TypedConverter<T>,
): JsonConverter<T> {
  return new JsonConverterImpl<T>(binding, conv);
}
