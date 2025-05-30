import type * as Internal from "../skiplang-std/internal.js";
import type { Pointer, float, int, Nullable } from "../skiplang-std/index.js";
import { cloneIfProxy } from "../skiplang-std/index.js";

export type { float, int, Nullable, Pointer };

export type ptr<InternalType extends Internal.T<any>> = Internal.Opaque<
  number,
  InternalType
> &
  Pointer<InternalType>;

export function toPtr<T extends Internal.T<any>>(pointer: Pointer<T>): ptr<T> {
  return pointer as ptr<T>;
}

export function toNullablePtr<T extends Internal.T<any>>(
  pointer: Nullable<Pointer<T>>,
): Nullable<ptr<T>> {
  return pointer ? (pointer as ptr<T>) : null;
}

export function toNullablePointer<T extends Internal.T<any>>(
  ptrVal: Nullable<ptr<T>>,
): Nullable<Pointer<T>> {
  return ptrVal !== null && ptrVal != 0 ? ptrVal : null;
}

export enum Stream {
  OUT,
  ERR,
  DEBUG,
}

export class State {
  exceptionId = 0;
  exceptions = new Map<int, Exception>();
}

export class Exception {
  id: int;
  err: Error;

  constructor(err: Error, state: State) {
    this.id = ++state.exceptionId;
    this.err = err;
    state.exceptions.set(this.id, this);
  }
}

class SkRuntimeExit extends Error {
  code: int;

  constructor(code: int, message?: string) {
    super(message ?? `Runtime exit with code: ${code}`);
    this.code = code;
  }
}

class SkError extends Error {}

export interface Shared {
  getName: () => string;
}

const O_RDONLY = 0;
const O_WRONLY = 1;
const O_RDWR = 2;
const O_CREAT = 100;
const O_EXCL = 200;
const O_TRUNC = 1000;
const O_APPEND = 4000;

export class Options {
  constructor(
    public read: boolean = true,
    public write: boolean = false,
    public append: boolean = false,
    public truncate: boolean = false,
    public create: boolean = true,
    public create_new: boolean = false,
  ) {}

  static w() {
    return new Options(false, true);
  }

  toFlags() {
    let res = 0;
    if (this.read && this.write) {
      res = O_RDWR;
    } else if (this.read) {
      res = O_RDONLY;
    } else if (this.write) {
      res = O_WRONLY;
    } else {
      return -1;
    }

    if (this.append) {
      res |= O_APPEND;
    }
    if (this.truncate) {
      res |= O_TRUNC;
    }
    if (this.create) {
      res |= O_CREAT;
    }
    if (this.create_new) {
      res |= O_EXCL;
    }
    return res;
  }

  static fromFlags(flags: int) {
    const is = (flags: int, value: int) => {
      return (flags & value) == value;
    };
    return new Options(
      !is(flags, O_WRONLY),
      is(flags, O_WRONLY) || is(flags, O_RDWR),
      is(flags, O_APPEND),
      is(flags, O_TRUNC),
      is(flags, O_CREAT),
      is(flags, O_EXCL),
    );
  }
}

export interface FileSystem {
  openFile(filename: string, flags: Options, mode: int): number;
  closeFile(fd: int): void;
  watchFile(filename: string, f: (change: string) => void): void;
  writeToFile(fd: int, content: string): void;
  appendToFile(filename: string, content: string): void;
  write(fd: int, content: string): int;
  read(fd: int, len: int): string | null;
  exists(filename: string): boolean;
}

export interface System {
  setenv(name: string, value: string): void;
  getenv(name: string): string | null;
  unsetenv(name: string): void;
}

export interface Environment {
  shared: Map<string, Shared>;
  name: () => string;
  disableWarnings: boolean;
  environment: string[];
  timestamp: () => float;
  decodeUTF8: (utf8: ArrayBuffer) => string;
  encodeUTF8: (str: string) => Uint8Array;
  onException: () => void;
  base64Decode: (base64: string) => Uint8Array;
  base64Encode: (toEncode: string, url?: boolean) => string;
  fs: () => FileSystem;
  sys: () => System;
  crypto: () => Crypto;
  fetch: (url: URL | string) => Promise<Uint8Array | ArrayBuffer>;
}

