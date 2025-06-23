// ../../../../skip/skiplang/prelude/ts/binding/src/index.ts
var skpointer = Symbol.for("Skip.pointer");
var sknative = Symbol.for("Skip.native_stub");
var sk_isObjectProxy = Symbol();
function cloneIfProxy(v) {
  if (v !== null && typeof v === "object" && sk_isObjectProxy in v && v[sk_isObjectProxy] && "clone" in v) {
    return v.clone();
  }
  return v;
}

// ../../../../skip/skiplang/prelude/ts/wasm/src/sk_types.ts
class State {
  exceptionId = 0;
  exceptions = new Map;
}

class Exception {
  id;
  err;
  constructor(err, state) {
    this.id = ++state.exceptionId;
    this.err = err;
    state.exceptions.set(this.id, this);
  }
}

class SkRuntimeExit extends Error {
  code;
  constructor(code, message) {
    super(message ?? `Runtime exit with code: ${code}`);
    this.code = code;
  }
}

class SkError extends Error {
}
var O_RDONLY = 0;
var O_WRONLY = 1;
var O_RDWR = 2;
var O_CREAT = 100;
var O_EXCL = 200;
var O_TRUNC = 1000;
var O_APPEND = 4000;

class Options {
  read;
  write;
  append;
  truncate;
  create;
  create_new;
  constructor(read = true, write = false, append = false, truncate = false, create = true, create_new = false) {
    this.read = read;
    this.write = write;
    this.append = append;
    this.truncate = truncate;
    this.create = create;
    this.create_new = create_new;
  }
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
  static fromFlags(flags) {
    const is = (flags2, value) => {
      return (flags2 & value) == value;
    };
    return new Options(!is(flags, O_WRONLY), is(flags, O_WRONLY) || is(flags, O_RDWR), is(flags, O_APPEND), is(flags, O_TRUNC), is(flags, O_CREAT), is(flags, O_EXCL));
  }
}
function utf8Encode(str) {
  return new TextEncoder().encode(str);
}

