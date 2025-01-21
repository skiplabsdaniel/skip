import { exit } from "process";
import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { createInterface } from "readline";

const argSchema = {
  help: {
    type: "boolean",
    short: "h",
    default: false,
    help: "",
  },
  workspace: {
    type: "string",
    short: "w",
    help: "The workspace directory.",
    default: ".",
  },
  target: {
    type: "string",
    short: "t",
    help: "The target directory.",
    default: "build/packager",
  },
  strict: {
    type: "boolean",
    short: "s",
    default: false,
    help: "Use strict versions.",
  },
  yes: {
    type: "boolean",
    short: "y",
    default: false,
    help: "Automatic yes to prompts.",
  },
};

interface Options {
  help: boolean;
  workspace: string;
  target: string;
  strict: boolean;
}

interface StringOption {
  type: string;
  short?: string;
  default?: string;
  help: string;
}

interface Package {
  version: string;
  resolved?: string;
  overridden?: boolean;
  dependencies?: Dependencies;
}

interface Dependencies {
  [packageName: string]: Package;
}

interface PckDependencies {
  [packageName: string]: string;
}

interface DependenciesCount {
  [packageName: string]: number;
}

interface Config {
  version: string;
}

interface Configs {
  [packageName: string]: Config;
}

interface Worspace {
  workspaces?: string[];
  devDependencies?: PckDependencies;
  config?: {
    "packager-targets"?: Configs;
  };
}

interface Pck {
  name: string;
  version?: string;
  type?: string;
  dependencies?: PckDependencies;
  devDependencies?: PckDependencies;
  optionalDependencies?: PckDependencies;
}

interface PckInfo {
  pck: Pck;
  path: string;
  in?: string;
}

interface Pcks {
  [packageName: string]: PckInfo;
}

function printHelp() {
  const thisBin = process.argv[1];
  const flags = Object.entries(argSchema)
    .map(([key, def]) => {
      const shortName = (def as StringOption).short;
      const val = shortName ? `-${shortName}, ` : "";
      const help = def.help ? `\n      ${def.help}` : "";
      const deflt = "default" in def ? ` Default: ${def.default}` : "";
      return `${val}--${key}${help}${deflt}`;
    })
    .join("\n  ");
  console.log(`Usage: ${thisBin} [Options] ${flags}`);
}

function checkVersion(
  key: keyof PckDependencies,
  version: string,
  flatten: PckDependencies,
) {
  if (key in flatten && flatten[key] != version) {
    throw new Error(
      `${key} uses with at least two version ${flatten[key]} and ${version}.`,
    );
  }
}

