/* eslint-env node */
import { runService } from "@skipruntime/server";
import { asFollower, asLeader } from "@skipruntime/helpers";
import { service } from "./dist/cache.service.js";

if (process.env["SKIP_LEADER"] == "true") {
  console.log("Running as leader...");
  runService(asLeader(service));
} else if (process.env["SKIP_FOLLOWER"] == "true") {
  console.log("Running as follower...");
  runService(
    asFollower(service, {
      leader: {
        host: "invalidation_leader",
        streaming_port: 8080,
        control_port: 8081,
      },
      collections: ["postsWithUpvotes", "sessions"],
    }),
  );
} else {
  console.log("Running non-distributed...");
  runService(service);
}
