import fs from "fs/promises";
import { rollup } from "rollup";

const packageJson = JSON.parse(await fs.readFile("package.json", "utf-8"));

export function listEntrypoints() {
  const exports = packageJson.exports;
  const entrypoints = [];

  for (const [key, value] of Object.entries(exports)) {
    if (key === "./package.json") {
      continue;
    }
    if (typeof value === "string") {
      entrypoints.push(value);
    } else if (typeof value === "object" && value.import) {
      entrypoints.push(value.import);
    }
  }

  return entrypoints;
}

export function listExternals() {
  return [
    ...Object.keys(packageJson.dependencies),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    /node\:/,
    /js-tiktoken/,
  ];
}

export async function checkTreeShaking() {
  const externals = listExternals();
  const entrypoints = listEntrypoints();
  const consoleLog = console.log;
  const reportMap = new Map();

  for (const entrypoint of entrypoints) {
    let sideEffects = "";

    console.log = function (...args) {
      const line = args.length ? args.join(" ") : "";
      if (line.trim().startsWith("First side effect in")) {
        sideEffects += line + "\n";
      }
    };

    await rollup({
      external: externals,
      input: entrypoint,
      experimentalLogSideEffects: true,
    });

    reportMap.set(entrypoint, {
      log: sideEffects,
      hasSideEffects: sideEffects.length > 0,
    });
  }

  console.log = consoleLog;

  let failed = false;
  for (const [entrypoint, report] of reportMap) {
    if (report.hasSideEffects) {
      failed = true;
      console.log("---------------------------------");
      console.log(`Tree shaking failed for ${entrypoint}`);
      console.log(report.log);
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log("Tree shaking checks passed!");
  }
}

checkTreeShaking();