export interface Memory {
  buffer: ArrayBuffer;
}

interface Exported {
  SKIP_throw_EndOfFile: () => void;
  SKIP_String_byteSize: (strPtr: ptr<Internal.String>) => int;
  SKIP_Obstack_alloc: (size: int) => ptr<Internal.Raw>;
  SKIP_new_Obstack: () => ptr<Internal.Obstack>;
  SKIP_destroy_Obstack: (pos: ptr<Internal.Obstack>) => void;
  sk_string_create: (
    addr: ptr<Internal.Raw>,
    size: int,
  ) => ptr<Internal.String>;
  SKIP_createByteArray: (size: int) => ptr<Internal.Array<Internal.Byte>>;
  SKIP_createFloatArray: (size: int) => ptr<Internal.Array<Internal.Float>>;
  SKIP_createUInt32Array: (size: int) => ptr<Internal.Array<Internal.UInt32>>;
  SKIP_getArraySize: <Ty>(skArray: ptr<Internal.Array<Internal.T<Ty>>>) => int;
  SKIP_call0: <Ret>(
    fnc: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
  ) => ptr<Internal.T<Ret>>;
  SKIP_skstore_init: (size: int) => void;
  SKIP_initializeSkip: () => void;
  SKIP_skstore_end_of_init: () => void;
  SKIP_callWithException: <Ret>(
    fnc: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
    exc: int,
  ) => ptr<Internal.T<Ret>>;
  SKIP_getExceptionMessage: (
    skExc: ptr<Internal.Exception>,
  ) => ptr<Internal.String>;
  SKIP_get_persistent_size: () => int;
  SKIP_get_version: () => number;
  skip_main: () => void;
  memory: Memory;
  __heap_base: number;
}

export interface WasmSupplier {
  completeWasm: (wasm: object, utils: Utils) => void;
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export type Main = (new_args: string[], new_stdin: string) => string;

export type App = {
  environment: Environment;
  main: Main;
};

export class Utils {
  private readonly exports: Exported;
  private readonly env: Environment;
  private readonly state: State;
  private readonly states: Map<string, any>;

  args: string[];
  private current_stdin: number;
  private stdin: Uint8Array;
  private stdout: string[];
  private stderr: string[];
  private stddebug: string[];
  private readonly mainFn?: string;
  private exception?: Error;
  private stacks: Map<ptr<Internal.Exception>, string>;

  exit = (code: int) => {
    const message =
      code != 0 && this.stderr.length > 0 ? this.stderr.join("") : undefined;
    throw new SkRuntimeExit(code, message);
  };

  constructor(exports: WebAssembly.Exports, env: Environment, mainFn?: string) {
    this.stacks = new Map();
    this.states = new Map();
    this.args = [];
    this.current_stdin = 0;
    this.stdin = utf8Encode("");
    this.stdout = [];
    this.stderr = [];
    this.stddebug = [];
    this.exports = exports as any as Exported;
    this.env = env;
    this.state = new State();
    this.mainFn = mainFn;
  }
  log = (str: string, kind?: Stream, newLine: boolean = false) => {
    kind = kind ? kind : Stream.OUT;
    str += newLine ? "\n" : "";
    if (kind == Stream.DEBUG) {
      // Flush buffered this.stddebug output at newlines
      const idx = str.lastIndexOf("\n");
      if (idx == -1) this.stddebug.push(str);
      else {
        console.error(this.stddebug.join("") + str.slice(0, idx));
        this.stddebug = [str.slice(idx + 1)];
      }
    } else if (kind == Stream.ERR) {
      this.stderr.push(str);
    } else {
      this.stdout.push(str);
    }
  };
  sklog = (
    strPtr: ptr<Internal.String>,
    kind?: Stream,
    newLine: boolean = false,
  ) => {
    const str = this.importString(strPtr);
    this.log(str, kind, newLine);
  };

