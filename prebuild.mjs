import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { exit } from "process";

const argSchema = {
  help: {
    type: "boolean",
    short: "h",
    default: false,
    help: "",
  },
  links: {
    type: "string",
    short: "l",
    help: "To specific a json file with additional links.",
  },
};

function printHelp() {
  const thisBin = process.argv[1];
  const flags = Object.entries(argSchema)
    .map(([key, def]) => {
      const shortName = def.short;
      const val = shortName ? `-${shortName}, ` : "";
      const help = def.help ? `\n      ${def.help}` : "";
      const deflt = "default" in def ? ` Default: ${def.default}` : "";
      return `${val}--${key}${help}${deflt}`;
    })
    .join("\n  ");
  console.log(`Usage: ${thisBin} [Options] package1 package2 ... \n  ${flags}`);
}

const { values, positionals } = parseArgs({
  options: argSchema,
  tokens: true,
  allowPositionals: true,
});

if (values.help) {
  printHelp();
  exit(0);
}

if (positionals.length <= 0) {
  console.error("Almost one package must be specified.");
  printHelp();
  exit(1);
}

const symlinks = {
  "skiplang-std": "./skiplang/prelude/ts/binding/src",
  "skipwasm-std": "./skiplang/prelude/ts/wasm/src",
  "skipwasm-worker": "./skiplang/prelude/ts/worker/src",
  "skipwasm-date": "./skiplang/skdate/ts/src",
  "skiplang-json": "./skiplang/skjson/ts/binding/src",
  "skipwasm-json": "./skiplang/skjson/ts/wasm/src",
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export function link(dirname, availables, packages) {
  for (const [symlink, target] of Object.entries(availables)) {
    if (!packages.has(symlink)) continue;
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const tmp = "tmp" + rand.toString("hex");
    fs.symlinkSync(path.resolve(dirname, target), tmp, "dir");
    fs.renameSync(tmp, symlink);
  }
}

const packages = new Set(positionals);

link(dirname, symlinks, packages);

if (values.links) {
  const customlinks = JSON.parse(fs.readFileSync(values.links));
  const customdir = path.dirname(path.resolve(values.links));
  link(customdir, customlinks, packages);
}
