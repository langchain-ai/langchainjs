/**
 * Options for compiling packages
 */
export interface CompilePackageOptions {
    /**
     * The package query to use for compiling packages
     */
    packageQuery?: string
    /**
     * Whether to watch for changes and automatically recompile
     * @default false
     */
    watch?: boolean
    /**
     * The packages to exclude from the build
     * @default []
     */
    exclude?: string[]
    /**
     * Whether to emit declarations
     * @default true
     */
    noEmit?: boolean
}