class Utils {
  exports;
  env;
  state;
  states;
  args;
  current_stdin;
  stdin;
  stdout;
  stderr;
  stddebug;
  mainFn;
  exception;
  stacks;
  exit = (code) => {
    const message = code != 0 && this.stderr.length > 0 ? this.stderr.join("") : undefined;
    throw new SkRuntimeExit(code, message);
  };
  constructor(exports, env, mainFn) {
    this.stacks = new Map;
    this.states = new Map;
    this.args = [];
    this.current_stdin = 0;
    this.stdin = utf8Encode("");
    this.stdout = [];
    this.stderr = [];
    this.stddebug = [];
    this.exports = exports;
    this.env = env;
    this.state = new State;
    this.mainFn = mainFn;
  }
  log = (str, kind, newLine = false) => {
    kind = kind ? kind : 0 /* OUT */;
    str += newLine ? `
` : "";
    if (kind == 2 /* DEBUG */) {
      const idx = str.lastIndexOf(`
`);
      if (idx == -1)
        this.stddebug.push(str);
      else {
        console.error(this.stddebug.join("") + str.slice(0, idx));
        this.stddebug = [str.slice(idx + 1)];
      }
    } else if (kind == 1 /* ERR */) {
      this.stderr.push(str);
    } else {
      this.stdout.push(str);
    }
  };
  sklog = (strPtr, kind, newLine = false) => {
    const str = this.importString(strPtr);
    this.log(str, kind, newLine);
  };
  clearMainEnvironment = (new_args = [], new_stdin = "") => {
    this.args = [this.mainFn ?? "main"].concat(new_args);
    this.exception = undefined;
    this.stacks = new Map;
    this.current_stdin = 0;
    this.stdin = utf8Encode(new_stdin);
    this.stdout = [];
    this.stderr = [];
    this.stddebug = [];
  };
  runCheckError = (fn) => {
    this.clearMainEnvironment();
    const res = fn();
    if (this.stddebug.length > 0) {
      console.log(this.stddebug.join(""));
    }
    if (this.stderr.length > 0) {
      const error = new Error(this.stderr.join(""));
      error.cause = this.exception;
      throw error;
    }
    return res;
  };
  main = (new_args, new_stdin) => {
    let exitCode = 0;
    this.clearMainEnvironment(new_args, new_stdin);
    try {
      if (!this.mainFn) {
        this.exports.skip_main();
      } else {
        const mainFn = this.exports[this.mainFn];
        mainFn();
      }
    } catch (exn) {
      if (exn instanceof SkRuntimeExit) {
        exitCode = exn.code;
      } else {
        if (this.exception && this.exception != exn)
          exn.cause = this.exception;
        throw exn;
      }
    }
    if (this.stddebug.length > 0) {
      console.log(this.stddebug.join(""));
    }
    if (exitCode != 0 || this.stderr.length > 0) {
      const message = this.stderr.length > 0 ? this.stderr.join("") : undefined;
      let tmp = "";
      const lines = [];
      message?.split(`
`).forEach((line) => {
        const matches = [...line.matchAll(/external:([0-9]+)/g)].sort((v1, v2) => {
          const i1 = parseInt(v1[1]);
          const i2 = parseInt(v2[1]);
          if (i2 < i1) {
            return 1;
          }
          if (i2 > i1) {
            return -1;
          }
          return 0;
        });
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
      const error = new SkRuntimeExit(exitCode, lines.join(`
`).trim());
      error.cause = this.exception;
      throw error;
    }
    return this.stdout.join("");
  };
  importOptString = (strPtr) => {
    if (strPtr > 0) {
      return this.importString(strPtr);
    }
    return null;
  };
  importString = (strPtr) => {
    const size = this.exports.SKIP_String_byteSize(strPtr);
    const utf8 = new Uint8Array(this.exports.memory.buffer, strPtr, size);
    return this.env.decodeUTF8(utf8);
  };
  exportString = (s) => {
    const data = new Uint8Array(this.exports.memory.buffer);
    let i = 0;
    const addr = this.exports.SKIP_Obstack_alloc(s.length * 4);
    for (let ci = 0;ci != s.length; ci++) {
      let c = s.charCodeAt(ci);
      if (c < 128) {
        data[addr + i++] = c;
        continue;
      }
      if (c < 2048) {
        data[addr + i++] = c >> 6 | 192;
      } else {
        if (c > 55295 && c < 56320) {
          if (++ci >= s.length)
            throw new Error("UTF-8 encode: incomplete surrogate pair");
          const c2 = s.charCodeAt(ci);
          if (c2 < 56320 || c2 > 57343)
            throw new Error(`UTF-8 encode: second surrogate character 0x${c2.toString(16)} at index ${ci} out of range`);
          c = 65536 + ((c & 1023) << 10) + (c2 & 1023);
          data[addr + i++] = c >> 18 | 240;
          data[addr + i++] = c >> 12 & 63 | 128;
        } else
          data[addr + i++] = c >> 12 | 224;
        data[addr + i++] = c >> 6 & 63 | 128;
      }
      data[addr + i++] = c & 63 | 128;
    }
    return this.exports.sk_string_create(addr, i);
  };
  importBytes = (skArray, sizeof = 1) => {
    const size = this.exports.SKIP_getArraySize(skArray) * sizeof;
    const skData = new Uint8Array(this.exports.memory.buffer, skArray, size);
    const copy = new Uint8Array(size);
    copy.set(skData);
    return copy;
  };
  importBytes2 = (skBytes, size = 1) => {
    const skData = new Uint8Array(this.exports.memory.buffer, skBytes, size);
    const copy = new Uint8Array(size);
    copy.set(skData);
    return copy;
  };
  exportBytes = (view) => {
    const skArray = this.exports.SKIP_createByteArray(view.byteLength);
    const data = new Uint8Array(this.exports.memory.buffer, skArray, view.byteLength);
    data.set(view);
    return skArray;
  };
  exportBytes2 = (view, skBytes) => {
    const data = new Uint8Array(this.exports.memory.buffer, skBytes, view.byteLength);
    data.set(view);
  };
  importUInt32s = (skArray) => {
    const size = this.exports.SKIP_getArraySize(skArray);
    const skData = new Uint32Array(this.exports.memory.buffer, skArray, size);
    const copy = new Uint32Array(size);
    copy.set(skData);
    return copy;
  };
  exportUInt32s(array) {
    const skArray = this.exports.SKIP_createUInt32Array(array.length);
    const skData = new Uint32Array(this.exports.memory.buffer, skArray, array.length);
    skData.set(array);
    return skArray;
  }
  importFloats = (skArray) => {
    const size = this.exports.SKIP_getArraySize(skArray);
    const skData = new Float64Array(this.exports.memory.buffer, skArray, size);
    const copy = new Float64Array(size);
    copy.set(skData);
    return copy;
  };
  exportFloats(array) {
    const skArray = this.exports.SKIP_createFloatArray(array.length);
    const skData = new Float64Array(this.exports.memory.buffer, skArray, array.length);
    skData.set(array);
    return skArray;
  }
  call = (fnId) => {
    return this.exports.SKIP_call0(fnId);
  };
  callWithException = (fnId, exception) => {
    return this.exports.SKIP_callWithException(fnId, exception ? exception.id : 0);
  };
  getBytesFromBuffer = (dataPtr, length) => {
    return new Uint8ClampedArray(this.exports.memory.buffer, dataPtr, length);
  };
  init = () => {
    const heapBase = this.exports.__heap_base.valueOf();
    const size = this.exports.memory.buffer.byteLength - heapBase;
    this.exports.SKIP_skstore_init(size);
    this.exports.SKIP_initializeSkip();
    this.exports.SKIP_skstore_end_of_init();
  };
  etry = (f, exn_handler) => {
    let err = null;
    try {
      return this.call(f);
    } catch (exn) {
      if (this.exception && this.exception != exn)
        exn.cause = this.exception;
      err = exn;
      this.exception = err;
      let exception = null;
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
  ethrow = (skExc, rethrow) => {
    this.env.onException();
    if (rethrow && this.exception) {
      throw this.exception;
    } else {
      const skMessage = skExc != 0 ? this.exports.SKIP_getExceptionMessage(skExc) : null;
      let message = skMessage != null && skMessage != 0 ? this.importString(skMessage) : "SKStore Internal error";
      const lines = message.split(`
`);
      if (lines[0].startsWith("external:")) {
        const external = lines.shift();
        message = lines.join(`
`);
        const id = parseInt(external.substring(9));
        if (this.state.exceptions.has(id)) {
          throw this.state.exceptions.get(id).err;
        } else if (message.trim() == "") {
          message = "SKStore Internal error";
        }
      }
      const err = new SkError(message);
      if (err.stack)
        this.stacks.set(skExc, err.stack);
      throw err;
    }
  };
  replace_exn(oldex, newex) {
    const stack = this.stacks.get(oldex);
    if (stack) {
      this.stacks.delete(oldex);
      this.stacks.set(newex, stack);
    }
  }
  deleteException = (exc) => {
    this.state.exceptions.delete(exc);
  };
  getExceptionMessage = (exc) => {
    if (this.state.exceptions.has(exc)) {
      return this.state.exceptions.get(exc).err.message;
    } else {
      return "Unknown";
    }
  };
  getExceptionStack = (exc) => {
    if (this.state.exceptions.has(exc)) {
      return this.state.exceptions.get(exc).err.stack ?? "";
    } else {
      return "";
    }
  };
  getErrorObject = (skExc) => {
    if (skExc == 0) {
      return new Error("SKStore Internal error");
    }
    let message = this.importString(this.exports.SKIP_getExceptionMessage(skExc));
    let errStack = this.stacks.get(skExc);
    const lines = message.split(`
`);
    if (lines[0].startsWith("external:")) {
      const external = lines.shift();
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
        value: this.exception
      });
    }
    return error;
  };
  getPersistentSize = () => this.exports.SKIP_get_persistent_size();
  getVersion = () => this.exports.SKIP_get_version();
  getMemoryBuffer = () => this.exports.memory.buffer;
  readStdInLine = () => {
    const lineBuffer = new Array;
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
      lineBuffer.push(this.stdin[this.current_stdin]);
      this.current_stdin++;
    }
    this.current_stdin++;
    return lineBuffer;
  };
  readStdInToEnd = () => {
    const lineBuffer = new Array;
    while (this.current_stdin < this.stdin.length) {
      lineBuffer.push(this.stdin[this.current_stdin]);
      this.current_stdin++;
    }
    return lineBuffer;
  };
  runWithGc = (fn) => {
    this.stddebug = [];
    const obsPos = this.exports.SKIP_new_Obstack();
    try {
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
  getState(name, create) {
    let state = this.states.get(name);
    if (state == undefined) {
      state = create();
      this.states.set(name, state);
    }
    return state;
  }
}
function loadWasm(buffer, managers, environment, main) {
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
    return { environment, main: utils.main };
  });
}
async function start(modules, buffer, environment, main) {
  const promises = modules.map((fn) => fn(environment));
  const ms = await Promise.all(promises);
  return await loadWasm(buffer, ms, environment, main);
}
function loadEnv(createEnvironment, extensions, envVals) {
  const env = createEnvironment(envVals);
  extensions.forEach((fn) => fn(env));
  return env;
}
async function run(wasmUrl, modules, extensions, createEnvironment, main) {
  const env = loadEnv(createEnvironment, extensions);
  const url = typeof wasmUrl === "function" ? await wasmUrl() : wasmUrl;
  const buffer = await env.fetch(url);
  return await start(modules, buffer, env, main);
}

// ../../../../skip/skiplang/prelude/ts/wasm/src/sk_mem_utils.ts
class File {
  contents;
  changes;
  options;
  cursor;
  onChange;
  withChange;
  constructor(options) {
    this.options = options;
    this.cursor = 0;
    this.withChange = false;
  }
  open(options) {
    this.options = options;
    this.cursor = 0;
    this.withChange = false;
    this.changes = "";
  }
  watch(onChange) {
    this.onChange = onChange;
  }
  close() {
    if (this.withChange && this.onChange) {
      this.onChange(this.changes ?? "");
    }
    this.options = undefined;
    this.changes = "";
  }
  write(contents, append = false) {
    if (!this.options?.write) {
      throw new Error("The file cannot be written");
    }
    if (this.contents && this.options.append || append) {
      this.contents = this.contents === undefined ? contents : this.contents.concat(contents);
    } else {
      this.contents = contents;
    }
    const old = this.changes;
    this.changes = this.changes === undefined ? contents : this.changes.concat(contents);
    this.withChange = this.changes != old;
    return contents.length;
  }
  read(len) {
    if (!this.options?.read) {
      throw new Error("The file cannot be read");
    }
    const clen = this.contents ? this.contents.length : 0;
    if (this.cursor >= clen) {
      return null;
    }
    const end = Math.min(clen, this.cursor + len);
    const res = this.contents?.substring(this.cursor, end);
    this.cursor = end;
    return res;
  }
  isOpen() {
    return this.options != null;
  }
}

class MemFS {
  fileDescrs;
  fileDescrNbr;
  files;
  constructor() {
    this.fileDescrs = new Map;
    this.fileDescrNbr = 2;
    this.files = [];
  }
  exists(filename) {
    return this.fileDescrs.has(filename);
  }
  openFile(filename, options, _mode) {
    const existing = this.fileDescrs.get(filename);
    if (existing != null) {
      if (options.create && options.create_new) {
        throw new Error("The file '" + filename + "' already exists");
      }
      this.files[existing].open(options);
      return existing;
    }
    const fd = this.fileDescrNbr;
    this.files[fd] = new File(options);
    this.fileDescrs.set(filename, fd);
    this.fileDescrNbr++;
    return fd;
  }
  watchFile(filename, f) {
    const fd = this.fileDescrNbr;
    this.files[fd] = new File;
    this.fileDescrs.set(filename, fd);
    this.fileDescrNbr++;
    this.files[fd].watch(f);
  }
  writeToFile(fd, content) {
    const file = this.files[fd];
    if (file === undefined)
      throw new Error(`Invalid file descriptor ${fd}`);
    file.write(content);
  }
  appendToFile(filename, content) {
    const fd = this.fileDescrs.get(filename);
    let file;
    if (fd != null) {
      file = this.files[fd];
    } else {
      file = new File;
      const fd2 = this.fileDescrNbr;
      this.files[fd2] = file;
      this.fileDescrs.set(filename, fd2);
      this.fileDescrNbr++;
    }
    file.open(new Options(false, true, true));
    file.write(content);
    file.close();
  }
  closeFile(fd) {
    const file = this.files[fd];
    if (file === undefined)
      throw new Error(`Invalid file descriptor ${fd}`);
    file.close();
  }
  write(fd, content) {
    const file = this.files[fd];
    if (file === undefined)
      throw new Error(`Invalid file descriptor ${fd}`);
    return file.write(content);
  }
  read(fd, len) {
    const file = this.files[fd];
    if (file === undefined)
      throw new Error(`Invalid file descriptor ${fd}`);
    return file.read(len) ?? null;
  }
}

class MemSys {
  env;
  constructor() {
    this.env = new Map;
  }
  setenv(name, value) {
    this.env.set(name, value);
  }
  getenv(name) {
    return this.env.get(name) ?? null;
  }
  unsetenv(name) {
    this.env.delete(name);
  }
}
// ../../../../skip/skiplang/prelude/ts/wasm/src/sk_runtime.ts
class LinksImpl {
  env;
  lineBuffer;
  lastTime;
  constructor(env) {
    this.env = env;
  }
  SKIP_read_line_fill;
  SKIP_read_to_end_fill;
  SKIP_read_line_get;
  SKIP_print_error;
  SKIP_print_error_raw;
  SKIP_print_debug;
  SKIP_print_debug_raw;
  SKIP_print_raw;
  SKIP_print_char;
  SKIP_print_string;
  SKIP_etry;
  js_throw;
  js_replace_exn;
  SKIP_throw_cruntime;
  SKIP_JS_timeStamp;
  SKIP_delete_external_exception;
  SKIP_external_exception_message;
  SKIP_FileSystem_appendTextFile;
  SKIP_js_time_ms_lo;
  SKIP_js_time_ms_hi;
  SKIP_js_get_entropy = () => {
    const buf = new Uint8Array(4);
    const crypto2 = this.env == undefined ? new Crypto : this.env.crypto();
    crypto2.getRandomValues(buf);
    return new Uint32Array(buf)[0];
  };
  SKIP_js_get_argc;
  SKIP_js_get_argn;
  SKIP_js_get_envc;
  SKIP_js_get_envn;
  SKIP_setenv;
  SKIP_getenv;
  SKIP_unsetenv;
  SKIP_glock() {}
  SKIP_gunlock() {}
  complete = (utils, _exports) => {
    this.SKIP_etry = utils.etry;
    this.SKIP_print_error = (msg) => {
      utils.sklog(msg, 1 /* ERR */, true);
    };
    this.SKIP_print_error_raw = (msg) => {
      utils.sklog(msg, 1 /* ERR */);
    };
    this.SKIP_print_debug = (msg) => {
      utils.sklog(msg, 2 /* DEBUG */, true);
    };
    this.SKIP_print_debug_raw = (msg) => {
      utils.sklog(msg, 2 /* DEBUG */);
    };
    this.SKIP_print_raw = (msg) => {
      utils.sklog(msg, 0 /* OUT */);
    };
    this.SKIP_print_string = (msg) => {
      utils.sklog(msg, 0 /* OUT */, true);
    };
    this.js_throw = (exc, rethrow) => utils.ethrow(exc, rethrow != 0);
    this.js_replace_exn = (oldex, newex) => utils.replace_exn(oldex, newex);
    this.SKIP_throw_cruntime = utils.exit;
    this.SKIP_print_char = (c) => {
      const str = String.fromCharCode(c);
      utils.log(str, 0 /* OUT */);
    };
    this.SKIP_delete_external_exception = utils.deleteException;
    this.SKIP_external_exception_message = (exc) => {
      return utils.exportString(utils.getExceptionMessage(exc));
    };
    this.SKIP_js_time_ms_lo = () => {
      this.lastTime = Date.now();
      return this.lastTime >>> 0;
    };
    this.SKIP_js_time_ms_hi = () => {
      return Math.floor(this.lastTime / 2 ** 32);
    };
    this.SKIP_js_get_argc = () => utils.args.length;
    this.SKIP_js_get_argn = (index) => {
      const arg = utils.args[index];
      if (arg === undefined)
        throw new Error(`Invalid arg index: ${index}`);
      return utils.exportString(arg);
    };
    this.SKIP_js_get_envc = () => this.env ? this.env.environment.length : 0;
    this.SKIP_js_get_envn = (index) => {
      const env = this.env?.environment[index];
      if (env === undefined)
        throw new Error(`Environment entry not found: ${index}`);
      return utils.exportString(env);
    };
    this.SKIP_read_line_fill = () => {
      this.lineBuffer = utils.readStdInLine();
      return this.lineBuffer.length;
    };
    this.SKIP_read_to_end_fill = () => {
      this.lineBuffer = utils.readStdInToEnd();
      return this.lineBuffer.length;
    };
    this.SKIP_read_line_get = (i) => {
      const line = this.lineBuffer[i];
      if (line === undefined)
        throw new Error(`Invalid read_line buffer index: ${i}`);
      return line;
    };
    this.SKIP_FileSystem_appendTextFile = (path, contents) => {
      const strPath = utils.importString(path);
      const strContents = utils.importString(contents);
      if (this.env) {
        this.env.fs().appendToFile(strPath, strContents);
      }
    };
    this.SKIP_setenv = (skName, skValue) => {
      if (this.env) {
        this.env.sys().setenv(utils.importString(skName), utils.importString(skValue));
      }
    };
    this.SKIP_getenv = (skName) => {
      if (this.env) {
        const value = this.env.sys().getenv(utils.importString(skName));
        return value ? utils.exportString(value) : null;
      }
      return null;
    };
    this.SKIP_unsetenv = (skName) => {
      if (this.env) {
        this.env.sys().unsetenv(utils.importString(skName));
      }
    };
  };
}

class Manager {
  env;
  constructor(env) {
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl(this.env);
    toWasm._ZSt9terminatev = () => {
      throw new Error("_ZSt9terminatev");
    };
    toWasm._ZNSt9exceptionD2Ev = () => {
      throw new Error("_ZNSt9exceptionD2Ev");
    };
    toWasm._ZNKSt9exception4whatEv = () => {
      throw new Error("_ZNKSt9exception4whatEv");
    };
    toWasm._ZdlPv = () => {
      throw new Error("_ZdlPv");
    };
    toWasm.abort = (err) => {
      throw new Error("Abort " + err);
    };
    toWasm.abortOnCannotGrowMemory = (err) => {
      throw new Error("Abort on cannot grow memory " + err);
    };
    toWasm.__setErrNo = (err) => {
      throw new Error("ErrNo " + err);
    };
    toWasm.__cxa_throw = (_exn, _infi, _dest) => {
      throw new Error("Not managed exception");
    };
    toWasm.js_throw = (excPtr, rethrow) => links.js_throw(excPtr, rethrow);
    toWasm.js_replace_exn = (oldex, newex) => links.js_replace_exn(oldex, newex);
    toWasm.SKIP_throw_cruntime = (code) => links.SKIP_throw_cruntime(code);
    toWasm.cos = Math.cos;
    toWasm.sin = Math.sin;
    toWasm.sqrt = Math.sqrt;
    toWasm.round = Math.round;
    toWasm.ceil = Math.ceil;
    toWasm.pow = Math.pow;
    toWasm.floor = Math.floor;
    toWasm.SKIP_Math_log = Math.log;
    toWasm.SKIP_Math_acos = Math.acos;
    toWasm.SKIP_Math_arcCos = Math.acos;
    toWasm.SKIP_Math_asin = Math.asin;
    toWasm.SKIP_Math_log10 = Math.log10;
    toWasm.SKIP_Math_exp = Math.exp;
    toWasm.SKIP_JS_timeStamp = () => links.SKIP_JS_timeStamp();
    toWasm.SKIP_print_error = (strPtr) => links.SKIP_print_error(strPtr);
    toWasm.SKIP_print_error_raw = (strPtr) => links.SKIP_print_error_raw(strPtr);
    toWasm.SKIP_print_debug = (strPtr) => links.SKIP_print_debug(strPtr);
    toWasm.SKIP_print_debug_raw = (strPtr) => links.SKIP_print_debug_raw(strPtr);
    toWasm.SKIP_print_raw = (strPtr) => links.SKIP_print_raw(strPtr);
    toWasm.SKIP_print_char = (strPtr) => links.SKIP_print_char(strPtr);
    toWasm.SKIP_print_string = (strPtr) => links.SKIP_print_string(strPtr);
    toWasm.SKIP_etry = (f, exn_handler) => links.SKIP_etry(f, exn_handler);
    toWasm.SKIP_delete_external_exception = (actor) => links.SKIP_delete_external_exception(actor);
    toWasm.SKIP_external_exception_message = (actor) => links.SKIP_external_exception_message(actor);
    toWasm.SKIP_js_time_ms_lo = () => links.SKIP_js_time_ms_lo();
    toWasm.SKIP_js_time_ms_hi = () => links.SKIP_js_time_ms_hi();
    toWasm.SKIP_js_get_entropy = () => links.SKIP_js_get_entropy();
    toWasm.SKIP_js_get_argc = () => links.SKIP_js_get_argc();
    toWasm.SKIP_js_get_argn = (index) => links.SKIP_js_get_argn(index);
    toWasm.SKIP_js_get_envc = () => links.SKIP_js_get_envc();
    toWasm.SKIP_js_get_envn = (index) => links.SKIP_js_get_envn(index);
    toWasm.SKIP_FileSystem_appendTextFile = (path, contents) => links.SKIP_FileSystem_appendTextFile(path, contents);
    toWasm.SKIP_read_line_fill = () => links.SKIP_read_line_fill();
    toWasm.SKIP_read_to_end_fill = () => links.SKIP_read_to_end_fill();
    toWasm.SKIP_read_line_get = (index) => links.SKIP_read_line_get(index);
    toWasm.SKIP_setenv = (skName, skValue) => links.SKIP_setenv(skName, skValue);
    toWasm.SKIP_getenv = (skName) => links.SKIP_getenv(skName);
    toWasm.SKIP_unsetenv = (skName) => links.SKIP_unsetenv(skName);
    return links;
  };
}
function init(env) {
  return Promise.resolve(new Manager(env));
}

// ../../../../skip/skiplang/prelude/ts/wasm/src/sk_posix.ts
class LinksImpl2 {
  fs;
  SKIP_check_if_file_exists;
  SKIP_js_open;
  SKIP_js_close;
  SKIP_js_write;
  SKIP_js_read;
  SKIP_js_open_flags;
  SKIP_js_pipe;
  SKIP_js_fork;
  SKIP_js_dup2;
  SKIP_js_execvp;
  SKIP_js_invalid = () => {
    throw new Error("Cannot be called within JS");
  };
  constructor(environment) {
    this.fs = environment.fs();
  }
  complete = (utils, _exports) => {
    this.SKIP_check_if_file_exists = (skPath) => {
      return this.fs.exists(utils.importString(skPath));
    };
    this.SKIP_js_open = (skPath, flags, mode) => {
      return this.fs.openFile(utils.importString(skPath), Options.fromFlags(flags), mode);
    };
    this.SKIP_js_close = (fd) => {
      return this.fs.closeFile(fd);
    };
    this.SKIP_js_write = (fd, skContents, len) => {
      this.fs.write(fd, new TextDecoder().decode(utils.importBytes2(skContents, len)));
      return len;
    };
    this.SKIP_js_read = (fd, skContents, len) => {
      const res = this.fs.read(fd, len);
      if (res !== null) {
        utils.exportBytes2(new TextEncoder().encode(res), skContents);
      }
      return len;
    };
    this.SKIP_js_open_flags = (read, write, append, truncate, create, create_new) => {
      return new Options(read, write, append, truncate, create, create_new).toFlags();
    };
    this.SKIP_js_pipe = this.SKIP_js_invalid;
    this.SKIP_js_fork = this.SKIP_js_invalid;
    this.SKIP_js_dup2 = this.SKIP_js_invalid;
    this.SKIP_js_execvp = this.SKIP_js_invalid;
  };
}

class Manager2 {
  environment;
  constructor(environment) {
    this.environment = environment;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl2(this.environment);
    toWasm.SKIP_js_open = (skPath, flags, mode) => links.SKIP_js_open(skPath, flags, mode);
    toWasm.SKIP_js_close = (fd) => links.SKIP_js_close(fd);
    toWasm.SKIP_js_write = (fd, skContents, len) => links.SKIP_js_write(fd, skContents, len);
    toWasm.SKIP_js_read = (fd, skContents, len) => links.SKIP_js_read(fd, skContents, len);
    toWasm.SKIP_js_open_flags = (read, write, append, truncate, create, create_new) => links.SKIP_js_open_flags(read, write, append, truncate, create, create_new);
    toWasm.SKIP_js_pipe = () => links.SKIP_js_pipe();
    toWasm.SKIP_js_fork = () => links.SKIP_js_fork();
    toWasm.SKIP_js_dup2 = () => links.SKIP_js_dup2();
    toWasm.SKIP_js_execvp = () => links.SKIP_js_execvp();
    return links;
  };
}
function init2(env) {
  return Promise.resolve(new Manager2(env));
}

// ../../../base/ts/src/skui_base.ts
class LinksImpl3 {
  env;
  constructor(env) {
    this.env = env;
  }
  SKIP_JS_timeStamp() {
    return this.env.timestamp();
  }
  SKIP_Math_atan2(y, x) {
    return Math.atan2(y, x);
  }
  complete(_utils, _exports) {
    return;
  }
}

class Manager3 {
  environment;
  constructor(environment) {
    this.environment = environment;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl3(this.environment);
    toWasm.SKIP_JS_timeStamp = links.SKIP_JS_timeStamp.bind(links);
    toWasm.SKIP_Math_atan2 = links.SKIP_Math_atan2.bind(links);
    return links;
  };
}
function init3(env) {
  return Promise.resolve(new Manager3(env));
}

// ../../../common/ts/wasm/src/skui_regexp.ts
class LinksImpl4 {
  utils;
  exported;
  complete = (utils, exports) => {
    this.utils = utils;
    this.exported = exports;
  };
  SKIP_RegExp_check(strPatternPtr) {
    const strPattern = this.utils.importString(strPatternPtr);
    new RegExp(strPattern);
  }
  SKIP_RegExp_escape(strPatternPtr) {
    const strPattern = this.utils.importString(strPatternPtr);
    const strEscaped = strPattern.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    return this.utils.exportString(strEscaped);
  }
  SKIP_RegExp_test(strSubjectPtr, strPatternPtr, caseInsensitive, global) {
    const strSubject = this.utils.importString(strSubjectPtr);
    const strPattern = this.utils.importString(strPatternPtr);
    let flags = "";
    if (global) {
      flags += "g";
    }
    if (caseInsensitive) {
      flags += "i";
    }
    const regExp = new RegExp(strPattern, flags);
    return regExp.test(strSubject);
  }
  SKIP_RegExp_match(strSubjectPtr, strPatternPtr, caseInsensitive, global) {
    const strSubject = this.utils.importString(strSubjectPtr);
    const strPattern = this.utils.importString(strPatternPtr);
    let flags = "";
    if (global) {
      flags += "g";
    }
    if (caseInsensitive) {
      flags += "i";
    }
    const regExp = new RegExp(strPattern, flags);
    const matches = strSubject.match(regExp);
    if (matches != null) {
      const ranges = this.exported.SKIP_RegExp_createRangeArray(matches.length);
      this.exported.SKIP_RegExp_setRange(ranges, 0, 0, strSubject.length);
      if (matches.length > 1) {
        let from = 0;
        for (let i = 1;i < matches.length; i++) {
          const match = matches[i];
          const idx = strSubject.indexOf(match, from);
          const slen = match.length;
          this.exported.SKIP_RegExp_setRange(ranges, i, idx, idx + slen);
          from = idx + slen;
        }
      }
      return ranges;
    }
    return null;
  }
  SKIP_RegExp_matchAll(strSubjectPtr, strPatternPtr, caseInsensitive, global) {
    const strSubject = this.utils.importString(strSubjectPtr);
    const strPattern = this.utils.importString(strPatternPtr);
    let flags = "";
    if (global) {
      flags += "g";
    }
    if (caseInsensitive) {
      flags += "i";
    }
    const regExp = new RegExp(strPattern, flags);
    const matches = [...strSubject.matchAll(regExp)];
    const vector = this.exported.SKIP_RegExp_createRangesVector();
    matches.forEach((match) => {
      const len = match[0].length;
      const ranges = this.exported.SKIP_RegExp_createRangeArray(match.length);
      this.exported.SKIP_RegExp_setRange(ranges, 0, match.index, match.index + len);
      if (match.length > 1) {
        const all = match[0];
        let from = 0;
        for (let i = 1;i < match.length; i++) {
          const elem = match[i];
          const idx = all.indexOf(elem, from);
          const slen = elem.length;
          this.exported.SKIP_RegExp_setRange(ranges, i, match.index + idx, match.index + idx + slen);
          from = idx + slen;
        }
      }
      this.exported.SKIP_RegExp_pushRanges(vector, ranges);
    });
    return this.exported.SKIP_RegExp_ranges(vector);
  }
}

class Manager4 {
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl4;
    toWasm.SKIP_RegExp_check = links.SKIP_RegExp_check.bind(links);
    toWasm.SKIP_RegExp_escape = links.SKIP_RegExp_escape.bind(links);
    toWasm.SKIP_RegExp_test = links.SKIP_RegExp_test.bind(links);
    toWasm.SKIP_RegExp_matchAll = links.SKIP_RegExp_matchAll.bind(links);
    toWasm.SKIP_RegExp_match = links.SKIP_RegExp_match.bind(links);
    return links;
  };
}
function init4(_env) {
  return Promise.resolve(new Manager4);
}

