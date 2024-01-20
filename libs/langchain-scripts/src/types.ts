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
  types: string;
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
