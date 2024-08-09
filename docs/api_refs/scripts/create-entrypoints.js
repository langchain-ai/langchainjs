const fs = require("fs");
const path = require("path");

const BASE_TYPEDOC_CONFIG = {
  $schema: "https://typedoc.org/schema.json",
  out: "public",
  sort: [
    "kind",
    "visibility",
    "instance-first",
    "required-first",
    "alphabetical",
  ],
  plugin: [
    "./typedoc_plugins/hide_underscore_lc.js",
    "typedoc-plugin-expand-object-like-types",
  ],
  tsconfig: "../../tsconfig.json",
  excludePrivate: true,
  excludeInternal: true,
  excludeExternals: false,
  excludeNotDocumented: false,
  includeVersion: true,
  sourceLinkTemplate:
    "https://github.com/langchain-ai/langchainjs/blob/{gitRevision}/{path}#L{line}",
  logLevel: "Error",
  name: "LangChain.js",
  skipErrorChecking: true,
  exclude: ["dist"],
  hostedBaseUrl: "https://v02.api.js.langchain.com/",
  entryPointStrategy: "packages",
  entryPoints: ["../../langchain", "../../langchain-core", "../../libs/*"],
};

/**
 *
 * @param {string} relativePath
 * @param {any} updateFunction
 */
const updateJsonFile = (relativePath, updateFunction) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, JSON.stringify(res, null, 2) + "\n");
};

async function main() {
  const workspaces = fs
    .readdirSync("../../libs/")
    .filter((dir) => dir.startsWith("langchain-"))
    .map((dir) => path.join("../../libs/", dir, "/langchain.config.js"))
    .filter((configPath) => fs.existsSync(configPath));
  const configFiles = [
    "../../langchain/langchain.config.js",
    "../../langchain-core/langchain.config.js",
    ...workspaces,
  ]
    .map((configFile) => path.resolve(configFile))
    .filter((configFile) => !configFile.includes("/langchain-scripts/"));

  /** @type {Array<string>} */
  const blacklistedEntrypoints = JSON.parse(
    fs.readFileSync("./blacklisted-entrypoints.json")
  );

  for await (const configFile of configFiles) {
    const langChainConfig = await import(configFile);
    if (!("entrypoints" in langChainConfig.config)) {
      throw new Error(
        `The config file "${configFile}" does not contain any entrypoints.`
      );
    } else if (
      langChainConfig.config.entrypoints === null ||
      langChainConfig.config.entrypoints === undefined
    ) {
      continue;
    }
    const { config } = langChainConfig;

    const entrypointDir = path.relative(
      process.cwd(),
      configFile.split("/langchain.config.js")[0]
    );

    const deprecatedNodeOnly =
      "deprecatedNodeOnly" in config ? config.deprecatedNodeOnly : [];

    const workspaceEntrypoints = Object.values(config.entrypoints)
      .filter((key) => !deprecatedNodeOnly.includes(key))
      .filter(
        (key) =>
          !blacklistedEntrypoints.find(
            (blacklistedItem) =>
              blacklistedItem === `${entrypointDir}/src/${key}.ts`
          )
      )
      .map((key) => `src/${key}.ts`);

    const typedocPath = path.join(entrypointDir, "typedoc.json");

    if (!fs.existsSync(typedocPath)) {
      fs.writeFileSync(typedocPath, "{}\n");
    }

    updateJsonFile(typedocPath, (existingConfig) => ({
      ...existingConfig,
      entryPoints: workspaceEntrypoints,
      extends: typedocPath.includes("/libs/")
        ? ["../../docs/api_refs/typedoc.base.json"]
        : ["../docs/api_refs/typedoc.base.json"],
    }));
  }

  // Check if the `./typedoc.json` file exists, since it is gitignored by default
  if (!fs.existsSync("./typedoc.json")) {
    fs.writeFileSync("./typedoc.json", "{}\n");
  }

  updateJsonFile("./typedoc.json", () => ({
    ...BASE_TYPEDOC_CONFIG,
  }));
}

async function runMain() {
  try {
    await main();
  } catch (error) {
    console.error("An error occurred while creating the entrypoints.");
    throw error;
  }
}

runMain();