  clearMainEnvironment = (new_args: string[] = [], new_stdin: string = "") => {
    this.args = [this.mainFn ?? "main"].concat(new_args);
    this.exception = undefined;
    this.stacks = new Map();
    this.current_stdin = 0;
    this.stdin = utf8Encode(new_stdin);
    this.stdout = [];
    this.stderr = [];
    this.stddebug = [];
  };

  runCheckError = <T>(fn: () => T) => {
    this.clearMainEnvironment();
    const res = fn();
    if (this.stddebug.length > 0) {
      console.log(this.stddebug.join(""));
    }
    if (this.stderr.length > 0) {
      const error = new Error(this.stderr.join(""));
      (error as any).cause = this.exception;
      throw error;
    }
    return res;
  };

  main = (new_args: string[], new_stdin: string) => {
    let exitCode = 0;
    this.clearMainEnvironment(new_args, new_stdin);
    try {
      if (!this.mainFn) {
        this.exports.skip_main();
      } else {
        // @ts-expect-error: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'Exported'.
        const mainFn = this.exports[this.mainFn];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        mainFn();
      }
    } catch (exn) {
      if (exn instanceof SkRuntimeExit) {
        exitCode = exn.code;
      } else {
        if (this.exception && this.exception != exn)
          (exn as any).cause = this.exception;
        throw exn;
      }
    }
    if (this.stddebug.length > 0) {
      console.log(this.stddebug.join(""));
    }
    if (exitCode != 0 || this.stderr.length > 0) {
      const message = this.stderr.length > 0 ? this.stderr.join("") : undefined;
      let tmp = "";
      const lines: string[] = [];
      message?.split("\n").forEach((line) => {
        const matches = [...line.matchAll(/external:([0-9]+)/g)].sort(
          (v1: string[], v2: string[]) => {
            const i1 = parseInt(v1[1]!); // matched regexp has a pair of parens
            const i2 = parseInt(v2[1]!);
            if (i2 < i1) {
              return 1;
            }
            if (i2 > i1) {
              return -1;
            }
            return 0;
          },
        );
        if (matches.length > 0) {
          matches.forEach((match) => {
            line = line.replace(match[0], "");
          });
          tmp = line;
        } else {
          lines.push(tmp + line);
          tmp = "";
        }
      });
      if (tmp != "") {
        lines.push(tmp);
      }
      const error = new SkRuntimeExit(exitCode, lines.join("\n").trim());
      (error as any).cause = this.exception;
      throw error;
    }
    return this.stdout.join("");
  };

  importOptString = (strPtr: ptr<Internal.String>) => {
    if (strPtr > 0) {
      return this.importString(strPtr);
    }
    return null;
  };
  importString = (strPtr: ptr<Internal.String>) => {
    const size = this.exports.SKIP_String_byteSize(strPtr);
    const utf8 = new Uint8Array(this.exports.memory.buffer, strPtr, size);
    return this.env.decodeUTF8(utf8);
  };
  exportString = (s: string): ptr<Internal.String> => {
    const data = new Uint8Array(this.exports.memory.buffer);
    let i = 0;
    const addr = this.exports.SKIP_Obstack_alloc(s.length * 4);
    for (let ci = 0; ci != s.length; ci++) {
      let c = s.charCodeAt(ci);
      if (c < 128) {
        data[addr + i++] = c;
        continue;
      }
      if (c < 2048) {
        data[addr + i++] = (c >> 6) | 192;
      } else {
        if (c > 0xd7ff && c < 0xdc00) {
          if (++ci >= s.length)
            throw new Error("UTF-8 encode: incomplete surrogate pair");
          const c2 = s.charCodeAt(ci);
          if (c2 < 0xdc00 || c2 > 0xdfff)
            throw new Error(
              `UTF-8 encode: second surrogate character 0x${c2.toString(16)} at index ${ci} out of range`,
            );
          c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
          data[addr + i++] = (c >> 18) | 240;
          data[addr + i++] = ((c >> 12) & 63) | 128;
        } else data[addr + i++] = (c >> 12) | 224;
        data[addr + i++] = ((c >> 6) & 63) | 128;
      }
      data[addr + i++] = (c & 63) | 128;
    }
    return this.exports.sk_string_create(addr, i);
  };
  importBytes = (
    skArray: ptr<Internal.Array<Internal.Byte>>,
    sizeof: int = 1,
  ) => {
    const size = this.exports.SKIP_getArraySize(skArray) * sizeof;
    const skData = new Uint8Array(this.exports.memory.buffer, skArray, size);
    const copy = new Uint8Array(size);
    copy.set(skData);
    return copy;
  };
  importBytes2 = (skBytes: ptr<Internal.T<any>>, size: int = 1) => {
    const skData = new Uint8Array(this.exports.memory.buffer, skBytes, size);
    const copy = new Uint8Array(size);
    copy.set(skData);
    return copy;
  };
  exportBytes = (view: Uint8Array) => {
    const skArray = this.exports.SKIP_createByteArray(view.byteLength);
    const data = new Uint8Array(
      this.exports.memory.buffer,
      skArray,
      view.byteLength,
    );
    data.set(view);
    return skArray;
  };
  exportBytes2 = (view: Uint8Array, skBytes: ptr<Internal.T<any>>) => {
    const data = new Uint8Array(
      this.exports.memory.buffer,
      skBytes,
      view.byteLength,
    );
    data.set(view);
  };
  importUInt32s = (skArray: ptr<Internal.Array<Internal.UInt32>>) => {
    const size = this.exports.SKIP_getArraySize(skArray);
    const skData = new Uint32Array(this.exports.memory.buffer, skArray, size);
    const copy = new Uint32Array(size);
    copy.set(skData);
    return copy;
  };

