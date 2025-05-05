import * as eng from "../../engine/index.js";
import type { ServiceInfo } from "../types.js";

export function tree(service: ServiceInfo): eng.WidgetElement {
  return eng.flex({
    children: [
      eng.label({
        text: service.name,
      }),
      eng.label({
        text: service.platform,
      }),
      eng.label({
        text: service.version,
      }),
    ],
    vertical: true,
    "main-alignment": eng.Alignment.Start,
    "cross-alignment": eng.FlCrossAlign.Start,
  });
}
