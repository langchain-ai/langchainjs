import * as fs from "fs";
import * as path from "path";
import { identifySecrets } from "./identify-secrets.js";

// .gitignore
const DEFAULT_GITIGNORE_PATHS = ["node_modules", "dist", ".yarn"];

// List of test-exports-* packages which we use to test that the exports field
// works correctly across different JS environments.
// Each entry is a tuple of [package name, import statement].
const testExports: Array<[string, (p: string) => string]> = [
  [
    "test-exports-esm",
    (p: string) => `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`
  ],
  [
    "test-exports-esbuild",
    (p: string) => `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`
  ],
  [
    "test-exports-cjs",
    (p: string) => `const ${p.replace(/\//g, "_")} = require("langchain/${p}");`
  ],
  ["test-exports-cf", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-vercel", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-vite", (p: string) => `export * from "langchain/${p}";`],
  ["test-exports-bun", (p: string) => `export * from "langchain/${p}";`]
];

const updateJsonFile = (
  relativePath: string,
  updateFunction: (json: Record<string, unknown>) => Record<string, unknown>
) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, `${JSON.stringify(res, null, 2)}\n`);
};

const generateFiles = (
  entrypoints: Record<string, string>
): Record<string, string> => {
  const files = [...Object.entries(entrypoints), ["index", "index"]].flatMap(
    ([key, value]) => {
      const nrOfDots = key.split("/").length - 1;
      const relativePath = "../".repeat(nrOfDots) || "./";
      const compiledPath = `${relativePath}dist/${value}.js`;
      return [
        [
          `${key}.cjs`,
          `module.exports = require('${relativePath}dist/${value}.cjs');`
        ],
        [`${key}.js`, `export * from '${compiledPath}'`],
        [`${key}.d.ts`, `export * from '${compiledPath}'`]
      ];
    }
  );

  return Object.fromEntries(files);
};