// ../../../common/ts/wasm/src/skui_common.ts
class CommonShared {
  registerData;
  getName = () => "common";
  constructor(registerData) {
    this.registerData = registerData;
  }
}

class State2 {
  dataId = 0;
  data = new Map;
  registerData = (data) => {
    const id = ++this.dataId;
    this.data.set(id, new Data(data));
  };
}

class Data {
  data;
  constructor(data) {
    this.data = data;
  }
  isBinary = () => this.data instanceof Uint8Array;
  getBytes = (exportBytes) => {
    if (this.data instanceof Uint8Array) {
      return exportBytes(this.data);
    }
    return null;
  };
  getText = (utils) => {
    if (typeof this.data == "string") {
      return utils.exportString(this.data);
    }
    return null;
  };
}

class LinksImpl5 {
  env;
  utils;
  state;
  constructor(env) {
    this.env = env;
    this.state = new State2;
  }
  complete(utils, _exports) {
    this.utils = utils;
    this.env.shared.set("common", new CommonShared(this.state.registerData));
  }
  SKIP_IO_isExternalBinary(id) {
    const data = this.state.data.get(id);
    if (data) {
      return data.isBinary();
    }
    return false;
  }
  SKIP_IO_deleteExternalData(id) {
    this.state.data.delete(id);
  }
  SKIP_IO_getExternalText(id) {
    const data = this.state.data.get(id);
    if (data) {
      return data.getText(this.utils);
    }
    return null;
  }
  SKIP_IO_getExternalBytes(id) {
    const data = this.state.data.get(id);
    if (data) {
      return data.getBytes(this.utils.exportBytes);
    }
    return null;
  }
}

class Manager5 {
  env;
  constructor(env) {
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl5(this.env);
    toWasm.SKIP_IO_isExternalBinary = links.SKIP_IO_isExternalBinary.bind(links);
    toWasm.SKIP_IO_deleteExternalData = links.SKIP_IO_deleteExternalData.bind(links);
    toWasm.SKIP_IO_getExternalText = links.SKIP_IO_getExternalText.bind(links);
    toWasm.SKIP_IO_getExternalBytes = links.SKIP_IO_getExternalBytes.bind(links);
    return links;
  };
}
function init5(env) {
  return Promise.resolve(new Manager5(env));
}

// ../../../opengl/ts/wasm/src/skui_matrix.ts
class Matrix {
  data;
  constructor() {
    this.data = new Float32Array(16);
    this.setAsIdentity();
  }
  setAsIdentity = () => {
    this.data[0] = 1;
    this.data[1] = 0;
    this.data[2] = 0;
    this.data[3] = 0;
    this.data[4] = 0;
    this.data[5] = 1;
    this.data[6] = 0;
    this.data[7] = 0;
    this.data[8] = 0;
    this.data[9] = 0;
    this.data[10] = 1;
    this.data[11] = 0;
    this.data[12] = 0;
    this.data[13] = 0;
    this.data[14] = 0;
    this.data[15] = 1;
  };
  setAsOrthographic = (left, right, bottom, top, near, far) => {
    this.data[0] = 2 / (right - left);
    this.data[1] = 0;
    this.data[2] = 0;
    this.data[3] = 0;
    this.data[4] = 0;
    this.data[5] = 2 / (top - bottom);
    this.data[6] = 0;
    this.data[7] = 0;
    this.data[8] = 0;
    this.data[9] = 0;
    this.data[10] = 2 / (near - far);
    this.data[11] = 0;
    this.data[12] = (left + right) / (left - right);
    this.data[13] = (bottom + top) / (bottom - top);
    this.data[14] = (near + far) / (near - far);
    this.data[15] = 1;
  };
  translate = (tx, ty, tz) => {
    const x00 = this.data[0];
    const x01 = this.data[1];
    const x02 = this.data[2];
    const x03 = this.data[3];
    const y00 = this.data[4];
    const y01 = this.data[5];
    const y02 = this.data[6];
    const y03 = this.data[7];
    const z00 = this.data[8];
    const z01 = this.data[9];
    const z02 = this.data[10];
    const z03 = this.data[11];
    const c00 = this.data[12];
    const c01 = this.data[13];
    const c02 = this.data[14];
    const c03 = this.data[15];
    this.data[12] = x00 * tx + y00 * ty + z00 * tz + c00;
    this.data[13] = x01 * tx + y01 * ty + z01 * tz + c01;
    this.data[14] = x02 * tx + y02 * ty + z02 * tz + c02;
    this.data[15] = x03 * tx + y03 * ty + z03 * tz + c03;
  };
  scale = (sx, sy, sz) => {
    this.data[0] = sx * this.data[0];
    this.data[1] = sx * this.data[1];
    this.data[2] = sx * this.data[2];
    this.data[3] = sx * this.data[3];
    this.data[4] = sy * this.data[4];
    this.data[5] = sy * this.data[5];
    this.data[6] = sy * this.data[6];
    this.data[7] = sy * this.data[7];
    this.data[8] = sz * this.data[8];
    this.data[9] = sz * this.data[9];
    this.data[10] = sz * this.data[10];
    this.data[11] = sz * this.data[11];
  };
}

