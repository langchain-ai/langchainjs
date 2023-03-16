import fs from "fs/promises";
import { rollup } from "rollup";

export async function listEntrypoints() {
  const packageJson = JSON.parse(await fs.readFile("package.json", "utf-8"));
  const exports = packageJson.exports;
  const entrypoints = [];

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "string") {
      entrypoints.push(value);
    } else if (typeof value === "object") {
      entrypoints.push(value.import);
    }
  }

  return entrypoints;
}

export async function checkTreeShaking() {
  const entrypoints = await listEntrypoints();
  const consoleLog = console.log;

  for (const entrypoint of entrypoints) {
    let sideEffects = "";

    console.log = function (...args) {
      const line = args.length ? args.join(" ") : "";
      if (line.trim().startsWith("First side effect in")) {
        sideEffects += line + "\n";
      }
    };

    const build = await rollup({
      input: entrypoint,
      experimentalLogSideEffects: true,
    });

    consoleLog(`Checking tree shaking for ${entrypoint}...`, sideEffects);
  }

  console.log = consoleLog;
}

checkTreeShaking();
