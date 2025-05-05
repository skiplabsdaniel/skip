import type { ServiceInfo } from "../types.js";
import { tree } from "./tree.js";
import * as eng from "../../engine/index.js";

export function app(service: ServiceInfo) {
  return eng.split({
    first: tree(service),
    second: eng.flex({
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
    }),
    separation: eng.separation({
      value: 250,
      type: eng.SepType.FromStart,
    }),
  });
}