// ../../../opengl/ts/wasm/src/skui_glloading.ts
class Loading {
  win;
  program;
  positionLocation;
  matrixLocation;
  color1Location;
  color2Location;
  stepLocation;
  smoothLocation;
  positionBuffer;
  step;
  canvas;
  gl;
  interval;
  setInterval;
  constructor(canvas, gl, setInterval) {
    this.setInterval = setInterval;
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0,
      0,
      0,
      1,
      1,
      0,
      1,
      0,
      0,
      1,
      1,
      1
    ]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.step = 0;
    this.gl = gl;
    this.canvas = canvas;
    this.program = loadindProgram(gl);
    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.matrixLocation = gl.getUniformLocation(this.program, "u_matrix");
    this.color1Location = gl.getUniformLocation(this.program, "u_color1");
    this.color2Location = gl.getUniformLocation(this.program, "u_color2");
    this.stepLocation = gl.getUniformLocation(this.program, "u_step");
    this.smoothLocation = gl.getUniformLocation(this.program, "u_smooth");
  }
  draw = (x, y, width, height, color1, color2, cWidth, cHeight) => {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    const matrix = new Matrix;
    matrix.setAsOrthographic(0, cWidth, cHeight, 0, -1, 1);
    matrix.translate(x, y, 0);
    matrix.scale(width, height, 1);
    gl.uniformMatrix4fv(this.matrixLocation, false, matrix.data);
    gl.uniform4fv(this.color1Location, Array.from(color1));
    gl.uniform4fv(this.color2Location, Array.from(color2));
    gl.uniform1i(this.stepLocation, this.step);
    const len = Math.sqrt(width * width + height * height);
    gl.uniform1f(this.smoothLocation, 4.2 / len);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(this.positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  };
  stop = () => {
    if (this.interval != null) {
      if (this.positionBuffer != null) {
        this.gl.deleteBuffer(this.positionBuffer);
        this.positionBuffer = null;
      }
      clearInterval(this.interval);
      this.interval = null;
    }
  };
  loading = () => {
    if (this.interval == null) {
      return;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(1, 1, 1, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    const size = 200;
    this.draw((this.canvas.width - size) / 2, (this.canvas.height - size) / 2, size, size, [0.4, 1, 0.8, 1], [0.2, 0.6, 1, 1], this.canvas.width, this.canvas.height);
    requestAnimationFrame(this.loading);
  };
  update = () => {
    this.step = (this.step + 1) % 8;
  };
  start = () => {
    this.gl.enable(this.gl.BLEND);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.interval = this.setInterval(this.update, 100);
    requestAnimationFrame(this.loading);
  };
  isActive = () => {
    return this.interval != null && !this.gl.isContextLost();
  };
}
var makeShader = (gl, src, type) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw Error("Error compiling shader: " + gl.getShaderInfoLog(shader));
  }
  return shader;
};
var loadindProgram = (gl) => {
  const vertexShader = makeShader(gl, progressVertexShader, gl.VERTEX_SHADER);
  const fragmentShader = makeShader(gl, progressFragmentShader, gl.FRAGMENT_SHADER);
  const glProgram = gl.createProgram();
  gl.attachShader(glProgram, vertexShader);
  gl.attachShader(glProgram, fragmentShader);
  gl.linkProgram(glProgram);
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program");
    return false;
  }
  return glProgram;
};
var progressVertexShader = `attribute vec4 a_position;
uniform mat4 u_matrix;
varying vec2 v_position;
void main() {
  vec4 position = u_matrix * a_position;
  v_position = a_position.xy;
  gl_Position = position;
}`;
var progressFragmentShader = `precision mediump float;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform int u_step;
uniform float u_smooth;
varying vec2 v_position;

vec2 center1 = vec2(0.5, 0.125);
vec2 center2 = vec2(0.765, 0.235);
vec2 center3 = vec2(0.875, 0.5);
vec2 center4 = vec2(0.765, 0.765);
vec2 center5 = vec2(0.5, 0.875);
vec2 center6 = vec2(0.235, 0.765);
vec2 center7 = vec2(0.125, 0.5);
vec2 center8 = vec2(0.235, 0.235);

vec2 draw_circle(vec2 coord, float radius, int step) {
  float value = smoothstep(radius, radius - u_smooth, length(coord));
  return vec2(
    value,
    float(value > 0.0 && step == u_step)
  );
}

void main() {
  vec2 coord = v_position;
  vec2 circle = draw_circle(coord - center1, 0.125, 0) + 
    draw_circle(coord - center2, 0.125, 1) + 
    draw_circle(coord - center3, 0.125, 2) + 
    draw_circle(coord - center4, 0.125, 3) + 
    draw_circle(coord - center5, 0.125, 4) + 
    draw_circle(coord - center6, 0.125, 5) + 
    draw_circle(coord - center7, 0.125, 6) + 
    draw_circle(coord - center8, 0.125, 7);
  gl_FragColor = circle.y * u_color2 + (1.0 - circle.y) * u_color1;
  gl_FragColor.a = circle.x;
}`;

// ../../../opengl/ts/wasm/src/skui_glcontext.ts
var uniforms = [
  "u_box",
  "u_center",
  "u_color",
  "u_color1",
  "u_color2",
  "u_end",
  "u_matrix",
  "u_radius",
  "u_sigma",
  "u_smooth",
  "u_start",
  "u_step",
  "u_texture",
  "u_texture1",
  "u_texture2",
  "u_thickness",
  "u_stop_colors",
  "u_stop_offsets",
  "u_progress",
  "u_precision",
  "u_size1",
  "u_size2",
  "u_bColor",
  "u_size",
  "u_pxRange"
];
var attributes = ["a_position"];

class State3 {
  viewport;
  color;
  texture;
  blend;
  blending;
  constructor(viewport, color, texture, blend, blending) {
    this.viewport = viewport;
    this.color = color;
    this.texture = texture;
    this.blend = blend;
    this.blending = blending;
  }
  copy() {
    return new State3(this.viewport, this.color, this.texture, this.blend, this.blending);
  }
}
function nothing() {
  return;
}
function getContext(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    depth: false,
    antialias: false
  });
  if (!gl) {
    return Promise.reject(new Error("WebGl2 must be supported"));
  }
  return Promise.resolve(gl);
}

class Factory {
  utils;
  nextId = 0;
  contexts;
  env;
  loading;
  wId;
  render;
  setGlContext;
  constructor() {
    this.contexts = new Map;
  }
  static init(environment) {
    const env = environment;
    const canvas = env.canvas();
    return getContext(canvas).then((gl) => {
      const factory = new Factory;
      factory.loading = new Loading(canvas, gl, (handler, timeout) => env.window().setInterval(handler, timeout));
      factory.loading.start();
      factory.env = env;
      factory.utils = null;
      return factory;
    });
  }
  createContext(wId) {
    const id = this.nextId + 1;
    this.nextId++;
    let canvas;
    let glPr;
    const loading = this.loading.isActive();
    if (loading) {
      canvas = this.loading.canvas;
      glPr = Promise.resolve(this.loading.gl);
    } else {
      canvas = this.env.canvas();
      glPr = getContext(canvas);
    }
    this.wId = wId;
    return glPr.then((gl) => {
      const context = new Context(id, canvas, gl, this.env, this.onLost.bind(this), loading ? this.onMainBinding.bind(this) : nothing, this.render, this.setGlContext ? (cId) => this.setGlContext(wId, cId) : undefined);
      this.contexts.set(id, context);
      context.start(this.onRestore.bind(this));
      return context;
    });
  }
  onRestore(ev) {
    if (ev) {
      ev.preventDefault();
    }
    this.createContext(this.wId).catch((err) => this.env.window().alert("Context cannot be restored: " + err));
  }
  onLost(context, ev) {
    if (ev) {
      ev.preventDefault();
    }
    this.contexts.delete(context.id);
    context.stop(this.onRestore.bind(this));
  }
  onMainBinding() {
    this.loading.stop();
  }
  doOnContext(ctxId, fn) {
    if (this.utils) {
      const context = this.contexts.get(ctxId);
      return context ? fn(context, this.utils) : null;
    }
    return null;
  }
  activateTextureAt(texture, location, index, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.activateTextureAt(texture, location, index));
  }
  activeTexture(index, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.activeTexture(index));
  }
  createTexture(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createTexture());
  }
  deleteTexture(texture, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteTexture(texture));
  }
  bindTexture2D(texture, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.bindTexture2D(texture));
  }
  setTexture2DMinFilter(value, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.setTexture2DMinFilter(value));
  }
  setTexture2DMagFilter(value, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.setTexture2DMagFilter(value));
  }
  setTexture2DWrapS(value, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.setTexture2DWrapS(value));
  }
  setTexture2DWrapT(value, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.setTexture2DWrapT(value));
  }
  createFragmentShader(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createFragmentShader());
  }
  createVertexShader(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createVertexShader());
  }
  compileShader(shader, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.compileShader(shader));
  }
  isCompiled(shader, ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.isCompiled(shader)) ?? false;
  }
  deleteShader(shader, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteShader(shader));
  }
  createProgram(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createProgram());
  }
  deleteProgram(program, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteProgram(program));
  }
  attachShader(program, shader, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.attachShader(program, shader));
  }
  detachShader(program, shader, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.detachShader(program, shader));
  }
  linkProgram(program, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.linkProgram(program));
  }
  useProgram(program, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.useProgram(program));
  }
  isLinked(program, ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.isLinked(program));
  }
  createBuffer(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createBuffer());
  }
  deleteBuffer(buffer, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteBuffer(buffer));
  }
  bindArrayBuffer(buffer, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.bindArrayBuffer(buffer));
  }
  createVertexArray(ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.createVertexArray());
  }
  deleteVertexArray(array, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteVertexArray(array));
  }
  bindVertexArray(array, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.bindVertexArray(array));
  }
  enableVertexAttributeArray(location, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.enableVertexAttributeArray(location));
  }
  vertexFloatAttributePointer(location, size, normalized, offset, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.vertexFloatAttributePointer(location, size, normalized, offset));
  }
  uniformMatrix4fv(location, transpose, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.uniformMatrix4fv(location, transpose, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16));
  }
  uniform1i(location, v0, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.uniform1i(location, v0));
  }
  uniform1f(location, v0, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.uniform1f(location, v0));
  }
  uniform2f(location, v0, v1, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.uniform2f(location, v0, v1));
  }
  uniform4f(location, v0, v1, v2, v3, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.uniform4f(location, v0, v1, v2, v3));
  }
  drawTriangleStrip(first, count, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.drawTriangleStrip(first, count));
  }
  drawTriangles(first, count, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.drawTriangles(first, count));
  }
  getIdxAttributeLocation(program, index, ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.getIdxAttributeLocation(program, index));
  }
  getAttributeLocation(program, name, ctxId) {
    return this.doOnContext(ctxId, (ctx, utils) => ctx.getAttributeLocation(utils, program, name));
  }
  getIdxUniformLocation(program, index, ctxId) {
    return this.doOnContext(ctxId, (ctx) => ctx.getIdxUniformLocation(program, index));
  }
  getUniformLocation(program, name, ctxId) {
    return this.doOnContext(ctxId, (ctx, utils) => ctx.getUniformLocation(utils, program, name));
  }
  bindMainFrameBuffer(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.bindMainFrameBuffer());
  }
  bindTextureFrameBuffer(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.bindTextureFrameBuffer());
  }
  framebufferTexture2DColor(texture, level, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.framebufferTexture2DColor(texture, level));
  }
  deleteFramebuffer(buffer, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.deleteFramebuffer(buffer));
  }
  viewport(x, y, width, height, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.viewport(x, y, width, height));
  }
  clearColor(r, g, b, a, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.clearColor(r, g, b, a));
  }
  srcAlphaBlendSrcColor(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.srcAlphaBlendSrcColor());
  }
  srcAlphaBlendOneMinus(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.srcAlphaBlendOneMinus());
  }
  oneBlendOneMinus(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.oneBlendOneMinus());
  }
  straitAlphaBlending(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.straitAlphaBlending());
  }
  disableBlend(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.disableBlend());
  }
  enableBlend(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.enableBlend());
  }
  save(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.save());
  }
  restore(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.restore());
  }
  flush(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.flush());
  }
  clear(ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.clear());
  }
  copyTexture(toPaste, srcX, srcY, srcWidth, srcHeight, target, dstX, dstY, width, height, reverted, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.copyTexture(toPaste, srcX, srcY, srcWidth, srcHeight, target, dstX, dstY, width, height, reverted));
  }
  uniform4fv(location, _count, valuesPtr, ctxId) {
    this.doOnContext(ctxId, (ctx) => {
      const values = this.utils.importFloats(valuesPtr);
      ctx.uniform4fv(location, Float32Array.from(values));
    });
  }
  uniform3fv(location, _count, valuesPtr, ctxId) {
    const values = this.utils.importFloats(valuesPtr);
    this.doOnContext(ctxId, (ctx) => ctx.uniform3fv(location, Float32Array.from(values)));
  }
  uniform2fv(location, _count, valuesPtr, ctxId) {
    const values = this.utils.importFloats(valuesPtr);
    this.doOnContext(ctxId, (ctx) => ctx.uniform2fv(location, Float32Array.from(values)));
  }
  uniform1fv(location, _count, valuesPtr, ctxId) {
    const values = this.utils.importFloats(valuesPtr);
    this.doOnContext(ctxId, (ctx) => ctx.uniform1fv(location, Float32Array.from(values)));
  }
  setTexture2DRGBASubImage(level, x, y, width, height, dataPtr, ctxId) {
    this.doOnContext(ctxId, (ctx) => {
      let pixels = null;
      if (dataPtr !== null && this.utils != null) {
        pixels = new Uint8ClampedArray(this.utils.importBytes(dataPtr, 4));
      }
      ctx.setTexture2DRGBASubImage(level, x, y, width, height, pixels);
    });
  }
  setTexture2DRGBAImage(level, width, height, dataPtr, ctxId) {
    this.doOnContext(ctxId, (ctx) => {
      let pixels = null;
      if (dataPtr !== null && this.utils != null) {
        pixels = new Uint8ClampedArray(this.utils.importBytes(dataPtr, 4));
      }
      ctx.setTexture2DRGBAImage(level, width, height, pixels);
    });
  }
  shaderSource(shader, source, ctxId) {
    this.doOnContext(ctxId, (ctx) => ctx.shaderSource(shader, this.utils.importString(source)));
  }
  getShaderInfoLog(shader, ctxId) {
    return this.doOnContext(ctxId, (ctx) => {
      const message = ctx.getShaderInfoLog(shader);
      return message ? this.utils.exportString(message) : null;
    });
  }
  staticDrawData(dataPtr, _len, ctxId) {
    this.doOnContext(ctxId, (ctx) => {
      const values = this.utils.importFloats(dataPtr);
      ctx.staticDrawData(Float32Array.from(values));
    });
  }
  getProgramInfoLog(program, ctxId) {
    return this.doOnContext(ctxId, (ctx) => {
      const message = ctx.getProgramInfoLog(program);
      return message ? this.utils.exportString(message) : null;
    });
  }
  imageAsTexture(ctx, image) {
    const res = this.doOnContext(ctx, (gl) => gl.textureFromImage(image));
    return res ?? 0;
  }
}