  exportUInt32s(array: Uint32Array) {
    const skArray = this.exports.SKIP_createUInt32Array(array.length);
    const skData = new Uint32Array(
      this.exports.memory.buffer,
      skArray,
      array.length,
    );
    skData.set(array);
    return skArray;
  }
  importFloats = (skArray: ptr<Internal.Array<Internal.Float>>) => {
    const size = this.exports.SKIP_getArraySize(skArray);
    const skData = new Float64Array(this.exports.memory.buffer, skArray, size);
    const copy = new Float64Array(size);
    copy.set(skData);
    return copy;
  };

  exportFloats(array: Float64Array) {
    const skArray = this.exports.SKIP_createFloatArray(array.length);
    const skData = new Float64Array(
      this.exports.memory.buffer,
      skArray,
      array.length,
    );
    skData.set(array);
    return skArray;
  }
  call = <Ret>(
    fnId: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
  ): ptr<Internal.T<Ret>> => {
    return this.exports.SKIP_call0(fnId);
  };
  callWithException = <Ret>(
    fnId: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
    exception: Exception | null,
  ): ptr<Internal.T<Ret>> => {
    return this.exports.SKIP_callWithException(
      fnId,
      exception ? exception.id : 0,
    );
  };
  getBytesFromBuffer = (dataPtr: ptr<Internal.T<any>>, length: int) => {
    return new Uint8ClampedArray(this.exports.memory.buffer, dataPtr, length);
  };
  init = () => {
    const heapBase = this.exports.__heap_base.valueOf();
    const size = this.exports.memory.buffer.byteLength - heapBase;
    this.exports.SKIP_skstore_init(size);
    this.exports.SKIP_initializeSkip();
    this.exports.SKIP_skstore_end_of_init();
  };
  etry = <Ret>(
    f: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
    exn_handler: ptr<Internal.Function<Internal.Void, Internal.T<Ret>>>,
  ): ptr<Internal.T<Ret>> => {
    let err: Error | null = null;
    try {
      return this.call(f);
    } catch (exn: any) {
      if (this.exception && this.exception != exn) exn.cause = this.exception;
      err = exn as Error;
      this.exception = err;
      let exception: Exception | null = null;
      if (!(err instanceof SkError)) {
        exception = new Exception(err, this.state);
      }
      return this.callWithException(exn_handler, exception);
    } finally {
      if (this.exception == err) {
        this.exception = undefined;
      }
    }
  };
  ethrow = (skExc: ptr<Internal.Exception>, rethrow: boolean) => {
    this.env.onException();
    if (rethrow && this.exception) {
      throw this.exception;
    } else {
      const skMessage =
        skExc != 0 ? this.exports.SKIP_getExceptionMessage(skExc) : null;
      let message =
        skMessage != null && skMessage != 0
          ? this.importString(skMessage)
          : "SKStore Internal error";
      const lines = message.split("\n");
      if (lines[0]!.startsWith("external:")) {
        // only "".split("") is the empty array
        const external = lines.shift()!;
        message = lines.join("\n");
        const id = parseInt(external.substring(9));
        if (this.state.exceptions.has(id)) {
          throw this.state.exceptions.get(id)!.err;
        } else if (message.trim() == "") {
          message = "SKStore Internal error";
        }
      }
      const err = new SkError(message);
      if (err.stack) this.stacks.set(skExc, err.stack);
      throw err;
    }
  };

