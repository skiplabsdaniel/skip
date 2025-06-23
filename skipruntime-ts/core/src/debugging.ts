import type {
  Json,
  JsonObject,
  Nullable,
  Pointer,
} from "../skiplang-json/index.js";
import type { Handle } from "./binding.js";
import type { Entry, Refs } from "./index.js";
import type * as Internal from "./internal.js";

export interface FromBinding {
  SkipRuntime_Debugger__service(): Pointer<Internal.CJSON>;

  SkipRuntime_Debugger__sharedGraph(): Pointer<Internal.CJSON>;

  SkipRuntime_Debugger__resourceGraph(
    resource: string,
    jsonParams: Pointer<Internal.CJObject>,
  ): Pointer<Internal.CJSON>;

  SkipRuntime_Debugger__resourceInstances(
    resource: string,
  ): Pointer<Internal.CJSON>;

  SkipRuntime_Debugger__values(
    definition: Pointer<Internal.CJSON>,
  ): Pointer<Internal.CJSON>;
}

export type ServiceInfo = {
  name: string;
  platform?: string;
  version: string;
  inputs: string[];
  resources: string[];
  remotesResources: string[];
};

export type Name = {
  name: string;
  alias?: string;
};

export type Read = {
  collection: string;
  key: Json;
};

export type Constructor = {
  name?: string;
  parameters?: {
    type: string;
    value: Json;
  }[];
};

export type EType = {
  operator: string;
  constructors?: Constructor[];
};

export type Entity = {
  name: string;
  type?: EType;
  inputs?: string[];
  reads: string[];
};

export type Graph = {
  inputs: Name[];
  outputs: Name[];
  entities: Entity[];
  reads: Read[];
};

export type Instance = {
  params: Json;
  clients: string[];
};

export class DebugInstance {
  private binding: FromBinding;

  constructor(private readonly refs: Refs) {
    this.binding = refs.binding as any as FromBinding;
  }

  service(name: string): ServiceInfo {
    const result = this.refs.runWithGC(() => {
      return this.refs.skjson.importJSON(
        this.binding.SkipRuntime_Debugger__service(),
        true,
      );
    });
    if (typeof result == "number")
      throw this.refs.handles.deleteHandle(result as Handle<Error>);
    return { ...{ name }, ...(result as JsonObject) } as ServiceInfo;
  }

  sharedGraph(): Graph {
    const result = this.refs.runWithGC(() => {
      return this.refs.skjson.importJSON(
        this.binding.SkipRuntime_Debugger__sharedGraph(),
        true,
      );
    });
    if (typeof result == "number")
      throw this.refs.handles.deleteHandle(result as Handle<Error>);
    return result as unknown as Graph;
  }

  resourceGraph(resource: string, params: Json = {}): Nullable<Graph> {
    const result = this.refs.runWithGC(() => {
      return this.refs.skjson.importJSON(
        this.binding.SkipRuntime_Debugger__resourceGraph(
          resource,
          this.refs.skjson.exportJSON(params),
        ),
        true,
      );
    });
    if (typeof result == "number")
      throw this.refs.handles.deleteHandle(result as Handle<Error>);
    return result ? (result as unknown as Graph) : null;
  }

  resourceInstances(resource: string): Instance[] {
    const result = this.refs.runWithGC(() => {
      return this.refs.skjson.importJSON(
        this.binding.SkipRuntime_Debugger__resourceInstances(resource),
        true,
      );
    });
    if (typeof result == "number")
      throw this.refs.handles.deleteHandle(result as Handle<Error>);
    return result as Instance[];
  }

  values(definition: Json): Entry<Json, Json>[] {
    const result = this.refs.runWithGC(() => {
      return this.refs.skjson.importJSON(
        this.binding.SkipRuntime_Debugger__values(
          this.refs.skjson.exportJSON(definition),
        ),
        true,
      );
    });
    if (typeof result == "number")
      throw this.refs.handles.deleteHandle(result as Handle<Error>);
    return result as Entry<Json, Json>[];
  }
}
