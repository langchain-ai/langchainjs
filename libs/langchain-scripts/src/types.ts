/** @ignore We don't need API refs for these */
export declare type PackageJSONDependencyTypes =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

/** @ignore We don't need API refs for these */
export interface PackageJSONAddress {
  email?: string;
  url?: string;
}

/** @ignore We don't need API refs for these */
export interface PackageJSONPerson extends PackageJSONAddress {
  name: string;
}

export interface ExportsMapValue {
  types: {
    import: string;
    require: string;
    default: string;
  };
  import: string;
  require: string;
}

/** @ignore We don't need API refs for these */
export interface PackageJSON {
  name: string;
  version: string;
  description?: string;
  keywords?: string;
  homepage?: string;
  bugs?: PackageJSONAddress;
  license?: string;
  author?: string | PackageJSONPerson;
  contributors?: string[] | PackageJSONPerson[];
  files?: string[];
  main?: string;
  browser?: string;
  bin?: Record<string, string>;
  man?: string;
  directories?: {
    lib?: string;
    bin?: string;
    man?: string;
    doc?: string;
    example?: string;
    test?: string;
  };
  repository?: {
    type?: "git";
    url?: string;
    directory?: string;
  };
  scripts?: Record<string, string>;
  config?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, Record<string, boolean>>;
  optionalDependencies?: Record<string, string>;
  bundledDependencies?: string[];
  engines?: Record<string, string>;
  os?: string[];
  cpu?: string[];
  exports?:
    | Record<string, ExportsMapValue | string>
    | Record<"./package.json", "./package.json">;
}

export type TreeShakingArgs = {
  /**
   * @default [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.peerDependencies), /node:/, /@langchain\/core\//]
   */
  extraInternals?: Array<string | RegExp>;
};

export interface ImportData {
  imports: Record<string, string[]>;
  exportedAliases: Record<string, string[]>;
}

export interface ExtraImportMapEntry {
  modules: Array<string>;
  alias: Array<string>;
  path: string;
}

export interface LangChainConfig {
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
  /**
   * Extra entries to add to the import map.
   */
  extraImportMapEntries?: Array<ExtraImportMapEntry>;
  /**
   * The absolute path to the tsconfig.json file.
   */
  tsConfigPath: string;
  /**
   * Paths to add to .gitignore
   * @default ["node_modules", "dist", ".yarn"]
   * @type {string[]}
   */
  gitignorePaths?: string[];
  internals?: Array<string | RegExp>;
  /**
   * The source of the `.cjs` files to move.
   */
  cjsSource: string;
  /**
   * The destination to move the `.cjs` files to.
   */
  cjsDestination: string;
  /**
   * @param {string} relativePath
   * @returns {string}
   */
  abs: (relativePath: string) => string;
  /**
   * Additional paths to add to the gitignore file.
   * @default undefined
   * @type {string[]}
   */
  additionalGitignorePaths?: string[];
}