class Context {
  id;
  canvas;
  gl;
  gVariables;
  gKept;
  gToDelete;
  gVariableCount = 1;
  gStates;
  gState;
  frameBuffer = null;
  textureBuffer = null;
  env;
  lostCall;
  onMainBinding;
  animationFrameRequest;
  render;
  setGlContext;
  constructor(id, canvas, gl, env, lostCall, onMainBinding, render, setGlContext) {
    this.id = id;
    this.canvas = canvas;
    this.onMainBinding = onMainBinding;
    this.env = env;
    this.gl = gl;
    this.gVariables = new Map;
    this.gKept = new Set;
    this.gToDelete = new Set;
    this.lostCall = lostCall;
    this.gStates = [];
    this.gState = new State3([0, 0, canvas.width, canvas.height], [1, 1, 1, 1], true, false, nothing);
    this.render = render;
    this.setGlContext = setGlContext;
  }
  start(restoreCall) {
    this.canvas.addEventListener("webglcontextlost", this.onLost.bind(this));
    this.canvas.addEventListener("webglcontextrestored", restoreCall);
    if (this.setGlContext) {
      this.setGlContext(this.id);
    }
    this.animationFrameRequest = this.env.requestAnimationFrame(this.onAnimationFrame.bind(this));
  }
  stop(restoreCall) {
    this.env.cancelAnimationFrame(this.animationFrameRequest);
    this.canvas.removeEventListener("webglcontextlost", this.onLost.bind(this));
    this.canvas.removeEventListener("webglcontextrestored", restoreCall);
  }
  onLost(ev) {
    this.lostCall(this, ev);
  }
  onAnimationFrame() {
    if (!this.gl.isContextLost()) {
      if (this.render) {
        const devRatio = this.env.window().devicePixelRatio;
        const ratio = Math.trunc(devRatio * 100);
        this.render(this.id, Math.trunc(this.canvas.width / devRatio), Math.trunc(this.canvas.height / devRatio), ratio);
      }
      this.animationFrameRequest = this.env.requestAnimationFrame(this.onAnimationFrame.bind(this));
    }
  }
  getGlObject(id, check = false) {
    const obj = this.gVariables.get(id);
    if (check) {
      console.log([id, obj]);
    }
    return obj;
  }
  removeGlObject(id) {
    const obj = this.gVariables.get(id);
    this.gVariables.delete(id);
    return obj;
  }
  glValue(value) {
    switch (value) {
      case 1:
        return this.gl.NEAREST;
      case 2:
        return this.gl.NEAREST_MIPMAP_NEAREST;
      case 3:
        return this.gl.LINEAR_MIPMAP_NEAREST;
      case 4:
        return this.gl.NEAREST_MIPMAP_LINEAR;
      case 5:
        return this.gl.LINEAR_MIPMAP_LINEAR;
      case 6:
        return this.gl.REPEAT;
      case 7:
        return this.gl.CLAMP_TO_EDGE;
      case 8:
        return this.gl.MIRRORED_REPEAT;
      case 0:
      default:
        return this.gl.LINEAR;
    }
  }
  create(fn) {
    const id = this.gVariableCount;
    this.gVariables.set(id, fn(this.gl));
    this.gVariableCount++;
    return id;
  }
  activateTextureAt(texture, location, index) {
    this.gl.activeTexture(this.gl.TEXTURE0 + index);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.getGlObject(texture));
    this.gl.uniform1i(this.getGlObject(location), index);
  }
  activeTexture(index) {
    this.gl.activeTexture(this.gl.TEXTURE0 + index);
  }
  createTexture() {
    return this.create((gl) => gl.createTexture());
  }
  deleteTexture(texture) {
    if (this.gKept.has(texture)) {
      this.gToDelete.add(texture);
      return;
    }
    this.env.window().setTimeout(() => {
      const glObject = this.removeGlObject(texture);
      this.gl.deleteTexture(glObject);
    }, 0);
  }
  bindTexture2D(texture) {
    const glObject = texture != 0 ? this.getGlObject(texture) : null;
    this.gl.bindTexture(this.gl.TEXTURE_2D, glObject);
  }
  setTexture2DMinFilter(value) {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.glValue(value));
  }
  setTexture2DMagFilter(value) {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.glValue(value));
  }
  setTexture2DWrapS(value) {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.glValue(value));
  }
  setTexture2DWrapT(value) {
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.glValue(value));
  }
  setTexture2DRGBASubImage(level, x, y, width, height, pixels) {
    this.gl.texSubImage2D(this.gl.TEXTURE_2D, level, x, y, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
  }
  setTexture2DRGBAImage(level, width, height, pixels) {
    this.gl.texImage2D(this.gl.TEXTURE_2D, level, this.gl.RGBA, width, height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
  }
  createFragmentShader() {
    return this.create((gl) => gl.createShader(gl.FRAGMENT_SHADER));
  }
  createVertexShader() {
    return this.create((gl) => gl.createShader(gl.VERTEX_SHADER));
  }
  shaderSource(shader, source) {
    this.gl.shaderSource(this.getGlObject(shader), source);
  }
  compileShader(shader) {
    this.gl.compileShader(this.getGlObject(shader));
  }
  isCompiled(shader) {
    return this.gl.getShaderParameter(this.getGlObject(shader), this.gl.COMPILE_STATUS) ? true : false;
  }
  deleteShader(shader) {
    this.gl.deleteShader(this.removeGlObject(shader));
  }
  getShaderInfoLog(shader) {
    return this.gl.getShaderInfoLog(this.getGlObject(shader));
  }
  createProgram() {
    return this.create((gl) => gl.createProgram());
  }
  deleteProgram(program) {
    this.gl.deleteProgram(this.removeGlObject(program));
  }
  attachShader(program, shader) {
    this.gl.attachShader(this.getGlObject(program), this.getGlObject(shader));
  }
  detachShader(program, shader) {
    this.gl.detachShader(this.getGlObject(program), this.getGlObject(shader));
  }
  linkProgram(program) {
    this.gl.linkProgram(this.getGlObject(program));
  }
  useProgram(program) {
    this.gl.useProgram(this.getGlObject(program));
  }
  isLinked(program) {
    return this.gl.getProgramParameter(this.getGlObject(program), this.gl.LINK_STATUS);
  }
  getProgramInfoLog(program) {
    return this.gl.getProgramInfoLog(this.getGlObject(program));
  }
  createBuffer() {
    return this.create((gl) => gl.createBuffer());
  }
  deleteBuffer(buffer) {
    this.gl.deleteBuffer(this.removeGlObject(buffer));
  }
  bindArrayBuffer(buffer) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.getGlObject(buffer));
  }
  staticDrawData(data) {
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
  }
  createVertexArray() {
    return this.create((gl) => gl.createVertexArray());
  }
  deleteVertexArray(array) {
    this.gl.deleteVertexArray(this.removeGlObject(array));
  }
  bindVertexArray(array) {
    this.gl.bindVertexArray(this.getGlObject(array));
  }
  enableVertexAttributeArray(location) {
    this.gl.enableVertexAttribArray(this.getGlObject(location));
  }
  vertexFloatAttributePointer(location, size, normalized, offset) {
    this.gl.vertexAttribPointer(this.getGlObject(location), size, this.gl.FLOAT, normalized, 0, offset);
  }
  uniformMatrix4fv(location, transpose, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16) {
    const f32s = new Float32Array([
      v1,
      v2,
      v3,
      v4,
      v5,
      v6,
      v7,
      v8,
      v9,
      v10,
      v11,
      v12,
      v13,
      v14,
      v15,
      v16
    ]);
    this.gl.uniformMatrix4fv(this.getGlObject(location), transpose, f32s);
  }
  uniform1i(location, v0) {
    this.gl.uniform1i(this.getGlObject(location), v0);
  }
  uniform1f(location, v0) {
    this.gl.uniform1f(this.getGlObject(location), v0);
  }
  uniform2f(location, v0, v1) {
    this.gl.uniform2f(this.getGlObject(location), v0, v1);
  }
  uniform4f(location, v0, v1, v2, v3) {
    this.gl.uniform4f(this.getGlObject(location), v0, v1, v2, v3);
  }
  uniform4fv(location, data) {
    this.gl.uniform4fv(this.getGlObject(location), data);
  }
  uniform3fv(location, data) {
    this.gl.uniform3fv(this.getGlObject(location), data);
  }
  uniform2fv(location, data) {
    this.gl.uniform2fv(this.getGlObject(location), data);
  }
  uniform1fv(location, data) {
    this.gl.uniform1fv(this.getGlObject(location), data);
  }
  drawTriangleStrip(first, count) {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, first, count);
  }
  drawTriangles(first, count) {
    this.gl.drawArrays(this.gl.TRIANGLES, first, count);
  }
  getAttributeLocation(utils, program, name) {
    return this.create((gl) => gl.getAttribLocation(this.getGlObject(program), utils.importString(name)));
  }
  getIdxAttributeLocation(program, index) {
    return this.create((gl) => gl.getAttribLocation(this.getGlObject(program), attributes[index]));
  }
  getIdxUniformLocation(program, index) {
    return this.create((gl) => gl.getUniformLocation(this.getGlObject(program), uniforms[index]));
  }
  getUniformLocation(utils, program, name) {
    return this.create((gl) => gl.getAttribLocation(this.getGlObject(program), utils.importString(name)));
  }
  bindMainFrameBuffer() {
    this.onMainBinding();
    if (this.frameBuffer != null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.frameBuffer = null;
    }
  }
  bindTextureFrameBuffer() {
    this.textureBuffer ??= this.gl.createFramebuffer();
    if (this.frameBuffer == null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.textureBuffer);
      this.frameBuffer = this.textureBuffer;
    }
  }
  framebufferTexture2DColor(texture, level) {
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.getGlObject(texture), level);
  }
  deleteFramebuffer(buffer) {
    this.gl.deleteFramebuffer(this.removeGlObject(buffer));
  }
  viewport(x, y, width, height) {
    this.gState.viewport = [x, y, width, height];
    this.gl.viewport(x, y, width, height);
  }
  clearColor(r, g, b, a) {
    this.gState.color = [r, g, b, a];
    this.gl.clearColor(r, g, b, a);
  }
  srcAlphaBlendSrcColor() {
    this.gState.blending = this.srcAlphaBlendSrcColor.bind(this);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.SRC_COLOR);
  }
  srcAlphaBlendOneMinus() {
    this.gState.blending = this.srcAlphaBlendOneMinus.bind(this);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }
  oneBlendOneMinus() {
    this.gState.blending = this.oneBlendOneMinus.bind(this);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
  }
  straitAlphaBlending() {
    this.gState.blending = this.straitAlphaBlending.bind(this);
    this.gl.blendFuncSeparate(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA, this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
  }
  disableBlend() {
    this.gState.blend = false;
    this.gl.disable(this.gl.BLEND);
  }
  enableBlend() {
    this.gState.blend = true;
    this.gl.enable(this.gl.BLEND);
  }
  save() {
    this.gStates.push(this.gState);
    this.gState = this.gState.copy();
  }
  restore() {
    this.gState = this.gStates.pop();
    if (this.gState.blend) {
      this.gl.enable(this.gl.BLEND);
    } else {
      this.gl.disable(this.gl.BLEND);
    }
    this.gState.blending();
    this.gl.viewport(this.gState.viewport[0], this.gState.viewport[1], this.gState.viewport[2], this.gState.viewport[3]);
    this.gl.clearColor(this.gState.color[0], this.gState.color[1], this.gState.color[2], this.gState.color[3]);
  }
  clearState() {
    this.gState.viewport = [0, 0, this.canvas.width, this.canvas.height];
    this.gState.color = [1, 1, 1, 1];
  }
  flush() {
    this.gl.flush();
  }
  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
  copyTexture(toPaste, srcX, srcY, _srcWidth, _srcHeight, target, dstX, dstY, width, height, reverted) {
    const pixels = this.readPixels(toPaste, srcX, srcY, width, height);
    if (reverted) {
      const src = new Uint32Array(pixels.buffer);
      const buffer = new Uint32Array(width * height);
      for (let line = 0;line < height; line++) {
        const srcIndex = line * width;
        const dstIndex = (height - 1 - line) * width;
        buffer.set(src.subarray(srcIndex, width), dstIndex);
      }
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.getGlObject(target));
      const reverted2 = new Uint8ClampedArray(buffer.buffer);
      this.setTexture2DRGBASubImage(0, dstX, dstY, width, height, reverted2);
    } else {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.getGlObject(target));
      this.setTexture2DRGBASubImage(0, dstX, dstY, width, height, pixels);
    }
    this.gl.bindTexture(this.gl.FRAMEBUFFER, null);
  }
  readPixels(texture, x, y, width, height) {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.getGlObject(texture), 0);
    this.gl.readPixels(x, y, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
    this.gl.deleteFramebuffer(fb);
    return pixels;
  }
  keepTexture(txt) {
    this.gKept.add(txt);
  }
  releaseTexture(txt) {
    this.gKept.delete(txt);
    if (this.gToDelete.has(txt)) {
      this.gToDelete.delete(txt);
      this.deleteTexture(txt);
    }
  }
  textureFromImage(image) {
    const tex = this.createTexture();
    this.bindTexture2D(tex);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    return tex;
  }
}

