import type { ServiceInstance, SkipService, TypeDef } from "@skipruntime/core";

import { initServiceFor } from "./skipruntime_init.js";
import { environment as createEnvironment } from "../skipwasm-std/sk_node.js";

export async function initService<I extends TypeDef, RI extends TypeDef>(
  service: SkipService<I, RI>,
): Promise<ServiceInstance<I, RI>> {
  return await initServiceFor(createEnvironment, service);
}
