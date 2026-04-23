import type {
  NamedEagerCollections,
  NamedInputDefinitions,
  ServiceInstance,
  SharedCollections,
  SkipService,
} from "@skipruntime/core";

import { initServiceFor } from "./skipruntime_init.js";
import { environment as createEnvironment } from "../skipwasm-std/sk_node.js";

export async function initService<
  InputDefs extends NamedInputDefinitions,
  Inputs extends NamedEagerCollections,
  ResourceInputs extends SharedCollections,
>(
  service: SkipService<InputDefs, Inputs, ResourceInputs>,
): Promise<ServiceInstance> {
  return await initServiceFor(createEnvironment, service);
}
