import fs from "node:fs/promises";
import { rollup } from "rollup";
import { ExportsMapValue, PackageJSON, TreeShakingArgs } from "./types.js";

async function getPackageJson(): Promise<PackageJSON> {
  return JSON.parse(await fs.readFile("package.json", "utf-8"));
}

async function listEntrypoints() {
  const { exports } = await getPackageJson();
  const exportsWithoutPackageJSON: Record<
    string,
    ExportsMapValue | string
  > | null = exports
    ? Object.entries(exports)
        .filter(([k]) => k !== "./package.json")
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
    : null;

  if (!exportsWithoutPackageJSON) {
    throw new Error("No exports found in package.json");
  }
  const entrypoints: string[] = [];

  for (const [key, value] of Object.entries(exportsWithoutPackageJSON)) {
    if (key === "./package.json") {
      continue;
    }
    if (typeof value === "string") {
      entrypoints.push(value);
    } else if (
      "import" in value &&
      value.import &&
      typeof value.import === "string"
    ) {
      entrypoints.push(value.import);
    }
  }

  return entrypoints;
}

/**
 *
 * @param {Array<string | RegExp> | undefined} extraInternals
 * @default [...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.peerDependencies ?? {})]
 * @returns {Promise<Array<string | RegExp>>}
 */
async function listExternals(
  extraInternals: Array<string | RegExp>
): Promise<Array<string | RegExp>> {
  const packageJson = await getPackageJson();
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...extraInternals,
  ];
}

export async function checkTreeShaking(options?: TreeShakingArgs) {
  const externals = await listExternals(options?.extraInternals ?? []);
  const entrypoints = await listEntrypoints();
  const consoleInfo = console.info;
  const reportMap: Map<
    string,
    {
      log: string;
      hasUnexpectedSideEffects: boolean;
    }
  > = new Map();

  for (const entrypoint of entrypoints) {
    let sideEffects = "";

    console.info = function (...args) {
      const line = args.length ? args.join(" ") : "";
      if (line.includes("First side effect in")) {
        sideEffects += `${line}\n`;
      }
    };

    await rollup({
      external: externals,
      input: entrypoint,
      experimentalLogSideEffects: true,
    });

    let hasUnexpectedSideEffects = sideEffects.length > 0;
    if (hasUnexpectedSideEffects) {
      const entrypointContent = await fs.readFile(
        `./dist/${entrypoint.replace(/^\.\//, "")}`
      );
      // Allow escaping side effects strictly within code directly
      // within an entrypoint
      hasUnexpectedSideEffects = !entrypointContent
        .toString()
        .includes("/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */");
    }
    reportMap.set(entrypoint, {
      log: sideEffects,
      hasUnexpectedSideEffects,
    });
  }

  console.info = consoleInfo;

  let failed = false;
  for (const [entrypoint, report] of reportMap) {
    if (report.hasUnexpectedSideEffects) {
      failed = true;
      console.log("---------------------------------");
      console.log(`Tree shaking failed for ${entrypoint}`);
      console.log(report.log);
    }
  }

  if (failed) {
    throw new Error("Tree shaking checks failed.");
  } else {
    console.log("Tree shaking checks passed!");
  }
}