  replace_exn(oldex: ptr<Internal.Exception>, newex: ptr<Internal.Exception>) {
    const stack = this.stacks.get(oldex);
    if (stack) {
      this.stacks.delete(oldex);
      this.stacks.set(newex, stack);
    }
  }
  deleteException = (exc: int) => {
    this.state.exceptions.delete(exc);
  };

  getExceptionMessage = (exc: int) => {
    if (this.state.exceptions.has(exc)) {
      return this.state.exceptions.get(exc)!.err.message;
    } else {
      return "Unknown";
    }
  };

  getExceptionStack = (exc: int) => {
    if (this.state.exceptions.has(exc)) {
      return this.state.exceptions.get(exc)!.err.stack ?? "";
    } else {
      return "";
    }
  };

  getErrorObject = (skExc: ptr<Internal.Exception>): Error => {
    if (skExc == 0) {
      return new Error("SKStore Internal error");
    }
    let message = this.importString(
      this.exports.SKIP_getExceptionMessage(skExc),
    );
    let errStack = this.stacks.get(skExc);
    const lines = message.split("\n");
    if (lines[0]!.startsWith("external:")) {
      // only "".split("") is the empty array
      const external = lines.shift()!;
      const id = parseInt(external.substring(9));
      if (this.state.exceptions.has(id)) {
        const exception = this.state.exceptions.get(id);
        if (exception) {
          message = exception.err.message;
          errStack = exception.err.stack;
        } else {
          message = "Unknown error";
        }
      } else if (message.trim() == "") {
        message = "SKStore Internal error";
      }
    }
    const error = new Error(message);
    if (errStack) {
      error.stack = errStack;
    }
    if (this.exception) {
      Object.defineProperty(error, "cause", {
        enumerable: true,
        writable: true,
        value: this.exception,
      });
    }
    return error;
  };

  getPersistentSize = () => this.exports.SKIP_get_persistent_size();
  getVersion = () => this.exports.SKIP_get_version();
  getMemoryBuffer = () => this.exports.memory.buffer;

  readStdInLine = () => {
    const lineBuffer = new Array<int>();
    const endOfLine = 10;
    if (this.current_stdin >= this.stdin.length) {
      this.exports.SKIP_throw_EndOfFile();
    }
    while (this.stdin[this.current_stdin] !== endOfLine) {
      if (this.current_stdin >= this.stdin.length) {
        if (lineBuffer.length == 0) {
          this.exports.SKIP_throw_EndOfFile();
        } else {
          return lineBuffer;
        }
      }
      lineBuffer.push(this.stdin[this.current_stdin]!); // checked by preceding if
      this.current_stdin++;
    }
    this.current_stdin++;
    return lineBuffer;
  };

  readStdInToEnd = () => {
    const lineBuffer = new Array<int>();
    while (this.current_stdin < this.stdin.length) {
      lineBuffer.push(this.stdin[this.current_stdin]!); // checked by while condition
      this.current_stdin++;
    }
    return lineBuffer;
  };

  runWithGc = <T>(fn: () => T) => {
    this.stddebug = [];
    const obsPos = this.exports.SKIP_new_Obstack();
    try {
      // clone must be done before SKIP_destroy_Obstack
      const res = cloneIfProxy(fn());
      this.exports.SKIP_destroy_Obstack(obsPos);
      return res;
    } catch (ex) {
      this.exports.SKIP_destroy_Obstack(obsPos);
      throw ex;
    } finally {
      if (this.stddebug.length > 0) {
        console.log(this.stddebug.join(""));
      }
    }
  };