function checkDependencies(
  kind: keyof Pck,
  pck: Pck,
  all: PckDependencies,
  counts: DependenciesCount,
  wrkPackages: Pcks,
  configs: Configs,
) {
  if (!(kind in pck)) return;
  for (const [key, value] of Object.entries(pck[kind] as PckDependencies)) {
    if (!(key in wrkPackages)) {
      checkVersion(key, value, all);
      all[key] = value;
      continue;
    }
    if (!(key in configs)) {
      const dep: Pck = wrkPackages[key as keyof Dependencies]!.pck;
      dependencies(dep, all, counts, wrkPackages, configs);
    } else {
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
}

function dependencies(
  pck: Pck,
  all: PckDependencies,
  counts: DependenciesCount,
  wrkPackages: Pcks,
  configs: Configs,
) {
  if (!pck.dependencies) return;
  // the package file need to be
  checkDependencies("dependencies", pck, all, counts, wrkPackages, configs);
  checkDependencies("devDependencies", pck, all, counts, wrkPackages, configs);
  checkDependencies(
    "optionalDependencies",
    pck,
    all,
    counts,
    wrkPackages,
    configs,
  );
}

class Updater {
  public dependencies: Set<PckInfo>;

  constructor(
    private wrkPackages: Pcks,
    private configs: Configs,
    private strict: boolean,
  ) {
    this.dependencies = new Set();
  }

  update(kind: keyof Pck, pck: Pck, relative?: string) {
    if (!(kind in pck)) return;
    const deps = pck[kind] as PckDependencies;
    for (const key of Object.keys(deps)) {
      if (key in this.configs) {
        const dep = this.configs[key]!;
        deps[key] = this.strict ? dep.version : `^${dep.version}`;
        continue;
      }
      if (!(key in this.wrkPackages)) {
        continue;
      }
      const dep = this.wrkPackages[key]!;
      if (this.dependencies.has(dep)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete deps[key];
        continue;
      }
      delete dep.pck.version;
      if (!relative) {
        relative = pck.name
          .split("/")
          .map((_e) => "..")
          .join("/");
      }
      deps[key] = `file:${path.join(relative, key)}`;
      this.update("dependencies", dep.pck);
      this.update("devDependencies", dep.pck);
      this.update("optionalDependencies", dep.pck);
      dep.in = pck.name;
      this.dependencies.add(dep);
    }
  }

  owners(): Map<string, string> {
    const internals = new Map<string, string>();
    for (const info of this.dependencies) {
      if (info.in) internals.set(info.pck.name, info.in);
    }
    const owners = new Map<string, string>();
    for (const [name, owner_] of internals.entries()) {
      let owner = owner_;
      while (internals.has(owner)) {
        owner = internals.get(owner)!;
      }
      owners.set(name, owner);
    }
    return owners;
  }
}

function savePackage(target: string, pckInfo: PckInfo) {
  const pckDir = path.join(target, pckInfo.pck.name);
  fs.mkdirSync(pckDir, { recursive: true });
  fs.cpSync(pckInfo.path, pckDir, {
    recursive: true,
    filter: (source) => {
      const basename = path.basename(source);
      return (
        basename != "node_nodules" &&
        basename != "package.json" &&
        basename != "tsconfig.tsbuildinfo" &&
        basename != "tsconfig.tsbuildinfo" &&
        basename != "eslint.config.js" &&
        basename != "tsconfig.json"
      );
    },
  });
  fs.writeFileSync(
    path.join(pckDir, "package.json"),
    JSON.stringify(pckInfo.pck, undefined, 2),
  );
  return pckDir;
}

try {
  const { values } = parseArgs({
    options: argSchema as any,
    tokens: true,
  });

  const options = values as Options;

  if (options.help) {
    printHelp();
    exit(0);
  }

  const generate = () => {
    const workspaceDir = options.workspace;
    const workspaceFile = path.join(workspaceDir, "package.json");

    const data = fs.readFileSync(workspaceFile, "utf8");
    const workspace = JSON.parse(data) as Worspace;
    if (!workspace.workspaces) {
      throw new Error("Package file must define worspaces.");
    }

    if (!workspace.config?.["packager-targets"]) {
      throw new Error("No packager configuration defined.");
    }

    const configs = workspace.config["packager-targets"];

    if (Object.keys(configs).length == 0) {
      throw new Error("Packager configuration is empty.");
    }

    const wrkPackages: Pcks = {};

    for (const w of workspace.workspaces) {
      const pckdata = fs.readFileSync(path.join(w, "package.json"), "utf8");
      const pck = JSON.parse(pckdata) as Pck;
      if (pck.name) {
        wrkPackages[pck.name] = { pck, path: w };
      }
    }

    const missing = Object.keys(configs).filter(
      (packageName) => !(packageName in wrkPackages),
    );

    if (missing.length > 0) {
      throw new Error(
        `Packager configuration contains not valid packages:\n  ${missing.join("\n  ")}.`,
      );
    }

    const all: PckDependencies = {};
    const counts: DependenciesCount = {};

    for (const key of Object.keys(configs)) {
      const targetInfo = wrkPackages[key]!;
      dependencies(targetInfo.pck, all, counts, wrkPackages, configs);
    }

    const sorted = Object.keys(configs)
      .map((key) => {
        return { key, count: counts[key] ?? 0 };
      })
      .sort((n1, n2) => n2.count - n1.count)
      .map((v) => v.key);

    const updater = new Updater(wrkPackages, configs, options.strict);

    for (const key of sorted) {
      const targetInfo = wrkPackages[key]!;
      updater.update("dependencies", targetInfo.pck, ".");
      updater.update("devDependencies", targetInfo.pck, ".");
      updater.update("optionalDependencies", targetInfo.pck, ".");
    }

    const owners = updater.owners();

    for (const key of sorted) {
      const dep = wrkPackages[key]!;
      const pckDir = savePackage(options.target, dep);
      for (const [name, owner] of owners.entries()) {
        if (key == owner) {
          savePackage(pckDir, wrkPackages[name]!);
          owners.delete(name);
        }
      }
    }
  };

  if (fs.existsSync(options.target)) {
    const files = fs.readdirSync(options.target);
    if (files.length > 0) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      console.log(
        "Warning: The target directory isn't empty, it's about to be deleted.\nAre you sure you want to continue? [y,n]",
      );
      rl.prompt();
      rl.on("line", (line: string) => {
        const lline = line.toLowerCase();
        if (lline != "y" && lline != "yes") {
          process.exit(0);
        } else {
          rl.close();
          fs.rmSync(options.target, { recursive: true });
          generate();
        }
      });
    }
  } else {
    generate();
  }
} catch (e: unknown) {
  if (e instanceof Error) console.error(e.message);
  else console.error(JSON.stringify(e));
}
