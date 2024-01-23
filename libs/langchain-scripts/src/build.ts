#!/usr/bin/env node

import { Command } from "commander";
import path from "node:path";
import { createEntrypoints } from "./create-entrypoints.js";
import { checkTreeShaking } from "./check-tree-shaking.js";
import { moveAndRename } from "./move-cjs-to-dist.js";
import type { LangChainConfig } from "./types.js";

export type { LangChainConfig } from "./types.js";

async function main() {
  const program = new Command();
  program
    .description("Release a new workspace version to NPM.")
    .option(
      "--config <config>",
      "Path to the config file, eg ./langchain.config.js"
    )
    .option(
      "--create-entrypoints",
      "Boolean, pass only if you want to create entrypoints"
    )
    .option(
      "--tree-shaking",
      "Boolean, pass only if you want to check tree shaking"
    )
    .option(
      "--move-cjs-dist",
      "Boolean, pass only if you want to move cjs to dist"
    )
    .option("--pre")
    .option("--gen-maps");

  program.parse();

  const options = program.opts();

  const shouldCreateEntrypoints = options.createEntrypoints;
  const shouldCheckTreeShaking = options.treeShaking;
  const shouldMoveCjsDist = options.moveCjsDist;
  const isPre = options.pre;
  const shouldGenMaps = options.genMaps;
  const configFilePath = options.config ?? "./langchain.config.js";
  const resolvedConfigPath = path.resolve(process.cwd(), configFilePath);

  let config: LangChainConfig;
  try {
    const { config: lcConfig } = await import(resolvedConfigPath);
    config = lcConfig;
  } catch (e) {
    console.error(
      `Failed to read config file at path: ${configFilePath}.\n\nError: ${JSON.stringify(
        e,
        null,
        2
      )}`
    );
    process.exit(1);
  }

  if (
    [shouldCreateEntrypoints, shouldCheckTreeShaking, shouldMoveCjsDist].filter(
      Boolean
    ).length > 1
  ) {
    console.error(
      "Can only run one script at a time. Please pass only one of --create-entrypoints, --tree-shaking, --move-cjs-dist"
    );
    process.exit(1);
  }

  if (
    [shouldCreateEntrypoints, shouldCheckTreeShaking, shouldMoveCjsDist].filter(
      Boolean
    ).length === 0
  ) {
    console.error(
      "No script specified. Please pass one of --create-entrypoints, --tree-shaking, --move-cjs-dist"
    );
    process.exit(1);
  }

  if (
    (isPre || shouldGenMaps) &&
    [shouldCheckTreeShaking, shouldMoveCjsDist].filter(Boolean).length >= 1
  ) {
    console.error(
      "Can not pass --pre or --gen-maps with --tree-shaking or --move-cjs-dist"
    );
    process.exit(1);
  }

  if (shouldCreateEntrypoints) {
    createEntrypoints({
      entrypoints: config.entrypoints,
      requiresOptionalDependency: config.requiresOptionalDependency,
      deprecatedNodeOnly: config.deprecatedNodeOnly,
      deprecatedOmitFromImportMap: config.deprecatedOmitFromImportMap,
      packageSuffix: config.packageSuffix,
      shouldTestExports: config.shouldTestExports,
      extraImportMapEntries: config.extraImportMapEntries,
      absTsConfigPath: config.tsConfigPath,
      isPre,
      shouldGenMaps,
    });
  }

  if (shouldCheckTreeShaking) {
    await checkTreeShaking({
      extraInternals: config.internals,
    });
  }

  if (shouldMoveCjsDist) {
    await moveAndRename({
      source: config.cjsSource,
      dest: config.cjsDestination,
      abs: config.abs,
    });
  }
}

/* #__PURE__ */ main().catch((e) => {
  console.error(e);
  process.exit(1);
});