// ../../../opengl/ts/wasm/src/skui_webgl.ts
class LinksImpl6 {
  factory;
  env;
  constructor(factory, env) {
    this.factory = factory;
    this.env = env;
  }
  complete(utils, exports) {
    const exported = exports;
    this.factory.utils = utils;
    this.factory.render = exported.SKIP_SKUIGL_performFrame.bind(exported);
    this.factory.setGlContext = exported.SKIP_SKUIGL_setWindowContext.bind(exported);
    const env = this.env;
    env.start = (wId) => this.factory.createContext(wId).then((ctx) => ctx.id);
    env.imageAsTexture = this.factory.imageAsTexture.bind(this.factory);
  }
}

class Manager6 {
  factory;
  env;
  constructor(factory, env) {
    this.factory = factory;
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl6(this.factory, this.env);
    toWasm.SKIP_GL_activateTextureAt = this.factory.activateTextureAt.bind(this.factory);
    toWasm.SKIP_GL_activeTexture = this.factory.activeTexture.bind(this.factory);
    toWasm.SKIP_GL_createTexture = this.factory.createTexture.bind(this.factory);
    toWasm.SKIP_GL_deleteTexture = this.factory.deleteTexture.bind(this.factory);
    toWasm.SKIP_GL_bindTexture2D = this.factory.bindTexture2D.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DMinFilter = this.factory.setTexture2DMinFilter.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DMagFilter = this.factory.setTexture2DMagFilter.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DWrapS = this.factory.setTexture2DWrapS.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DWrapT = this.factory.setTexture2DWrapT.bind(this.factory);
    toWasm.SKIP_GL_createFragmentShader = this.factory.createFragmentShader.bind(this.factory);
    toWasm.SKIP_GL_createVertexShader = this.factory.createVertexShader.bind(this.factory);
    toWasm.SKIP_GL_compileShader = this.factory.compileShader.bind(this.factory);
    toWasm.SKIP_GL_isCompiled = (shader, ctxId) => this.factory.isCompiled(shader, ctxId);
    toWasm.SKIP_GL_deleteShader = (shader, ctxId) => this.factory.deleteShader(shader, ctxId);
    toWasm.SKIP_GL_createProgram = this.factory.createProgram.bind(this.factory);
    toWasm.SKIP_GL_deleteProgram = this.factory.deleteProgram.bind(this.factory);
    toWasm.SKIP_GL_attachShader = this.factory.attachShader.bind(this.factory);
    toWasm.SKIP_GL_detachShader = this.factory.detachShader.bind(this.factory);
    toWasm.SKIP_GL_linkProgram = this.factory.linkProgram.bind(this.factory);
    toWasm.SKIP_GL_useProgram = this.factory.useProgram.bind(this.factory);
    toWasm.SKIP_GL_isLinked = this.factory.isLinked.bind(this.factory);
    toWasm.SKIP_GL_createBuffer = this.factory.createBuffer.bind(this.factory);
    toWasm.SKIP_GL_deleteBuffer = this.factory.deleteBuffer.bind(this.factory);
    toWasm.SKIP_GL_bindArrayBuffer = this.factory.bindArrayBuffer.bind(this.factory);
    toWasm.SKIP_GL_createVertexArray = this.factory.createVertexArray.bind(this.factory);
    toWasm.SKIP_GL_deleteVertexArray = this.factory.deleteVertexArray.bind(this.factory);
    toWasm.SKIP_GL_bindVertexArray = this.factory.bindVertexArray.bind(this.factory);
    toWasm.SKIP_GL_enableVertexAttributeArray = this.factory.enableVertexAttributeArray.bind(this.factory);
    toWasm.SKIP_GL_vertexFloatAttributePointer = this.factory.vertexFloatAttributePointer.bind(this.factory);
    toWasm.SKIP_GL_uniformMatrix4fv = this.factory.uniformMatrix4fv.bind(this.factory);
    toWasm.SKIP_GL_uniform1i = this.factory.uniform1i.bind(this.factory);
    toWasm.SKIP_GL_uniform1f = this.factory.uniform1f.bind(this.factory);
    toWasm.SKIP_GL_uniform2f = this.factory.uniform2f.bind(this.factory);
    toWasm.SKIP_GL_uniform4f = this.factory.uniform4f.bind(this.factory);
    toWasm.SKIP_GL_drawTriangleStrip = this.factory.drawTriangleStrip.bind(this.factory);
    toWasm.SKIP_GL_drawTriangles = this.factory.drawTriangles.bind(this.factory);
    toWasm.SKIP_GL_getIdxAttributeLocation = this.factory.getIdxAttributeLocation.bind(this.factory);
    toWasm.SKIP_GL_getAttributeLocation = this.factory.getAttributeLocation.bind(this.factory);
    toWasm.SKIP_GL_getIdxUniformLocation = this.factory.getIdxUniformLocation.bind(this.factory);
    toWasm.SKIP_GL_getUniformLocation = this.factory.getUniformLocation.bind(this.factory);
    toWasm.SKIP_GL_bindMainFrameBuffer = this.factory.bindMainFrameBuffer.bind(this.factory);
    toWasm.SKIP_GL_bindTextureFrameBuffer = this.factory.bindTextureFrameBuffer.bind(this.factory);
    toWasm.SKIP_GL_framebufferTexture2DColor = this.factory.framebufferTexture2DColor.bind(this.factory);
    toWasm.SKIP_GL_deleteFramebuffer = this.factory.deleteFramebuffer.bind(this.factory);
    toWasm.SKIP_GL_viewport = this.factory.viewport.bind(this.factory);
    toWasm.SKIP_GL_clearColor = this.factory.clearColor.bind(this.factory);
    toWasm.SKIP_GL_srcAlphaBlendSrcColor = this.factory.srcAlphaBlendSrcColor.bind(this.factory);
    toWasm.SKIP_GL_srcAlphaBlendOneMinus = this.factory.srcAlphaBlendOneMinus.bind(this.factory);
    toWasm.SKIP_GL_oneBlendOneMinus = this.factory.oneBlendOneMinus.bind(this.factory);
    toWasm.SKIP_GL_straitAlphaBlending = this.factory.straitAlphaBlending.bind(this.factory);
    toWasm.SKIP_GL_disableBlend = this.factory.disableBlend.bind(this.factory);
    toWasm.SKIP_GL_enableBlend = this.factory.enableBlend.bind(this.factory);
    toWasm.SKIP_GL_save = this.factory.save.bind(this.factory);
    toWasm.SKIP_GL_restore = this.factory.restore.bind(this.factory);
    toWasm.SKIP_GL_flush = this.factory.flush.bind(this.factory);
    toWasm.SKIP_GL_clear = this.factory.clear.bind(this.factory);
    toWasm.SKIP_GL_copyTexture = this.factory.copyTexture.bind(this.factory);
    toWasm.SKIP_GL_uniform4fv = this.factory.uniform4fv.bind(this.factory);
    toWasm.SKIP_GL_uniform2fv = this.factory.uniform2fv.bind(this.factory);
    toWasm.SKIP_GL_uniform3fv = this.factory.uniform3fv.bind(this.factory);
    toWasm.SKIP_GL_uniform1fv = this.factory.uniform1fv.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DRGBASubImage = this.factory.setTexture2DRGBASubImage.bind(this.factory);
    toWasm.SKIP_GL_setTexture2DRGBAImage = this.factory.setTexture2DRGBAImage.bind(this.factory);
    toWasm.SKIP_GL_shaderSource = this.factory.shaderSource.bind(this.factory);
    toWasm.SKIP_GL_getShaderInfoLog = this.factory.getShaderInfoLog.bind(this.factory);
    toWasm.SKIP_GL_staticDrawData = this.factory.staticDrawData.bind(this.factory);
    toWasm.SKIP_GL_getProgramInfoLog = this.factory.getProgramInfoLog.bind(this.factory);
    return links;
  };
}

