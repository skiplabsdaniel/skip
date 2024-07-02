import type { Monitor, Collector } from "@skip-wasm/monitor";
export function build(monitor: Monitor) {
  const tracer = monitor.createTracers([]).create();
  const collectors: Collector[] = [];
  collectors.push(tracer.add.bind(tracer));
  // TODO Metrics
  return collectors;
}
