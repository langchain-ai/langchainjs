#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { rollup } from "rollup";

/**
 * @typedef {Object} ExtraImportMapEntry
 * @property {Array<string>} modules
 * @property {Array<string>} alias 
 * @property {string} path
 */

/**
 * @typedef {Object} ImportData
 * @property {Record<string, string[]>} exportedAliases
 * @property {Record<string, string[]>} imports 
 */

/**
 * @param {any} obj 
 * @returns {obj is LangChainConfig}
 */
function _verifyObjectIsLangChainConfig(
  obj
) {
  if (typeof obj !== "object") {
    console.error("LangChain config file is not an object");
    return false;
  }
  if (
    !("entrypoints" in obj) ||
    !("tsConfigPath" in obj) ||
    !("cjsSource" in obj) ||
    !("cjsDestination" in obj) ||
    !("abs" in obj)
  ) {
    console.error(`LangChain config file is missing required fields. One of: entrypoints, tsConfigPath, cjsSource, cjsDestination, abs`);
    return false;
  }
  if (typeof obj.entrypoints !== "object") {
    console.error("entrypoints field in LangChain config file is not an object");
    return false;
  }
  if (Object.values(obj.entrypoints).some((v) => typeof v !== "string")) {
    console.error("entrypoints field in LangChain config file is not an object of strings");
    return false;
  }
  if (
    typeof obj.tsConfigPath !== "string" ||
    typeof obj.cjsSource !== "string" ||
    typeof obj.cjsDestination !== "string"
  ) {
    console.error("tsConfigPath, cjsSource, or cjsDestination fields in LangChain config file are not strings");
    return false;
  }
  if (typeof obj.abs !== "function") {
    console.error("abs field in LangChain config file is not a function");
    return false;
  }

  // Optional fields
  if (
    "requiresOptionalDependency" in obj &&
    (!Array.isArray(obj.requiresOptionalDependency) ||
      obj.requiresOptionalDependency.some((v) => typeof v !== "string"))
  ) {
    console.error("requiresOptionalDependency field in LangChain config file is not an array of strings");
    return false;
  }
  if (
    "deprecatedNodeOnly" in obj &&
    (!Array.isArray(obj.deprecatedNodeOnly) ||
      obj.deprecatedNodeOnly.some((v) => typeof v !== "string"))
  ) {
    console.error("deprecatedNodeOnly field in LangChain config file is not an array of strings");
    return false;
  }
  if (
    "deprecatedOmitFromImportMap" in obj &&
    (!Array.isArray(obj.deprecatedOmitFromImportMap) ||
      obj.deprecatedOmitFromImportMap.some((v) => typeof v !== "string"))
  ) {
    console.error("deprecatedOmitFromImportMap field in LangChain config file is not an array of strings");
    return false;
  }
  if ("packageSuffix" in obj && typeof obj.packageSuffix !== "string") {
    console.error("packageSuffix field in LangChain config file is not a string");
    return false;
  }
  if (
    "shouldTestExports" in obj &&
    typeof obj.shouldTestExports !== "boolean"
  ) {
    console.error("shouldTestExports field in LangChain config file is not a boolean");
    return false;
  }
  if (
    "extraImportMapEntries" in obj &&
    !Array.isArray(obj.extraImportMapEntries)
  ) {
    console.error("extraImportMapEntries field in LangChain config file is not an array");
    return false;
  }
  if (
    "gitignorePaths" in obj &&
    (!Array.isArray(obj.gitignorePaths) ||
      obj.gitignorePaths.some((v) => typeof v !== "string"))
  ) {
    console.error("gitignorePaths field in LangChain config file is not an array of strings");
    return false;
  }
  if ("internals" in obj && !Array.isArray(obj.internals)) {
    console.error("internals field in LangChain config file is not an array");
    return false;
  }
  return true;
}


