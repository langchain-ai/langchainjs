import { spawn } from "node:child_process";
import ts from "typescript";
import fs from "node:fs";
import { Command } from "commander";
import { rollup } from "@rollup/wasm-node";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { ExportsMapValue, ImportData, LangChainConfig } from "../types.js";
import { hasTsupConfig } from "./utils.js";

// For ES modules replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function asyncSpawn(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: {
        // eslint-disable-next-line no-process-env
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=8192",
      },
      shell: true,
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Run tsup build process using the tsup.config.ts file for configuration
 */
async function runTsupBuild() {
  console.log("🚀 Building with tsup...");
  try {
    // Run type checking first
    await asyncSpawn("tsc", ["--noEmit"]);

    // Run tsup using the config file
    await asyncSpawn("npx", ["tsup-node"]);

    console.log("✅ tsup build completed successfully");
    return true;
  } catch (error) {
    console.error("❌ tsup build failed:", error);
    return false;
  }
}

const fsRmRfSafe = async (inputPath: string) => {
  try {
    await fs.promises.rm(inputPath, { recursive: true, force: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(
      `Error deleting directory via fs.promises.rm: ${error.code}. Path: ${inputPath}`
    );
  }
};

const fsUnlinkSafe = async (filePath: string) => {
  try {
    await fs.promises.unlink(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(
      `Error deleting file via fs.promises.unlink: ${error.code}. Path: ${filePath}`
    );
  }
};

const NEWLINE = `
`;

// List of test-exports-* packages which we use to test that the exports field
// works correctly across different JS environments.
// Each entry is a tuple of [package name, import statement].
const testExports: Array<[string, (p: string) => string]> = [
  [
    "test-exports-esm",
    (p: string) =>
      `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-esbuild",
    (p: string) =>
      `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-cjs",
    (p: string) =>
      `const ${p.replace(/\//g, "_")} = require("langchain/${p}");`,
  ],
  ["test-exports-cf", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-vercel", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-vite", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-bun", (p: string) => `export * from "langchain/${p}";`],
];

const DEFAULT_GITIGNORE_PATHS = ["node_modules", "dist", ".yarn"];

async function createImportMapFile(config: LangChainConfig): Promise<void> {
  const createImportStatement = (k: string, p: string) =>
    `export * as ${k.replace(/\//g, "__")} from "../${
      p.replace("src/", "").endsWith(".ts")
        ? p.replace(".ts", ".js")
        : `${p}.js`
    }";`;

  const entrypointsToInclude = Object.keys(config.entrypoints)
    .filter((key) => key !== "load")
    .filter((key) => !config.deprecatedNodeOnly?.includes(key))
    .filter((key) => !config.requiresOptionalDependency?.includes(key))
    .filter((key) => !config.deprecatedOmitFromImportMap?.includes(key));
  const importMapExports = entrypointsToInclude
    .map((key) => `${createImportStatement(key, config.entrypoints[key])}`)
    .join("\n");

  let extraContent = "";
  if (config.extraImportMapEntries) {
    const extraImportData = config.extraImportMapEntries?.reduce<ImportData>(
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
    const extraDeclarations = Object.entries(
      extraImportData.exportedAliases
    ).map(([exportAlias, modules]) =>
      [
        `const ${exportAlias} = {\n  ${modules.join(",\n  ")}\n};`,
        `export { ${exportAlias} };`,
      ].join("\n")
    );
    extraContent = `${extraImportStatements.join(
      "\n"
    )}\n${extraDeclarations.join("\n")}\n`;

    extraContent.trim();
    if (!/[a-zA-Z0-9]/.test(extraContent)) {
      extraContent = "";
    }
  }

  const importMapContents = `// Auto-generated by build script. Do not edit manually.\n\n${importMapExports}\n${extraContent}`;
  await fs.promises.writeFile("src/load/import_map.ts", importMapContents);
}

async function generateImportConstants(config: LangChainConfig): Promise<void> {
  // Generate import constants
  const entrypointsToInclude = Object.keys(config.entrypoints)
    .filter((key) => !config.deprecatedNodeOnly?.includes(key))
    .filter((key) => config.requiresOptionalDependency?.includes(key));
  const importConstantsPath = "src/load/import_constants.ts";
  const createImportStatement = (k: string) =>
    `  "langchain${
      config.packageSuffix ? `_${config.packageSuffix}` : ""
    }/${k}"`;
  const contents =
    entrypointsToInclude.length > 0
      ? `\n${entrypointsToInclude
          .map((key) => createImportStatement(key))
          .join(",\n")},\n];\n`
      : "];\n";
  await fs.promises.writeFile(
    `${importConstantsPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.\n\nexport const optionalImportEntrypoints: string[] = [${contents}`
  );
}

const generateFiles = (config: LangChainConfig): Record<string, string> => {
  const files = [...Object.entries(config.entrypoints)].flatMap(
    ([key, value]) => {
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
    }
  );

  return Object.fromEntries(files);
};

async function updateExportTestFiles(config: LangChainConfig): Promise<void[]> {
  // Update test-exports-*/entrypoints.js
  const entrypointsToTest = Object.keys(config.entrypoints)
    .filter((key) => !config.deprecatedNodeOnly?.includes(key))
    .filter((key) => !config.requiresOptionalDependency?.includes(key));

  return Promise.all(
    testExports.map(async ([pkg, importStatement]) => {
      const contents = `${entrypointsToTest
        .map((key) => importStatement(key))
        .join("\n")}\n`;
      return fs.promises.writeFile(
        `../environment_tests/${pkg}/src/entrypoints.js`,
        contents
      );
    })
  );
}

async function writeTopLevelGeneratedFiles(
  generatedFiles: Record<string, string>
): Promise<void[]> {
  return Promise.all(
    Object.entries(generatedFiles).map(async ([filename, content]) => {
      await fs.promises.mkdir(path.dirname(filename), { recursive: true });
      await fs.promises.writeFile(filename, content);
    })
  );
}

async function updateGitIgnore(
  config: LangChainConfig,
  filenames: string[]
): Promise<void> {
  const gitignorePaths = [
    ...filenames,
    ...DEFAULT_GITIGNORE_PATHS,
    ...(config.additionalGitignorePaths ? config.additionalGitignorePaths : []),
  ];

  // Update .gitignore
  return fs.promises.writeFile(
    "./.gitignore",
    `${gitignorePaths.join("\n")}\n`
  );
}

async function updatePackageJson(config: LangChainConfig): Promise<void> {
  const packageJson = JSON.parse(
    await fs.promises.readFile(`package.json`, "utf8")
  );
  const generatedFiles = generateFiles(config);
  const filenames = Object.keys(generatedFiles);
  packageJson.files = ["dist/", ...filenames];
  packageJson.exports = Object.keys(config.entrypoints).reduce(
    (acc: Record<string, ExportsMapValue>, key) => {
      let entrypoint = `./${key}`;
      if (key === "index") {
        entrypoint = ".";
      }
      acc[entrypoint] = {
        types: {
          import: `./${key}.d.ts`,
          require: `./${key}.d.cts`,
          default: `./${key}.d.ts`,
        },
        import: `./${key}.js`,
        require: `./${key}.cjs`,
      };
      return acc;
    },
    {}
  );
  packageJson.exports = {
    ...packageJson.exports,
    "./package.json": "./package.json",
  };

  let packageJsonString = JSON.stringify(packageJson, null, 2);
  if (
    !packageJsonString.endsWith("\n") &&
    !packageJsonString.endsWith(NEWLINE)
  ) {
    packageJsonString += NEWLINE;
  }

  // Write package.json and generate d.cts files
  // Optionally, update test exports files
  await Promise.all([
    fs.promises.writeFile(`package.json`, packageJsonString),
    writeTopLevelGeneratedFiles(generatedFiles),
    updateGitIgnore(config, filenames),
    config.shouldTestExports
      ? updateExportTestFiles(config)
      : Promise.resolve(),
  ]);
}

/**
 * Update the tsup.config.ts file's entrypoints based on the entrypoints listed in the
 * {@link LangChainConfig} object.
 */
async function updateTsupConfig(config: LangChainConfig): Promise<void> {
  const tsupConfigPath = path.resolve(process.cwd(), "tsup.config.ts");

  if (!fs.existsSync(tsupConfigPath)) {
    console.warn(
      `⚠️ tsup.config.ts not found at ${tsupConfigPath}. Skipping update.`
    );
    return;
  }

  console.log(
    "🔄 Updating tsup.config.ts with entrypoints from LangChainConfig..."
  );

  try {
    const fileContent = await fs.promises.readFile(tsupConfigPath, "utf8");
    const sourceFile = ts.createSourceFile(
      tsupConfigPath, // Use actual path for diagnostics if any
      fileContent,
      ts.ScriptTarget.Latest,
      true // setParentNodes
    );

    const newEntryPaths = Object.values(config.entrypoints).map(
      (value) => `src/${value}.ts`
    );

    const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (
      context
    ) => {
      const visit: ts.Visitor = (node) => {
        // Check if this is the ObjectLiteralExpression inside defineConfig
        if (
          ts.isObjectLiteralExpression(node) &&
          node.parent &&
          ts.isCallExpression(node.parent)
        ) {
          const callExpr = node.parent;
          if (
            ts.isIdentifier(callExpr.expression) &&
            callExpr.expression.escapedText === "defineConfig" &&
            callExpr.arguments.some((arg) => arg === node)
          ) {
            // This is the main config object passed to defineConfig
            const updatedProperties: ts.ObjectLiteralElementLike[] = [];
            let entryFoundAndUpdated = false;

            for (const property of node.properties) {
              if (
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.escapedText === "entry"
              ) {
                const newStringLiterals = newEntryPaths.map(
                  (entryPath) =>
                    context.factory.createStringLiteral(entryPath, true) // true for single quotes
                );
                const newArrayLiteral =
                  context.factory.createArrayLiteralExpression(
                    newStringLiterals,
                    true // multiLine
                  );
                updatedProperties.push(
                  context.factory.updatePropertyAssignment(
                    property,
                    property.name,
                    newArrayLiteral
                  )
                );
                entryFoundAndUpdated = true;
              } else {
                updatedProperties.push(property);
              }
            }

            if (entryFoundAndUpdated) {
              return context.factory.updateObjectLiteralExpression(
                node,
                updatedProperties
              );
            }
            // If 'entry' was not found, we could add it here.
            // For now, this only updates an existing 'entry' property.
            // If the template guarantees 'entry', this is fine.
            // Otherwise, to add it if missing:
            // else {
            //   const newStringLiterals = newEntryPaths.map((entryPath) =>
            //     context.factory.createStringLiteral(entryPath, true)
            //   );
            //   const newEntryProperty = context.factory.createPropertyAssignment(
            //     context.factory.createIdentifier("entry"),
            //     context.factory.createArrayLiteralExpression(newStringLiterals, true)
            //   );
            //   return context.factory.updateObjectLiteralExpression(node, [
            //     ...node.properties,
            //     newEntryProperty,
            //   ]);
            // }
          }
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (rootNode) => ts.visitNode(rootNode, visit) as ts.SourceFile;
    };

    const transformationResult = ts.transform(sourceFile, [transformerFactory]);
    const transformedSourceFile = transformationResult.transformed[0];

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      omitTrailingSemicolon: true, // Common preference
    });
    const updatedContent = printer.printFile(transformedSourceFile);

    await fs.promises.writeFile(tsupConfigPath, updatedContent, "utf8");
    console.log("✅ Successfully updated tsup.config.ts");

    // Run prettier on the updated file
    console.log("💅 Formatting tsup.config.ts with Prettier...");
    try {
      await asyncSpawn("npx", ["prettier", "--write", tsupConfigPath]);
      console.log("✅ Successfully formatted tsup.config.ts");
    } catch (prettierError) {
      console.warn(
        "⚠️ Failed to format tsup.config.ts with Prettier:",
        prettierError
      );
      // Do not re-throw here, as the main update was successful
    }
  } catch (error) {
    console.error("❌ Failed to update tsup.config.ts:", error);
    throw error; // Re-throw to indicate failure to the build process
  }
}

export function identifySecrets(absTsConfigPath: string) {
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
      ? JSON.parse(tsConfig.raw.text as string)
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

async function generateImportTypes(config: LangChainConfig): Promise<void> {
  // Generate import types
  const pkg = `langchain${
    config.packageSuffix ? `-${config.packageSuffix}` : ""
  }`;
  const importTypesPath = "src/load/import_type.ts";

  await fs.promises.writeFile(
    `../${pkg}/${importTypesPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.

export interface OptionalImportMap {}

export interface SecretMap {
${[...identifySecrets(config.tsConfigPath)]
  .sort()
  .map((secret) => `  ${secret}?: string;`)
  .join("\n")}
}
`
  );
}

function listExternals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packageJson: Record<string, any>,
  extraInternals?: Array<string | RegExp>
) {
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...(extraInternals || []),
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listEntrypoints(packageJson: Record<string, any>) {
  const { exports } = packageJson;
  /** @type {Record<string, ExportsMapValue | string> | null} */
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
 * Checks whether or not the file has side effects marked with the `__LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__`
 * keyword comment. If it does, this function will return `true`, otherwise it will return `false`.
 *
 * @param {string} entrypoint
 * @returns {Promise<boolean>} Whether or not the file has side effects which are explicitly marked as allowed.
 */
const checkAllowSideEffects = async (
  entrypoint: string,
  filename?: string
): Promise<boolean> => {
  let entrypointContent;
  try {
    entrypointContent = await fs.promises.readFile(`./dist/${entrypoint}.js`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.message.includes("ENOENT")) {
      // Entrypoint is likely via an `index.js` file, retry with `index.js` appended to path
      entrypointContent = await fs.promises.readFile(
        `./dist/${entrypoint}/index.js`
      );
    } else {
      entrypointContent = Buffer.from("");
    }
  }

  let fileContent;
  try {
    fileContent = await fs.promises.readFile(`./${filename}`);
  } catch (e) {
    fileContent = Buffer.from("");
  }

  // Allow escaping side effects strictly within code directly
  // within an entrypoint
  return (
    entrypointContent
      .toString()
      .includes("/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */") ||
    fileContent
      .toString()
      .includes("/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */")
  );
};

async function checkTreeShaking(config: LangChainConfig) {
  const packageJson = JSON.parse(
    await fs.promises.readFile("package.json", "utf8")
  );
  const externals = listExternals(packageJson, config?.internals ?? []);
  const entrypoints = listEntrypoints(packageJson);
  const consoleInfo = console.info;
  /** @type {Map<string, { log: string; hasUnexpectedSideEffects: boolean; }>} */
  const reportMap = new Map();

  for (const entrypoint of entrypoints) {
    const sideEffects: { log: string; filename?: string }[] = [];

    console.info = function (...args) {
      const line = args.length ? args.join(" ") : "";
      if (line.includes("First side effect in")) {
        const match = line.match(/First side effect in (.+?) is at/);
        const filename = match ? match[1] : undefined;
        sideEffects.push({ log: `${line}\n`, filename });
      }
    };

    await rollup({
      external: externals,
      input: entrypoint,
      experimentalLogSideEffects: true,
      treeshake: {
        manualPureFunctions: ["__export"],
      },
    });

    let hasUnexpectedSideEffects = false;
    for (const sideEffect of sideEffects) {
      if (sideEffect.filename) {
        // Map the entrypoint back to the actual file entrypoint using the LangChainConfig file
        const actualEntrypoint =
          config.entrypoints[entrypoint.replace(/^\.\/|\.js$/g, "")];
        const allowSideEffects = await checkAllowSideEffects(
          actualEntrypoint,
          sideEffect.filename
        );
        if (!allowSideEffects) {
          hasUnexpectedSideEffects = true;
          break;
        }
      } else {
        // If we can't determine the filename, we'll consider it an unexpected side effect
        hasUnexpectedSideEffects = true;
        break;
      }
    }

    reportMap.set(entrypoint, {
      log: sideEffects.map(({ log }) => log).join(""),
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
    // TODO: Throw a hard error here
    console.log("Tree shaking checks failed.");
  } else {
    console.log("Tree shaking checks passed!");
  }
}

function processOptions(): {
  shouldCreateEntrypoints: boolean;
  shouldCheckTreeShaking: boolean;
  shouldGenMaps: boolean;
  pre: boolean;
  migrateBuild: boolean;
} {
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
    .option("--gen-maps")
    .option("--pre")
    .option(
      "--migrate-build",
      "Migrate the current package to the updated build process with tsup"
    );

  program.parse();

  const options = program.opts();

  const shouldCreateEntrypoints = options.createEntrypoints;
  const shouldCheckTreeShaking = options.treeShaking;
  const shouldGenMaps = options.genMaps;
  const { pre } = options;
  const { migrateBuild } = options;

  return {
    shouldCreateEntrypoints,
    shouldCheckTreeShaking,
    shouldGenMaps,
    pre,
    migrateBuild,
  };
}

async function cleanGeneratedFiles(config: LangChainConfig) {
  const allFileNames = Object.keys(config.entrypoints)
    .map((key) => [`${key}.cjs`, `${key}.js`, `${key}.d.ts`])
    .flat();
  return Promise.all(
    allFileNames.map(async (fileName) => {
      await fsUnlinkSafe(fileName);
    })
  );
}

export async function moveAndRename({
  source,
  dest,
  abs,
}: {
  source: string;
  dest: string;
  abs: (p: string) => string;
}) {
  if (!fs.existsSync(abs(source))) {
    return;
  }

  let renamedDestination = "";
  try {
    for await (const file of await fs.promises.readdir(abs(source), {
      withFileTypes: true,
    })) {
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
        const content = await fs.promises.readFile(
          abs(`${source}/${file.name}`),
          "utf8"
        );
        const rewritten = content.replace(
          /require\("(\..+?).js"\)/g,
          (_, p1) => `require("${p1}.cjs")`
        );

        // Rename the file to .cjs
        const renamed = path.format({ name: parsed.name, ext: ".cjs" });
        renamedDestination = abs(`${dest}/${renamed}`);
        await fs.promises.writeFile(renamedDestination, rewritten, "utf8");
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error during moveAndRename");
    if (error.code === "ENOENT") {
      // Check if file already exists in destination
      if (fs.existsSync(renamedDestination)) {
        console.error(
          `File already exists in destination: ${renamedDestination}`
        );
      } else {
        console.error(`File not found: ${error.path}`);
      }
    }
  }
}

/**
 * Performs all necessary steps to migrate a package to the updated build process
 */
async function migrateBuildSystem() {
  console.log("🔄 Starting build system migration...");

  try {
    // Step 1: Initialize tsup configuration
    await initializeTsupConfig();

    // Step 2: Update TypeScript in package.json to latest version
    await updateTypeScriptVersion();

    // Step 3: Add build script hints to package.json if necessary
    await migratePackageJson();

    // Step 4: Handle tsconfig.cjs.json (no longer needed with tsup)
    await handleTsConfigCjs();

    // Step 5: Update tsconfig.json
    await updateTsConfig();

    console.log("✅ Build system migration completed successfully");
    console.log(`
🚀 Next steps:
1. Review the generated tsup.config.ts file and adjust it as needed
2. Run your build to test the new configuration
3. Update your CI/CD processes if necessary
`);
  } catch (error) {
    console.error("❌ Failed to migrate build system:", error);
  }
}

/**
 * Handle the tsconfig.cjs.json file which is no longer needed with tsup
 */
async function handleTsConfigCjs() {
  const tsConfigCjsPath = path.resolve(process.cwd(), "tsconfig.cjs.json");

  if (fs.existsSync(tsConfigCjsPath)) {
    console.log(
      "🗑️ Handling tsconfig.cjs.json file (no longer needed with tsup)..."
    );

    // Option 1: Rename it with a .bak extension for backup instead of deleting
    const backupPath = `${tsConfigCjsPath}.bak`;
    try {
      await fs.promises.rename(tsConfigCjsPath, backupPath);
      console.log(
        `✅ Renamed tsconfig.cjs.json to tsconfig.cjs.json.bak (backup)`
      );
      console.log(
        `   You can delete this file once you've verified the build works correctly.`
      );
    } catch (error) {
      console.error("❌ Failed to handle tsconfig.cjs.json:", error);
      throw error;
    }

    // Note: We're not deleting the file to be cautious. Users can delete it
    // themselves once they've verified the new build process works correctly.
  } else {
    console.log("ℹ️ No tsconfig.cjs.json file found to backup");
  }
}

/**
 * Update the tsconfig.json file to be compatible with tsup build process
 */
async function updateTsConfig() {
  const tsConfigPath = path.resolve(process.cwd(), "tsconfig.json");

  if (!fs.existsSync(tsConfigPath)) {
    console.log("ℹ️ No tsconfig.json file found to update.");
    return;
  }

  console.log("📄 Updating tsconfig.json file...");

  try {
    const tsconfigContent = await fs.promises.readFile(tsConfigPath, "utf8");
    const tsconfig = JSON.parse(tsconfigContent);

    // Update the extends property
    if (tsconfig.extends === "@tsconfig/recommended") {
      tsconfig.extends = "@tsconfig/recommended/tsconfig.json";
    }

    if (tsconfig.compilerOptions.module === "ES2020") {
      tsconfig.compilerOptions.module = "NodeNext";
    }

    // Write the updated tsconfig.json
    await fs.promises.writeFile(
      tsConfigPath,
      JSON.stringify(tsconfig, null, 2)
    );
    console.log(`✅ Updated tsconfig.json file`);
  } catch (error) {
    console.error("❌ Failed to update tsconfig.json:", error);
    throw error;
  }
}

/**
 * Initialize a tsup configuration file in the current directory
 */
async function initializeTsupConfig() {
  console.log("📄 Creating tsup configuration file...");
  const targetPath = path.resolve(process.cwd(), "tsup.config.ts");

  // Check if file already exists
  if (fs.existsSync(targetPath)) {
    console.log("⚠️ tsup.config.ts already exists, skipping creation");
    return;
  }

  try {
    // Read the template file
    const templatePath = path.resolve(__dirname, "tsup.config.template.ts");
    const templateContent = await fs.promises.readFile(templatePath, "utf8");

    // Write the template to the target path
    await fs.promises.writeFile(targetPath, templateContent);

    console.log("✅ Successfully created tsup.config.ts");
  } catch (error) {
    console.error("❌ Failed to create tsup.config.ts:", error);
    throw error;
  }
}

/**
 * Update TypeScript version in package.json to the latest
 */
async function updateTypeScriptVersion() {
  console.log("📦 Updating TypeScript to the latest version...");
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  try {
    // Read the package.json file
    const packageJsonContent = await fs.promises.readFile(
      packageJsonPath,
      "utf8"
    );
    const packageJson = JSON.parse(packageJsonContent);

    // Set the latest TypeScript version
    const latestTsVersion = "5.4.5"; // Current latest as of March 2025

    let updated = false;

    // Update in dependencies
    if (packageJson.dependencies && packageJson.dependencies.typescript) {
      packageJson.dependencies.typescript = `^${latestTsVersion}`;
      updated = true;
    }

    // Update in devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies.typescript) {
      packageJson.devDependencies.typescript = `^${latestTsVersion}`;
      updated = true;
    }

    if (!updated) {
      console.log("⚠️ TypeScript dependency not found in package.json");
    } else {
      // Write the updated package.json
      await fs.promises.writeFile(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`
      );
      console.log(`✅ Updated TypeScript to version ^${latestTsVersion}`);
    }
  } catch (error) {
    console.error("❌ Failed to update TypeScript version:", error);
    throw error;
  }
}

/**
 * Migrate the package.json build scripts to the new build system
 */
async function migratePackageJson() {
  console.log("🛠️ Updating build scripts in package.json...");
  const packageJsonPath = path.resolve(process.cwd(), "package.json");

  try {
    // Read the package.json file
    const packageJsonContent = await fs.promises.readFile(
      packageJsonPath,
      "utf8"
    );
    const scriptsPackageJsonContent = await fs.promises.readFile(
      path.resolve(__dirname, "..", "..", "package.json"),
      "utf8"
    );
    const scriptsPackageJson = JSON.parse(scriptsPackageJsonContent);
    const tsupVersionRange = scriptsPackageJson.dependencies.tsup;
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.devDependencies.tsup = tsupVersionRange;

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    // Update or add the type-check script
    if (!packageJson.scripts["type-check"]) {
      packageJson.scripts["type-check"] = "tsc --noEmit";
      console.log("✅ Added type-check script");
    }

    // Check if the build script is using the langchain-scripts build
    const buildScript = packageJson.scripts.build || "";
    if (
      buildScript.includes("@langchain/scripts build") ||
      buildScript.includes("lc_build")
    ) {
      console.log("✅ Build script is already using @langchain/scripts");
    } else {
      console.log(
        "⚠️ You may need to update your build script to use @langchain/scripts"
      );
      console.log(
        '   Suggestion: "yarn clean && yarn type-check && yarn @langchain/scripts build"'
      );
    }

    // Write the updated package.json
    await fs.promises.writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
  } catch (error) {
    console.error("❌ Failed to update package.json build scripts:", error);
    throw error;
  }
}

export async function buildWithTSup() {
  const {
    shouldCreateEntrypoints,
    shouldCheckTreeShaking,
    shouldGenMaps,
    pre,
    migrateBuild,
  } = processOptions();

  // Handle the migrate-build option
  if (migrateBuild) {
    await migrateBuildSystem();
    return;
  }

  let langchainConfigPath = path.resolve("langchain.config.js");
  if (process.platform === "win32") {
    // windows, must resolve path with file://
    langchainConfigPath = `file:///${langchainConfigPath}`;
  }

  const { config }: { config: LangChainConfig } = await import(
    langchainConfigPath
  );

  // Check if we should use tsup for building
  const useTsup = hasTsupConfig();

  if (useTsup) {
    console.log("📦 tsup configuration detected. Using tsup build process...");
  } else {
    console.log(
      "📦 No tsup configuration detected. Using traditional build process..."
    );
  }

  // Clean & generate build files
  if (pre && shouldGenMaps) {
    await Promise.all([
      fsRmRfSafe("dist").catch((e) => {
        console.error("Error removing dist (pre && shouldGenMaps)");
        throw e;
      }),
      cleanGeneratedFiles(config),
      createImportMapFile(config),
      generateImportConstants(config),
      generateImportTypes(config),
    ]);
  } else if (pre && !shouldGenMaps) {
    await Promise.all([
      fsRmRfSafe("dist").catch((e) => {
        console.error("Error removing dist (pre && !shouldGenMaps)");
        throw e;
      }),
      cleanGeneratedFiles(config),
    ]);
  }

  if (shouldCreateEntrypoints) {
    if (useTsup) {
      await updateTsupConfig(config);
      // Use tsup for building
      await runTsupBuild();

      // Update package.json and other files after tsup build
      await updatePackageJson(config);
    } else {
      // Traditional build process with tsc
      await Promise.all([
        asyncSpawn("tsc", ["--outDir", "dist/"]),
        asyncSpawn("tsc", ["--outDir", "dist-cjs/", "-p", "tsconfig.cjs.json"]),
      ]);
      await moveAndRename({
        source: config.cjsSource,
        dest: config.cjsDestination,
        abs: config.abs,
      });
      // move CJS to dist
      await Promise.all([
        updatePackageJson(config),
        fsRmRfSafe("dist-cjs").catch((e) => {
          console.error("Error removing dist-cjs");
          throw e;
        }),
        fsRmRfSafe("dist/tests").catch((e) => {
          console.error("Error removing dist/tests");
          throw e;
        }),
        (async () => {
          // Required for cross-platform compatibility.
          // Windows does not manage globs the same as Max/Linux when deleting directories.
          const testFolders = await glob("dist/**/tests");
          await Promise.all(testFolders.map((folder) => fsRmRfSafe(folder)));
        })().catch((e) => {
          console.error("Error removing dist/**/tests");
          throw e;
        }),
      ]);
    }
  }

  if (shouldCheckTreeShaking) {
    // Checks tree shaking via rollup
    await checkTreeShaking(config);
  }
}

buildWithTSup().catch((e) => {
  console.error(e);
  process.exit(1);
});