  getState<T>(name: string, create: () => T): T {
    let state = this.states.get(name);
    if (state == undefined) {
      state = create();
      this.states.set(name, state);
    }
    return state as T;
  }
}

export interface Links {
  complete: (utils: Utils, exports: object) => void;
}

export interface ToWasmManager {
  prepare: (wasm: object) => Links | null;
}

export type ModuleInit = (e: Environment) => Promise<ToWasmManager>;
export type EnvInit = (e: Environment) => void;

export function resolve(path: string) {
  const elements = import.meta.url.split("/");
  elements.pop();
  const pelems = path.split("/");
  pelems.forEach((e) => {
    if (e == "..") {
      if (elements.length == 1) {
        throw new Error("Invalid path: " + path);
      } else {
        elements.pop();
      }
    } else if (e != ".") {
      elements.push(e);
    }
  });
  return elements.join("/");
}

export function trimEndChar(str: string, ch: string) {
  let end = str.length;
  while (end > 0 && str[end - 1] === ch) --end;
  return end < str.length ? str.substring(0, end) : str;
}

export function humanSize(bytes: int) {
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) {
    return `${bytes} B`;
  }

  const units = ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let u = -1;
  const r = 10 ** 1;
  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return `${bytes.toFixed(1)} ${units[u]}`;
}

export function loadWasm(
  buffer: ArrayBuffer,
  managers: ToWasmManager[],
  environment: Environment,
  main?: string,
) {
  const wasm = {};
  const links = managers.map((manager) => manager.prepare(wasm));
  return WebAssembly.instantiate(buffer, { env: wasm }).then((result) => {
    const instance = result.instance;
    const exports = instance.exports;
    const utils = new Utils(instance.exports, environment, main);
    utils.init();
    links.forEach((link) => {
      if (link) {
        link.complete(utils, exports);
      }
    });
    return { environment: environment, main: utils.main };
  });
}

async function start(
  modules: ModuleInit[],
  buffer: Uint8Array | ArrayBuffer,
  environment: Environment,
  main?: string,
) {
  const promises = modules.map((fn) => fn(environment));
  const ms = await Promise.all(promises);
  return await loadWasm(buffer, ms, environment, main);
}

export function isNode() {
  return typeof process !== "undefined" && process.release.name == "node";
}

export type EnvCreator = (environment?: string[]) => Environment;

export function loadEnv(
  createEnvironment: EnvCreator,
  extensions: EnvInit[],
  envVals?: string[],
) {
  const env = createEnvironment(envVals);
  extensions.forEach((fn) => fn(env));
  return env;
}

export type Metadata = {
  filepath: string;
  line: number;
  column: number;
};

/**
 * Collect function script metadata (name, line, colum)
 * @param offset The offset of the function for the one to collect metadata
 * @returns The script metadata of the offset function
 */
export function metadata(offset: number): Metadata {
  const stack = new Error().stack!.split("\n");
  // Skip "Error" and metadata call
  const internalOffset = 2;
  const adjustedOffset = internalOffset + offset;
  const frame = stack[adjustedOffset];
  if (frame === undefined) throw new Error(`Invalid offset: ${offset}`);
  const info = /\((.*):(\d+):(\d+)\)$/.exec(frame);
  if (info === null) throw new Error(`No location found: ${frame}`);
  const metadata = {
    filepath: info[1]!, // matched regexp has 3 pairs of parens
    line: parseInt(info[2]!),
    column: parseInt(info[3]!),
  };
  return metadata;
}

export async function run(
  wasmUrl: URL | (() => URL | string | Promise<URL | string>),
  modules: ModuleInit[],
  extensions: EnvInit[],
  createEnvironment: EnvCreator,
  main?: string,
) {
  const env = loadEnv(createEnvironment, extensions);
  const url = typeof wasmUrl === "function" ? await wasmUrl() : wasmUrl;
  const buffer = await env.fetch(url);
  return await start(modules, buffer, env, main);
}