const updateConfig = ({
  entrypoints,
  deprecatedNodeOnly,
  requiresOptionalDependency,
  shouldTestExports
}: {
  entrypoints: Record<string, string>;
  deprecatedNodeOnly: Array<string>;
  requiresOptionalDependency: Array<string>;
  shouldTestExports: boolean;
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
            types: `./${key}.d.ts`,
            import: `./${key}.js`,
            require: `./${key}.cjs`
          };

          return [key === "index" ? "." : `./${key}`, entryPoint];
        })
      ),
      { "./package.json": "./package.json" }
    ),
    files: ["dist/", ...filenames]
  }));

  // Write generated files
  Object.entries(generatedFiles).forEach(([filename, content]) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  });

  // Update .gitignore
  fs.writeFileSync(
    "./.gitignore",
    `${filenames.join("\n")}\n${DEFAULT_GITIGNORE_PATHS.join("\n")}\n`
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
  entrypoints
}: {
  entrypoints: Record<string, string>;
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
const importMap = (
  packageSuffix: string | null
): [string, (k: string, p: string) => string, string] => [
  `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
  (k: string, p: string) =>
    `export * as ${k.replace(/\//g, "__")} from "../${p}.js";`,
  "src/load/import_map.ts"
];

const generateImportMap = ({
  entrypoints,
  requiresOptionalDependency,
  deprecatedNodeOnly,
  deprecatedOmitFromImportMap,
  packageSuffix
}: {
  entrypoints: Record<string, string>;
  requiresOptionalDependency: Array<string>;
  deprecatedNodeOnly: Array<string>;
  deprecatedOmitFromImportMap: Array<string>;
  packageSuffix: string | null;
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
  fs.writeFileSync(
    `../${pkg}/${importMapPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.\n\n${contents}`
  );
};

const importTypes = (
  packageSuffix: string | null
): [string, (k: string, p: string) => string, string] => [
  `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
  (k: string, p: string) =>
    `  "@langchain${packageSuffix ? `/${packageSuffix}` : ""}/${k}"?:
    | typeof import("../${p}.js")
    | Promise<typeof import("../${p}.js")>;`,
  "src/load/import_type.d.ts"
];

const generateImportTypes = ({
  entrypoints,
  requiresOptionalDependency,
  deprecatedNodeOnly,
  packageSuffix
}: {
  entrypoints: Record<string, string>;
  requiresOptionalDependency: Array<string>;
  deprecatedNodeOnly: Array<string>;
  packageSuffix: string | null;
}) => {
  // Generate import types
  const [pkg, importStatement, importTypesPath] = importTypes(packageSuffix);
  fs.writeFileSync(
    `../${pkg}/${importTypesPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.

export interface OptionalImportMap {
${Object.keys(entrypoints)
  .filter((key) => !deprecatedNodeOnly.includes(key))
  .filter((key) => requiresOptionalDependency.includes(key))
  .map((key) => importStatement(key, entrypoints[key]))
  .join("\n")}
}

export interface SecretMap {
${[...identifySecrets()]
  .sort()
  .map((secret) => `  ${secret}?: string;`)
  .join("\n")}
}
`
  );
};

const importConstants = (
  packageSuffix: string | null
): [string, (k: string) => string, string] => [
  `langchain${packageSuffix ? `-${packageSuffix}` : ""}`,
  (k: string) =>
    `  "langchain${packageSuffix ? `_${packageSuffix}` : ""}/${k}"`,
  "src/load/import_constants.ts"
];

const generateImportConstants = ({
  entrypoints,
  requiresOptionalDependency,
  deprecatedNodeOnly,
  packageSuffix
}: {
  entrypoints: Record<string, string>;
  requiresOptionalDependency: Array<string>;
  deprecatedNodeOnly: Array<string>;
  packageSuffix: string | null;
}) => {
  // Generate import constants
  const entrypointsToInclude = Object.keys(entrypoints)
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => requiresOptionalDependency.includes(key));
  const [pkg, importStatement, importConstantsPath] =
    importConstants(packageSuffix);
  const contents = `${entrypointsToInclude
    .map((key) => importStatement(key))
    .join(",\n")},\n];\n`;
  fs.writeFileSync(
    `../${pkg}/${importConstantsPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.\n\nexport const optionalImportEntrypoints = [\n${contents}`
  );
};

export function createEntrypoints({
  entrypoints,
  requiresOptionalDependency = [],
  deprecatedNodeOnly = [],
  deprecatedOmitFromImportMap = [],
  packageSuffix,
  shouldTestExports = false
}: {
  /**
   * This lists all the entrypoints for the library. Each key corresponds to an
   * importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
   * The value is the path to the file in `src/` that exports the entrypoint.
   * This is used to generate the `exports` field in package.json.
   * Order is not important.
   */
  entrypoints: Record<string, string>;
  /**
   * Entrypoints in this list require an optional dependency to be installed.
   * Therefore they are not tested in the generated test-exports-* packages.
   */
  requiresOptionalDependency?: string[];
  /**
   * Entrypoints in this list will
   * 1. Be excluded from the documentation
   * 2. Be only available in Node.js environments (for backwards compatibility)
   */
  deprecatedNodeOnly?: string[];
  /**
   * Endpoints that are deprecated due to redundancy. Will not appear in the import map.
   */
  deprecatedOmitFromImportMap?: string[];
  /**
   * The suffix of the package. Eg. `community` for `@langchain/community`.
   * Used in the generated import map.
   */
  packageSuffix?: string;
  /**
   * Whether or not to write to the test exports files. At the moment this only
   * applies to the `langchain` package.
   */
  shouldTestExports?: boolean;
}) {
  const command = process.argv[2];
  const generateMaps = process.argv[3];

  if (command === "pre") {
    cleanGenerated({ entrypoints });
    if (generateMaps) {
      generateImportMap({
        entrypoints,
        requiresOptionalDependency,
        deprecatedNodeOnly,
        deprecatedOmitFromImportMap,
        packageSuffix: packageSuffix ?? null
      });
      generateImportTypes({
        entrypoints,
        requiresOptionalDependency,
        deprecatedNodeOnly,
        packageSuffix: packageSuffix ?? null
      });
      generateImportConstants({
        entrypoints,
        requiresOptionalDependency,
        deprecatedNodeOnly,
        packageSuffix: packageSuffix ?? null
      });
    }
  } else {
    updateConfig({
      entrypoints,
      deprecatedNodeOnly,
      requiresOptionalDependency,
      shouldTestExports
    });
  }
}