async function moveAndRename({
  /** @type {string} */
  source,
  /** @type {string} */
  dest,
  /** @type {(p: string) => string} */
  abs,
}) {
  try {
    for (const file of await fs.promises.readdir(abs(source), { withFileTypes: true })) {
      if (file.isDirectory()) {
        await moveAndRename({
          source: `${source}/${file.name}`,
          dest: `${dest}/${file.name}`,
          abs,
        });
      } else if (file.isFile()) {
        const parsed = path.parse(file.name);

        // Ignore anything that's not a .js file
        if (parsed.ext !== ".js") {
          continue;
        }

        // Rewrite any require statements to use .cjs
        const content = await fs.promises.readFile(abs(`${source}/${file.name}`), "utf8");
        const rewritten = content.replace(
          /require\("(\..+?).js"\)/g,
          (_, p1) => `require("${p1}.cjs")`
        );

        // Rename the file to .cjs
        const renamed = path.format({ name: parsed.name, ext: ".cjs" });

        await fs.promises.writeFile(abs(`${dest}/${renamed}`), rewritten, "utf8");
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

/** @returns {Promise<PackageJSON>} */
async function getPackageJson() {
  return JSON.parse(await fs.promises.readFile("package.json", "utf-8"));
}

async function listEntrypoints() {
  const { exports } = await getPackageJson();
  /** @type {Record<string, ExportsMapValue | string> | null} */
  const exportsWithoutPackageJSON = exports
    ? Object.entries(exports)
      .filter(([k]) => k !== "./package.json")
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
    : null;

  if (!exportsWithoutPackageJSON) {
    throw new Error("No exports found in package.json");
  }
  /** @type {string[]} */
  const entrypoints = [];

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
 * @param {Array<string | RegExp>} extraInternals
 * @default [...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.peerDependencies ?? {})]
 * @returns {Promise<Array<string | RegExp>>}
 */
async function listExternals(
  extraInternals
) {
  const packageJson = await getPackageJson();
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...extraInternals,
  ];
}

/**
 * 
 * @param {undefined | TreeShakingArgs} options 
 */
export async function checkTreeShaking(options) {
  const externals = await listExternals(options?.extraInternals ?? []);
  const entrypoints = await listEntrypoints();
  const consoleLog = console.log;
  /** @type {Map<string, { log: string; hasSideEffects: boolean; }>} */
  const reportMap = new Map();

  for (const entrypoint of entrypoints) {
    let sideEffects = "";

    console.log = function (...args) {
      const line = args.length ? args.join(" ") : "";
      if (line.trim().startsWith("First side effect in")) {
        sideEffects += `${line}\n`;
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


function identifySecrets(absTsConfigPath) {
  const secrets = new Set();

  const tsConfig = ts.parseJsonConfigFileContent(
    ts.readJsonConfigFile(absTsConfigPath, (p) => fs.readFileSync(p, "utf-8")),
    ts.sys,
    "./src/"
  );

  // `tsConfig.options.target` is not always defined when running this
  // via the `@langchain/scripts` package. Instead, fallback to the raw
  // tsConfig.json file contents.
  const tsConfigFileContentsText =
    "text" in tsConfig.raw
      ? JSON.parse(tsConfig.raw.text)
      : { compilerOptions: {} };

  const tsConfigTarget =
    tsConfig.options.target || tsConfigFileContentsText.compilerOptions.target;

  for (const fileName of tsConfig.fileNames.filter(
    (fn) => !fn.endsWith("test.ts")
  )) {
    if (!tsConfigTarget) {
      continue;
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      fs.readFileSync(fileName, "utf-8"),
      tsConfigTarget,
      true
    );

    sourceFile.forEachChild((node) => {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression: {
          node.forEachChild((node) => {
            // look for get lc_secrets()
            switch (node.kind) {
              case ts.SyntaxKind.GetAccessor: {
                const property = node;
                if (
                  ts.isGetAccessor(property) &&
                  property.name.getText() === "lc_secrets"
                ) {
                  // look for return { ... }
                  property.body?.statements.forEach((stmt) => {
                    if (
                      ts.isReturnStatement(stmt) &&
                      stmt.expression &&
                      ts.isObjectLiteralExpression(stmt.expression)
                    ) {
                      stmt.expression.properties.forEach((element) => {
                        if (ts.isPropertyAssignment(element)) {
                          // Type guard for PropertyAssignment
                          if (
                            element.initializer &&
                            ts.isStringLiteral(element.initializer)
                          ) {
                            const secret = element.initializer.text;

                            if (secret.toUpperCase() !== secret) {
                              throw new Error(
                                `Secret identifier must be uppercase: ${secret} at ${fileName}`
                              );
                            }
                            if (/\s/.test(secret)) {
                              throw new Error(
                                `Secret identifier must not contain whitespace: ${secret} at ${fileName}`
                              );
                            }

                            secrets.add(secret);
                          }
                        }
                      });
                    }
                  });
                }
                break;
              }
              default:
                break;
            }
          });
          break;
        }
        default:
          break;
      }
    });
  }

  return secrets;
}

// .gitignore
const DEFAULT_GITIGNORE_PATHS = ["node_modules", "dist", ".yarn"];

/**
 * List of test-exports-* packages which we use to test that the exports field
 * works correctly across different JS environments.
 * Each entry is a tuple of [package name, import statement].
 * @type {Array<[string, (p: string) => string]>}
 */
const testExports = [
  [
    "test-exports-esm",
    (p) =>
      `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-esbuild",
    (p) =>
      `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-cjs",
    (p) =>
      `const ${p.replace(/\//g, "_")} = require("langchain/${p}");`,
  ],
  ["test-exports-cf", (p) => `export * from "langchain/${p}";`],
  ["test-exports-vercel", (p) => `export * from "langchain/${p}";`],
  ["test-exports-vite", (p) => `export * from "langchain/${p}";`],
  ["test-exports-bun", (p) => `export * from "langchain/${p}";`],
];

/**
 * 
 * @param {string} relativePath 
 * @param {(json: Record<string, unknown>) => Record<string, unknown>} updateFunction 
 */
const updateJsonFile = (
  relativePath,
  updateFunction
) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, `${JSON.stringify(res, null, 2)}\n`);
};

/**
 * @param {Record<string, string>} entrypoints 
 * @returns {Record<string, string>}
 */
const generateFiles = (
  entrypoints
) => {
  const files = [...Object.entries(entrypoints)].flatMap(([key, value]) => {
    const nrOfDots = key.split("/").length - 1;
    const relativePath = "../".repeat(nrOfDots) || "./";
    const compiledPath = `${relativePath}dist/${value}.js`;
    return [
      [
        `${key}.cjs`,
        `module.exports = require('${relativePath}dist/${value}.cjs');`,
      ],
      [`${key}.js`, `export * from '${compiledPath}'`],
      [`${key}.d.ts`, `export * from '${compiledPath}'`],
      [`${key}.d.cts`, `export * from '${compiledPath}'`],
    ];
  });

  return Object.fromEntries(files);
};

const updateConfig = ({
  /** @type {Record<string, string>} */
  entrypoints,
  /** @type {Array<string>} */
  deprecatedNodeOnly,
  /** @type {Array<string>} */
  requiresOptionalDependency,
  /** @type {boolean} */
  shouldTestExports,
  /** @type {Array<string> | undefined} */
  additionalGitignorePaths = [],
}) => {
  const generatedFiles = generateFiles(entrypoints);
  const filenames = Object.keys(generatedFiles);

  // Update package.json `exports` and `files` fields
  updateJsonFile("./package.json", (json) => ({
    ...json,
    exports: Object.assign(
      Object.fromEntries(
        [...Object.keys(entrypoints)].map((key) => {
          const entryPoint = {
            types: {
              import: `./${key}.d.ts`,
              require: `./${key}.d.cts`,
              default: `./${key}.d.ts`,
            },
            import: `./${key}.js`,
            require: `./${key}.cjs`,
          };

          return [key === "index" ? "." : `./${key}`, entryPoint];
        })
      ),
      { "./package.json": "./package.json" }
    ),
    files: ["dist/", ...filenames],
  }));

  // Write generated files
  Object.entries(generatedFiles).forEach(([filename, content]) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  });

  const gitignorePaths = [...filenames, ...DEFAULT_GITIGNORE_PATHS, ...(additionalGitignorePaths ? additionalGitignorePaths : [])];

  // Update .gitignore
  fs.writeFileSync(
    "./.gitignore",
    `${gitignorePaths.join("\n")}\n`
  );

  if (shouldTestExports) {
    // Update test-exports-*/entrypoints.js
    const entrypointsToTest = Object.keys(entrypoints)
      .filter((key) => !deprecatedNodeOnly.includes(key))
      .filter((key) => !requiresOptionalDependency.includes(key));
    testExports.forEach(([pkg, importStatement]) => {
      const contents = `${entrypointsToTest
        .map((key) => importStatement(key))
        .join("\n")}\n`;
      fs.writeFileSync(
        `../environment_tests/${pkg}/src/entrypoints.js`,
        contents
      );
    });
  }
};

const cleanGenerated = ({
  /** @type {Record<string, string>} */
  entrypoints,
}) => {
  const filenames = Object.keys(generateFiles(entrypoints));
  filenames.forEach((fname) => {
    try {
      fs.unlinkSync(fname);
    } catch {
      // ignore error
    }
  });
};

// Tuple describing the auto-generated import map (used by langchain/load)
// [package name, import statement, import map path]
// This will not include entrypoints deprecated or requiring optional deps.
/**
 * 
 * @param {string | null} packageSuffix 
 * @returns {[string, (k: string, p: string) => string, string]}
 */
const importMap = (
  packageSuffix
) => [
    `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
    (k, p) =>
      `export * as ${k.replace(/\//g, "__")} from "../${p}.js";`,
    "src/load/import_map.ts",
  ];

const generateImportMap = ({
  /** @type {Record<string, string>} */
  entrypoints,
  /** @type {Array<string>} */
  requiresOptionalDependency,
  /** @type {Array<string>} */
  deprecatedNodeOnly,
  /** @type {Array<string>} */
  deprecatedOmitFromImportMap,
  /** @type {string | null} */
  packageSuffix,
  /** @type {Array<ExtraImportMapEntry>} */
  extraImportMapEntries,
}) => {
  // Generate import map
  const entrypointsToInclude = Object.keys(entrypoints)
    .filter((key) => key !== "load")
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => !requiresOptionalDependency.includes(key))
    .filter((key) => !deprecatedOmitFromImportMap.includes(key));
  const [pkg, importStatement, importMapPath] = importMap(packageSuffix);
  const contents = `${entrypointsToInclude
    .map((key) => importStatement(key, entrypoints[key]))
    .join("\n")}\n`;
  const extraImportData = extraImportMapEntries.reduce(
    (data, { modules, alias, path }) => {
      const newData = { ...data };
      if (!newData.imports[path]) {
        newData.imports[path] = [];
      }
      newData.imports[path] = [
        ...new Set(newData.imports[path].concat(modules)),
      ];
      const exportAlias = alias.join("__");
      if (!newData.exportedAliases[exportAlias]) {
        newData.exportedAliases[exportAlias] = [];
      }
      newData.exportedAliases[exportAlias] =
        newData.exportedAliases[exportAlias].concat(modules);
      return newData;
    },
    {
      imports: {},
      exportedAliases: {},
    }
  );
  const extraImportStatements = Object.entries(extraImportData.imports).map(
    ([path, modules]) =>
      `import {\n  ${modules.join(",\n  ")}\n} from "${path}";`
  );
  const extraDeclarations = Object.entries(extraImportData.exportedAliases).map(
    ([exportAlias, modules]) =>
      [
        `const ${exportAlias} = {\n  ${modules.join(",\n  ")}\n};`,
        `export { ${exportAlias} };`,
      ].join("\n")
  );
  let extraContent = `${extraImportStatements.join(
    "\n"
  )}\n${extraDeclarations.join("\n")}\n`;

  extraContent.trim();
  if (!/[a-zA-Z0-9]/.test(extraContent)) {
    extraContent = ""
  }

  fs.writeFileSync(
    `../${pkg}/${importMapPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.\n\n${contents}${extraContent}`
  );
};

/**
 * 
 * @param {string | null} packageSuffix 
 * @returns {[string, string]}
 */
const importTypes = (packageSuffix) => [
  `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
  "src/load/import_type.ts",
];

const generateImportTypes = ({
  /** @type {string} */
  absTsConfigPath,
  /** @type {string | null} */
  packageSuffix,
}) => {
  // Generate import types
  const [pkg, importTypesPath] = importTypes(packageSuffix);

  fs.writeFileSync(
    `../${pkg}/${importTypesPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.

export interface OptionalImportMap {}

export interface SecretMap {
${[...identifySecrets(absTsConfigPath)]
      .sort()
      .map((secret) => `  ${secret}?: string;`)
      .join("\n")}
}
`
  );
};

/**
 * @param {string | null} packageSuffix 
 * @returns {[string, (k: string) => string, string]}
 */
const importConstants = (
  packageSuffix
) => [
    `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
    (k) =>
      `  "langchain${packageSuffix ? `_${packageSuffix}` : ""}/${k}"`,
    "src/load/import_constants.ts",
  ];

const generateImportConstants = ({
  /** @type {Record<string, string>} */
  entrypoints,
  /** @type {Array<string>} */
  requiresOptionalDependency,
  /** @type {Array<string>} */
  deprecatedNodeOnly,
  /** @type {string | null} */
  packageSuffix,
}) => {
  // Generate import constants
  const entrypointsToInclude = Object.keys(entrypoints)
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => requiresOptionalDependency.includes(key));
  const [pkg, importStatement, importConstantsPath] =
    importConstants(packageSuffix);
  const contents =
    entrypointsToInclude.length > 0
      ? `\n${entrypointsToInclude
        .map((key) => importStatement(key))
        .join(",\n")},\n];\n`
      : "];\n";
  fs.writeFileSync(
    `../${pkg}/${importConstantsPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.\n\nexport const optionalImportEntrypoints: string[] = [${contents}`
  );
};

export function createEntrypoints({
  /**
   * This lists all the entrypoints for the library. Each key corresponds to an
   * importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
   * The value is the path to the file in `src/` that exports the entrypoint.
   * This is used to generate the `exports` field in package.json.
   * Order is not important.
   * @type {Record<string, string>}
   */
  entrypoints,
  /**
   * Entrypoints in this list require an optional dependency to be installed.
   * Therefore they are not tested in the generated test-exports-* packages.
   * @type {undefined | string[]}
   */
  requiresOptionalDependency = [],
  /**
   * Entrypoints in this list will
   * 1. Be excluded from the documentation
   * 2. Be only available in Node.js environments (for backwards compatibility)
   * @type {undefined | string[]}
   */
  deprecatedNodeOnly = [],
  /**
   * Endpoints that are deprecated due to redundancy. Will not appear in the import map.
   * @type {string[]}
   */
  deprecatedOmitFromImportMap = [],
  /**
   * The suffix of the package. Eg. `community` for `@langchain/community`.
   * Used in the generated import map.
   * @type {undefined | string}
   */
  packageSuffix,
  /**
   * Whether or not to write to the test exports files. At the moment this only
   * applies to the `langchain` package.
   * @type {undefined | boolean}
   */
  shouldTestExports = false,
  /**
   * Extra entries to add to the import map.
   * @type {undefined | Array<ExtraImportMapEntry>}
   */
  extraImportMapEntries = [],
  /**
   * The absolute path to the tsconfig.json file.
   * @type {string}
   */
  absTsConfigPath,
  /**
   * Whether or not the pre command was passed.
   * @type {boolean}
   */
  isPre,
  /**
   * Whether or not to generate import maps
   * @type {boolean}
   */
  shouldGenMaps,
  /**
   * Additional paths to add to the .gitignore file.
   * @type {Array<string> | undefined}
   */
  additionalGitignorePaths,
}) {
  if (isPre) {
    cleanGenerated({ entrypoints });
    if (shouldGenMaps) {
      generateImportMap({
        entrypoints,
        requiresOptionalDependency,
        deprecatedNodeOnly,
        deprecatedOmitFromImportMap,
        packageSuffix: packageSuffix ?? null,
        extraImportMapEntries,
      });
      generateImportTypes({
        absTsConfigPath,
        packageSuffix: packageSuffix ?? null,
      });
      generateImportConstants({
        entrypoints,
        requiresOptionalDependency,
        deprecatedNodeOnly,
        packageSuffix: packageSuffix ?? null,
      });
    }
  } else {
    updateConfig({
      entrypoints,
      deprecatedNodeOnly,
      requiresOptionalDependency,
      shouldTestExports,
      additionalGitignorePaths,
    });
  }
}


// --------SCRIPT CONTENT--------

async function main() {
  const program = new Command();
  program
    .description("Run a build script for a LangChain package.")
    .option(
      "--config <config>",
      "Path to the config file, defaults to ./langchain.config.js"
    )
    .option(
      "--create-entrypoints",
      "Pass only if you want to create entrypoints"
    )
    .option("--tree-shaking", "Pass only if you want to check tree shaking")
    .option("--move-cjs-dist", "Pass only if you want to move cjs to dist")
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

  /** @type {LangChainConfig} */
  let config;
  try {
    const { config: lcConfig } = await import(resolvedConfigPath);
    if (!_verifyObjectIsLangChainConfig(lcConfig)) {
      throw new Error("Invalid config object.");
    }
    config = lcConfig;
  } catch (e) {
    console.error(
      `Failed to read config file at path: ${configFilePath}.\n\n${e}`
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
      additionalGitignorePaths: config.additionalGitignorePaths,
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