class ToConsole {
  objid = 0;
  prepare = (wasm) => {
    const toWasm = wasm;
    toWasm.SKIP_GL_activateTextureAt = (_texture, location, index, ctxId) => console.log([
      "SKIP_GL_activateTextureAt texture",
      location,
      index,
      ctxId
    ]);
    toWasm.SKIP_GL_activeTexture = (index, ctxId) => console.log(["activeTexture", index, ctxId]);
    toWasm.SKIP_GL_createTexture = (ctxId) => {
      console.log(["createTexture", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_deleteTexture = (texture, ctxId) => console.log(["deleteTexture", texture, ctxId]);
    toWasm.SKIP_GL_bindTexture2D = (texture, ctxId) => console.log(["bindTexture2D", texture, ctxId]);
    toWasm.SKIP_GL_setTexture2DMinFilter = (value, ctxId) => console.log(["setTexture2DMinFilter", value, ctxId]);
    toWasm.SKIP_GL_setTexture2DMagFilter = (value, ctxId) => console.log(["setTexture2DMagFilter", value, ctxId]);
    toWasm.SKIP_GL_setTexture2DWrapS = (value, ctxId) => console.log(["setTexture2DWrapS", value, ctxId]);
    toWasm.SKIP_GL_setTexture2DWrapT = (value, ctxId) => console.log(["setTexture2DWrapT", value, ctxId]);
    toWasm.SKIP_GL_createFragmentShader = (ctxId) => {
      console.log(["createFragmentShader", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_createVertexShader = (ctxId) => {
      console.log(["createVertexShader", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_compileShader = (shader, ctxId) => console.log(["compileShader", shader, ctxId]);
    toWasm.SKIP_GL_isCompiled = (shader, ctxId) => console.log(["isCompiled", shader, ctxId]);
    toWasm.SKIP_GL_deleteShader = (shader, ctxId) => console.log(["deleteShader", shader, ctxId]);
    toWasm.SKIP_GL_createProgram = (ctxId) => {
      console.log(["createProgram", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_deleteProgram = (program, ctxId) => console.log(["deleteProgram", program, ctxId]);
    toWasm.SKIP_GL_attachShader = (program, shader, ctxId) => console.log(["attachShader", program, shader, ctxId]);
    toWasm.SKIP_GL_detachShader = (program, shader, ctxId) => console.log(["detachShader", program, shader, ctxId]);
    toWasm.SKIP_GL_linkProgram = (program, ctxId) => console.log(["linkProgram", program, ctxId]);
    toWasm.SKIP_GL_useProgram = (program, ctxId) => console.log(["useProgram", program, ctxId]);
    toWasm.SKIP_GL_isLinked = (program, ctxId) => {
      console.log(["isLinked", program, ctxId]);
      return true;
    };
    toWasm.SKIP_GL_createBuffer = (ctxId) => {
      console.log(["createBuffer", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_deleteBuffer = (buffer, ctxId) => console.log(["deleteBuffer", buffer, ctxId]);
    toWasm.SKIP_GL_bindArrayBuffer = (buffer, ctxId) => console.log(["bindArrayBuffer", buffer, ctxId]);
    toWasm.SKIP_GL_createVertexArray = (ctxId) => {
      console.log(["createVertexArray", ctxId]);
      return ++this.objid;
    };
    toWasm.SKIP_GL_deleteVertexArray = (array, ctxId) => console.log(["deleteVertexArray", array, ctxId]);
    toWasm.SKIP_GL_bindVertexArray = (array, ctxId) => console.log(["bindVertexArray", array, ctxId]);
    toWasm.SKIP_GL_enableVertexAttributeArray = (location, ctxId) => console.log(["enableVertexAttributeArray", location, ctxId]);
    toWasm.SKIP_GL_vertexFloatAttributePointer = (location, size, normalized, offset, ctxId) => console.log([
      "vertexFloatAttributePointer",
      location,
      size,
      normalized,
      offset,
      ctxId
    ]);
    toWasm.SKIP_GL_uniformMatrix4fv = (location, transpose, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, ctxId) => console.log([
      "uniformMatrix4fv",
      location,
      transpose,
      v1,
      v2,
      v3,
      v4,
      v5,
      v6,
      v7,
      v8,
      v9,
      v10,
      v11,
      v12,
      v13,
      v14,
      v15,
      v16,
      ctxId
    ]);
    toWasm.SKIP_GL_uniform1i = (location, v0, ctxId) => console.log(["uniform1i", location, v0, ctxId]);
    toWasm.SKIP_GL_uniform1f = (location, v0, ctxId) => console.log(["uniform1f", location, v0, ctxId]);
    toWasm.SKIP_GL_uniform2f = (location, v0, v1, ctxId) => console.log(["uniform2f", location, v0, v1, ctxId]);
    toWasm.SKIP_GL_uniform4f = (location, v0, v1, v2, v3, ctxId) => console.log(["uniform4f", location, v0, v1, v2, v3, ctxId]);
    toWasm.SKIP_GL_drawTriangleStrip = (first, count, ctxId) => console.log(["drawTriangleStrip", first, count, ctxId]);
    toWasm.SKIP_GL_drawTriangles = (first, count, ctxId) => console.log(["drawTriangles", first, count, ctxId]);
    toWasm.SKIP_GL_getAttributeLocation = (program, name, ctxId) => {
      console.log(["getAttributeLocation", program, name, ctxId]);
      return name;
    };
    toWasm.SKIP_GL_getIdxAttributeLocation = (program, index, ctxId) => {
      console.log(["getIdxAttributeLocation", program, index, ctxId]);
      return index;
    };
    toWasm.SKIP_GL_getUniformLocation = (program, name, ctxId) => {
      console.log(["getUniformLocation", program, name, ctxId]);
      return name;
    };
    toWasm.SKIP_GL_getIdxUniformLocation = (program, index, ctxId) => {
      console.log(["getIdxUniformLocation", program, index, ctxId]);
      return index;
    };
    toWasm.SKIP_GL_bindMainFrameBuffer = (ctxId) => console.log(["bindMainFrameBuffer", ctxId]);
    toWasm.SKIP_GL_bindTextureFrameBuffer = (ctxId) => console.log(["bindTextureFrameBuffer", ctxId]);
    toWasm.SKIP_GL_framebufferTexture2DColor = (texture, level, ctxId) => console.log(["framebufferTexture2DColor", texture, level, ctxId]);
    toWasm.SKIP_GL_deleteFramebuffer = (buffer, ctxId) => console.log(["deleteFramebuffer", buffer, ctxId]);
    toWasm.SKIP_GL_viewport = (x, y, width, height, ctxId) => console.log(["viewport", x, y, width, height, ctxId]);
    toWasm.SKIP_GL_clearColor = (r, g, b, a, ctxId) => console.log(["clearColor", r, g, b, a, ctxId]);
    toWasm.SKIP_GL_srcAlphaBlendSrcColor = (ctxId) => console.log(["srcAlphaBlendSrcColor", ctxId]);
    toWasm.SKIP_GL_srcAlphaBlendOneMinus = (ctxId) => console.log(["srcAlphaBlendOneMinus", ctxId]);
    toWasm.SKIP_GL_oneBlendOneMinus = (ctxId) => console.log(["oneBlendOneMinus", ctxId]);
    toWasm.SKIP_GL_straitAlphaBlending = (ctxId) => console.log(["straitAlphaBlending", ctxId]);
    toWasm.SKIP_GL_disableBlend = (ctxId) => console.log(["disableBlend", ctxId]);
    toWasm.SKIP_GL_enableBlend = (ctxId) => console.log(["enableBlend", ctxId]);
    toWasm.SKIP_GL_save = (ctxId) => console.log(["save", ctxId]);
    toWasm.SKIP_GL_restore = (ctxId) => console.log(["restore", ctxId]);
    toWasm.SKIP_GL_flush = (ctxId) => console.log(["flush", ctxId]);
    toWasm.SKIP_GL_clear = (ctxId) => console.log(["clear", ctxId]);
    toWasm.SKIP_GL_copyTexture = (toPaste, srcX, srcY, srcWidth, srcHeight, target, dstX, dstY, width, height, reverted, ctxId) => console.log([
      "copyTexture",
      toPaste,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      target,
      dstX,
      dstY,
      width,
      height,
      reverted,
      ctxId
    ]);
    toWasm.SKIP_GL_uniform4fv = (location, count, valuesPtr, ctxId) => console.log(["uniform4fv", location, count, valuesPtr, ctxId]);
    toWasm.SKIP_GL_uniform1fv = (location, count, valuesPtr, ctxId) => console.log(["uniform1fv", location, count, valuesPtr, ctxId]);
    toWasm.SKIP_GL_setTexture2DRGBASubImage = (level, x, y, width, height, dataPtr, ctxId) => console.log([
      "setTexture2DRGBASubImage",
      level,
      x,
      y,
      width,
      height,
      dataPtr,
      ctxId
    ]);
    toWasm.SKIP_GL_setTexture2DRGBAImage = (level, width, height, dataPtr, ctxId) => console.log([
      "setTexture2DRGBAImage",
      level,
      width,
      height,
      dataPtr,
      ctxId
    ]);
    toWasm.SKIP_GL_shaderSource = (shader, source, ctxId) => console.log(["shaderSource", shader, source, ctxId]);
    toWasm.SKIP_GL_staticDrawData = (dataPtr, len, ctxId) => console.log(["staticDrawData", dataPtr, len, ctxId]);
    toWasm.SKIP_GL_getShaderInfoLog = (shader, ctxId) => {
      console.log(["getShaderInfoLog", shader, ctxId]);
      return null;
    };
    toWasm.SKIP_GL_getProgramInfoLog = (program, ctxId) => {
      console.log(["getProgramInfoLog", program, ctxId]);
      return null;
    };
    return null;
  };
}
async function init6(env) {
  if (env) {
    const factory = await Factory.init(env);
    return new Manager6(factory, env);
  } else {
    return Promise.resolve(new ToConsole);
  }
}

// ../../../framework/ts/src/skui_framework.ts
class LinksImpl7 {
  env;
  constructor(env) {
    this.env = env;
  }
  complete(_utils, _exports) {}
  SKIP_FWK_applyCursor(_wId, code) {
    let cursor = "default";
    switch (code) {
      case 0:
        cursor = "none";
        break;
      case 1:
        cursor = "default";
        break;
      case 2:
        cursor = "pointer";
        break;
      case 3:
        cursor = "grab";
        break;
      case 4:
        cursor = "grabbing";
        break;
      case 5:
        cursor = "crosshair";
        break;
      case 6:
        cursor = "none";
        break;
      case 7:
        cursor = "move";
        break;
      case 8:
        cursor = "n-resize";
        break;
      case 9:
        cursor = "ne-resize";
        break;
      case 10:
        cursor = "e-resize";
        break;
      case 11:
        cursor = "se-resize";
        break;
      case 12:
        cursor = "s-resize";
        break;
      case 13:
        cursor = "sw-resize";
        break;
      case 14:
        cursor = "w-resize";
        break;
      case 15:
        cursor = "nw-resize";
        break;
      case 16:
        cursor = "col-resize";
        break;
      case 17:
        cursor = "row-resize";
        break;
      case 18:
        cursor = "text";
        break;
      case 19:
        cursor = "wait";
        break;
      case 20:
        cursor = "not-allowed";
        break;
      case 21:
        cursor = "cell";
        break;
      case 22:
        cursor = "help";
        break;
      case 23:
        cursor = "copy";
        break;
      case 24:
        cursor = "alias";
        break;
      case 25:
        cursor = "move";
        break;
      case 26:
        cursor = "no-drop";
        break;
      case 27:
        cursor = "help";
        break;
    }
    if (this.env) {
      this.env.canvas().style.cursor = cursor;
    } else {
      console.log(["Apply cursor", cursor]);
    }
  }
  SKIP_FWK_update(_wId) {
    if (this.env) {
      this.env.update();
    } else {
      console.log("Update");
    }
  }
}

class Manager7 {
  env;
  constructor(env) {
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl7(this.env);
    toWasm.SKIP_FWK_applyCursor = links.SKIP_FWK_applyCursor.bind(links);
    toWasm.SKIP_FWK_update = links.SKIP_FWK_update.bind(links);
    return links;
  };
}
function init7(env) {
  return Promise.resolve(new Manager7(env ? env : undefined));
}

// ../../../framework_js/ts/src/index.ts
class LinksImpl8 {
  env;
  utils;
  exported;
  constructor(env) {
    this.env = env;
  }
  complete(utils, exports) {
    this.utils = utils;
    this.exported = exports;
    if (this.env) {
      this.env.update = this.update.bind(this);
    }
  }
  SKIP_SKUIJS_sendMessage(_wId, message, _async, delay) {
    const strMessage = this.utils.importString(message);
    const manageMessage = (message2) => {
      this.utils.runWithGc(() => this.exported.SKIP_SKUIMessage_manage(this.utils.exportString(message2)));
    };
    if (this.env) {
      setTimeout(manageMessage, Math.max(delay, 0), strMessage);
    } else {
      console.log(["Message sent", strMessage, delay]);
    }
  }
  SKIP_SKUIJS_requestClipboard(wId, mimeType) {
    const clipboard = this.env?.clipboard();
    const strMimeType = this.utils.importString(mimeType);
    if (strMimeType.startsWith("text/plain") && clipboard) {
      clipboard.readText().then((clipText) => setTimeout(this.performPaste.bind(this), 0, wId, strMimeType, clipText)).catch((reason) => console.log(reason));
    } else {
      const strData = localStorage.getItem("clipboard:" + strMimeType);
      if (strData) {
        setTimeout(this.performPaste.bind(this), 0, wId, strMimeType, strData);
      }
    }
  }
  SKIP_SKUIJS_updateClipboard(_wId, mimeType, data) {
    const clipboard = this.env ? this.env.clipboard() : null;
    const strMimeType = this.utils.importString(mimeType);
    const strData = this.utils.importString(data);
    if (strMimeType.startsWith("text/plain") && clipboard) {
      clipboard.writeText(strData).catch((reason) => console.log(reason));
      if (!clipboard.readText) {
        localStorage.setItem("clipboard:" + strMimeType, strData);
      }
    } else {
      localStorage.setItem("clipboard:" + strMimeType, strData);
    }
  }
  SKIP_SKUIJS_init(wId, title) {
    if (this.env) {
      const strTitle = this.utils.importString(title);
      this.env.window().document.title = strTitle;
      this.manageEvents(wId);
      this.synchronizeWindowSize((width, height, ratio) => this.exported.SKIP_SKUIJS_manageResize(wId, width, height, ratio));
      this.env.start(wId).then((_cId) => this.exported.SKIP_SKUIJS_windowInitialized(wId)).catch((e) => console.error(e));
    }
  }
  SKIP_SKUIJS_display(skOutput, skError, html) {
    if (this.env) {
      const strOutput = skOutput ? this.utils.importString(skOutput) : null;
      const strError = skError ? this.utils.importString(skError) : null;
      const window2 = this.env.window();
      let container = window2.document.getElementById("skui_container");
      container = container ?? document.body;
      if (strError != null) {
        const div = document.createElement("div");
        div.innerHTML = html ? strError : strError.replaceAll(`
`, "<br>");
        div.style.fontSize = "16px";
        div.style.fontWeight = "bold";
        div.style.paddingLeft = "30px";
        container.appendChild(div);
      }
      if (strOutput != null) {
        const div = document.createElement("div");
        div.innerHTML = html ? strOutput : strOutput.replaceAll(`
`, "<br>");
        div.style.fontSize = "16px";
        container.appendChild(div);
      }
      const canvas = window2.document.getElementById("skui_canvas");
      if (canvas)
        canvas.style.display = "none";
      const texthook = window2.document.getElementById("skui_texthook");
      if (texthook)
        texthook.style.display = "none";
    }
  }
  update() {
    if (this.env) {
      this.env.window().setTimeout(this.exported.SKUI_update, 0);
    }
  }
  performPaste(wId, strMimeType, strData) {
    this.utils.runWithGc(() => {
      this.exported.SKIP_SKUIJS_performPaste(wId, this.utils.exportString(strMimeType), this.utils.exportString(strData));
    });
  }
  manageEvents(wId) {
    const window2 = this.env ? this.env.window() : null;
    if (window2) {
      const texthook = window2.document.getElementById("skui_texthook");
      if (texthook) {
        texthook.focus();
        texthook.addEventListener("input", (evt) => this.manageInputEvent(wId, evt));
      }
      window2.addEventListener("keydown", (evt) => this.manageKeyboardEvent(wId, evt));
      window2.addEventListener("keyup", (evt) => this.manageKeyboardEvent(wId, evt));
      window2.addEventListener("contextmenu", this.stopEvent.bind(this));
      window2.addEventListener("mousedown", (evt) => this.manageMouseEvent(wId, evt));
      window2.addEventListener("mousemove", (evt) => this.manageMouseEvent(wId, evt));
      window2.addEventListener("mouseup", (evt) => this.manageMouseEvent(wId, evt));
      window2.addEventListener("wheel", (evt) => this.manageWheelEvent(wId, evt), { passive: false });
      window2.onfocus = () => this.exported.SKIP_SKUIJS_clearKeyboardEvent(wId);
    }
  }
  manageInputEvent(wId, evt) {
    this.stopEvent(evt);
    if (evt.inputType == "insertText" || evt.inputType == "insertCompositionText" && evt.data == "`") {
      const backQuoteKey = (type) => {
        this.utils.runWithGc(() => {
          this.exported.SKIP_SKUIJS_manageKeyboardEvent(wId, type, this.utils.exportString("Space"), this.utils.exportString("`"), false, false, false, false, false, false, false, false);
        });
      };
      backQuoteKey(0);
      backQuoteKey(2);
    }
  }
  manageKeyboardEvent(wId, evt) {
    if (evt.code == "F11" || evt.code == "F12") {
      return;
    }
    this.stopEvent(evt);
    let type;
    switch (evt.type) {
      case "keydown":
        type = 0;
        break;
      case "keypress":
        type = 1;
        break;
      case "keyup":
        type = 2;
        break;
      case "contextmenu":
        type = 3;
        break;
      default:
        throw new Error("Unsuported KeyboardEvent type: " + evt.type);
    }
    let key = evt.key;
    let code = evt.code;
    if (evt.altKey && key == "L") {
      code = "Digit6";
      key = "|";
    } else if (evt.altKey && key == "n") {
      key = "~";
    }
    this.utils.runWithGc(() => {
      this.exported.SKIP_SKUIJS_manageKeyboardEvent(wId, type, this.utils.exportString(code), this.utils.exportString(key), evt.repeat, evt.getModifierState("CapsLock"), evt.getModifierState("NumLock"), evt.getModifierState("ScrollLock"), evt.ctrlKey, evt.shiftKey, evt.altKey, evt.metaKey);
    });
  }
  manageWheelEvent(wId, evt) {
    this.stopEvent(evt);
    let deltaX = evt.deltaX;
    let deltaY = evt.deltaY;
    let deltaZ = evt.deltaZ;
    if (evt.deltaMode == 1) {
      const scrollLineHeight = 16;
      deltaX *= scrollLineHeight;
      deltaY *= scrollLineHeight;
      deltaZ *= scrollLineHeight;
    }
    this.exported.SKIP_SKUIJS_manageWheelEvent(wId, deltaX, deltaY, deltaZ, evt.ctrlKey, evt.shiftKey, evt.altKey, evt.metaKey);
  }
  manageMouseEvent(wId, evt) {
    if (evt.type == "wheel") {
      this.manageWheelEvent(wId, evt);
      return;
    }
    this.stopEvent(evt);
    if (evt.type != "contextmenu") {
      let type;
      switch (evt.type) {
        case "mousemove":
          type = 0;
          break;
        case "mousedown":
          type = 1;
          break;
        case "mouseup":
          type = 2;
          break;
        default:
          throw new Error("Unsuported MouseEvent type: " + evt.type);
      }
      this.exported.SKIP_SKUIJS_manageMouseEvent(wId, type, evt.button, evt.detail, evt.clientX, evt.clientY, evt.screenX, evt.screenY, evt.movementX, evt.movementY, evt.ctrlKey, evt.shiftKey, evt.altKey, evt.metaKey);
    }
  }
  stopEvent(evt) {
    evt.preventDefault();
    if (typeof evt.stopPropagation != "undefined") {
      evt.stopPropagation();
    }
  }
  synchronizeWindowSize(resize) {
    const window2 = this.env !== undefined ? this.env.window() : null;
    if (window2 !== null) {
      const fWindow = window2;
      const canvas = window2.document.getElementById("skui_canvas");
      const resizeFn = () => {
        const ratio = fWindow.devicePixelRatio || 1;
        const width = Math.trunc(fWindow.innerWidth);
        const height = Math.trunc(fWindow.innerHeight);
        canvas.width = ratio * width;
        canvas.height = ratio * height;
        canvas.style.width = width.toString() + "px";
        canvas.style.height = height.toString() + "px";
        resize(width, height, Math.trunc(ratio * 100));
      };
      fWindow.onresize = resizeFn;
      resizeFn();
    }
  }
}

class Manager8 {
  env;
  constructor(env) {
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl8(this.env);
    toWasm.SKIP_SKUIJS_sendMessage = links.SKIP_SKUIJS_sendMessage.bind(links);
    toWasm.SKIP_SKUIJS_requestClipboard = links.SKIP_SKUIJS_requestClipboard.bind(links);
    toWasm.SKIP_SKUIJS_updateClipboard = links.SKIP_SKUIJS_updateClipboard.bind(links);
    toWasm.SKIP_SKUIJS_display = links.SKIP_SKUIJS_display.bind(links);
    toWasm.SKIP_SKUIJS_init = links.SKIP_SKUIJS_init.bind(links);
    return links;
  };
}
function init8(env) {
  return Promise.resolve(new Manager8(env ? env : undefined));
}

// src/module.ts
class DShared {
  run;
  getName = () => "debugger";
  constructor(run2) {
    this.run = run2;
  }
}
function errorMessage(error) {
  if (error instanceof Error)
    return error.message;
  if (typeof error == "string")
    return error;
  if (typeof error == "number")
    return error.toString();
  if (typeof error == "boolean")
    return error.toString();
  return JSON.stringify(error, Object.getOwnPropertyNames(error));
}

class LinksImpl9 {
  env;
  utils;
  exports;
  constructor(env) {
    this.env = env;
  }
  skui_fetch(_wId, url, method, headers, body, timeout_s, executor, time) {
    const jsUrl = this.utils.importString(url);
    const jsMethod = this.utils.importString(method);
    const jsHeaders = this.utils.importString(headers);
    const jsBody = body ? this.utils.importOptString(body) : null;
    const jsExecutor = this.utils.importString(executor);
    const exec = (status, headers2, payload, error) => {
      this.utils.runWithGc(() => {
        const sk_result = this.exports.sk_create_result(status, headers2 != null ? this.utils.exportString(headers2) : null, payload != null ? this.utils.exportString(payload) : null, error != null ? this.utils.exportString(error) : null);
        this.exports.skui_fetch_result(this.utils.exportString(jsUrl), this.utils.exportString(jsMethod), this.utils.exportString(jsHeaders), jsBody ? this.utils.exportString(jsBody) : null, this.utils.exportString(jsExecutor), time, sk_result);
      });
    };
    fetch(jsUrl, {
      method: jsMethod,
      body: jsBody,
      headers: JSON.parse(jsHeaders),
      signal: AbortSignal.timeout(Number(timeout_s) * 1000)
    }).then((response) => {
      const res = response.ok ? response.text().then((txt) => [response, txt]) : Promise.resolve([response, null]);
      return res;
    }).then((res) => {
      const [response, text] = res;
      exec(BigInt(response.status), JSON.stringify(response.headers), text, text != null ? null : response.statusText);
    }).catch((exc) => exec(BigInt(0), null, null, errorMessage(exc)));
  }
  run(host, port, securred) {
    this.utils.runWithGc(() => {
      const scheme = securred ? "https" : "http";
      const url = `${scheme}://${host}:${port}`;
      this.exports.sk_debugger_launch(this.utils.exportString(url));
    });
  }
  complete(utils, exports) {
    this.utils = utils;
    this.exports = exports;
    this.env.shared.set("debugger", new DShared(this.run.bind(this)));
  }
}

class Manager9 {
  env;
  constructor(env) {
    this.env = env;
  }
  prepare = (wasm) => {
    const toWasm = wasm;
    const links = new LinksImpl9(this.env);
    toWasm.skui_fetch = links.skui_fetch.bind(links);
    return links;
  };
}
function init9(env) {
  return Promise.resolve(new Manager9(env));
}
function run2(env, entrypoint) {
  env.shared.get("debugger").run(entrypoint.host, entrypoint.port, entrypoint.securred);
}

// ../../../opengl/ts/wasm/src/skui_glenv.ts
function complete(env) {
  const glenv = env;
  const global = typeof window == "undefined" ? self : window;
  glenv.clipboard = () => navigator.clipboard;
  if ("location" in global) {
    const win = global;
    glenv.window = () => win;
    glenv.requestAnimationFrame = (callback) => win.requestAnimationFrame(callback);
    glenv.cancelAnimationFrame = (handle) => win.cancelAnimationFrame(handle);
    const window2 = glenv.window();
    const document2 = glenv.window().document;
    let container = document2.getElementById("skui_container");
    container = container ?? document2.body;
    let texthook = document2.getElementById("skui_texthook");
    if (!texthook) {
      texthook = document2.createElement("textarea");
      texthook.id = "skui_texthook";
      container.appendChild(texthook);
    }
    let elem = document2.getElementById("skui_canvas");
    if (!elem) {
      elem = document2.createElement("canvas");
      elem.id = "skui_canvas";
      container.appendChild(elem);
    }
    const canvas = elem;
    canvas.style.overflow = "hidden";
    canvas.style.position = "absolute";
    canvas.style.top = "0px";
    canvas.style.left = "0px";
    const width = Math.trunc(window2.innerWidth);
    const height = Math.trunc(window2.innerHeight);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width.toString() + "px";
    canvas.style.height = height.toString() + "px";
    glenv.canvas = () => canvas;
  }
}

// ../../../../skip/skiplang/prelude/ts/wasm/src/sk_browser.ts
class Env {
  shared;
  disableWarnings = false;
  fileSystem;
  system;
  timestamp;
  decodeUTF8;
  encodeUTF8;
  storage;
  onException;
  base64Decode;
  base64Encode;
  crypto;
  environment;
  throwRuntime = (code) => {
    this.onException();
    if (code != 0) {
      throw new Error(`Error with code: ${code}`);
    }
  };
  fs() {
    return this.fileSystem;
  }
  sys() {
    return this.system;
  }
  name() {
    return "browser";
  }
  async fetch(url) {
    let fUrl;
    if (url instanceof URL) {
      fUrl = url;
    } else {
      fUrl = new URL(url, import.meta.url);
    }
    return fetch(fUrl).then((res) => res.arrayBuffer());
  }
  constructor(environment) {
    this.shared = new Map;
    this.fileSystem = new MemFS;
    this.system = new MemSys;
    this.environment = environment ?? [];
    const global = typeof window == "undefined" ? self : window;
    this.timestamp = () => global.performance.now();
    const decoder = new TextDecoder("utf8");
    this.decodeUTF8 = (utf8) => decoder.decode(utf8);
    const encoder = new TextEncoder;
    this.encodeUTF8 = (str) => encoder.encode(str);
    this.base64Decode = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    this.base64Encode = (toEncode, url = false) => {
      const base64 = btoa(toEncode);
      return url ? base64.replaceAll("+", "-").replaceAll("/", "_") : base64;
    };
    this.storage = () => localStorage;
    this.onException = () => {};
    this.crypto = () => crypto;
  }
}
function environment(environment2) {
  return new Env(environment2);
}

// src/index.ts
var modules = [
  init,
  init2,
  init3,
  init4,
  init5,
  init6,
  init7,
  init9,
  init8
];
var wasmurl = new URL("./libdebugger_wasm.wasm", import.meta.url);
var extensions = [complete];
async function launch() {
  const data = await run(wasmurl, modules, extensions, environment);
  const window2 = data.environment.window();
  const searchParams = new URLSearchParams(window2.location.search);
  const host = searchParams.get("host");
  const port = searchParams.get("port");
  const securred = searchParams.get("s");
  if (port == null)
    throw new Error("Debug port must be specified");
  if (!port.match(/^[0-9]+$/g)) {
    throw new Error("Debug port must be an integer");
  }
  run2(data.environment, {
    host: host ?? window2.location.hostname,
    port: parseInt(port),
    securred: securred == "true"
  });
}
export {
  launch
};
