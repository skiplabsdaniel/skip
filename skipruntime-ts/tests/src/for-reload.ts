import type { Mapper, Values } from "@skipruntime/core";

export class ReloadMapper implements Mapper<number, number, number, number> {
  mapEntry(key: number, values: Values<number>): Iterable<[number, number]> {
    return Array([key, values.getUnique() + 2]);
  }
}
