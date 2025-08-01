/**
 * Options for compiling packages
 */
export interface CompilePackageOptions {
  /**
   * The package query to use for compiling packages
   */
  packageQuery?: string[];
  /**
   * Whether to watch for changes and automatically recompile
   * @default false
   */
  watch?: boolean;
  /**
   * The packages to exclude from the build
   * @default []
   */
  exclude?: string[];
  /**
   * Whether to skip emitting type declarations
   * @default false
   */
  noEmit?: boolean;
  /**
   * Whether to skip unused dependency check on packages
   * @default false
   */
  skipUnused?: boolean;
  /**
   * Whether to skip cleaning the build directory
   * @default false
   */
  skipClean?: boolean;
  /**
   * Whether to skip generating sourcemaps
   * @default false
   */
  skipSourcemap?: boolean;
}
