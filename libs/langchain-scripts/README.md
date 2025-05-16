# @langchain/scripts

This package contains the LangChain.js shared scripts for our packages.

## Installation

```bash npm2yarn
npm install @langchain/scripts
```

## Usage

### Build Script

The build script supports both traditional TypeScript compilation and modern tsup-based builds.

```bash
npx lc_build
```

#### Traditional TypeScript Build

By default, the build script uses TypeScript's compiler (tsc) to build both ESM and CJS versions of your package.

#### tsup-based Build

The build script can also use [tsup](https://github.com/egoist/tsup) (a zero-config TypeScript bundler powered by esbuild) which offers significant performance improvements (10-100x faster builds).

To migrate your package to use tsup:

```bash
npx lc_build --migrate-build
```

This command performs several migration steps:
1. Creates a `tsup.config.ts` file with sensible defaults for LangChain packages
2. Updates TypeScript to the latest version in your package.json
3. Ensures your package.json has a `type-check` script
4. Backs up the tsconfig.cjs.json file (which is no longer needed with tsup)
5. Provides guidance on updating build scripts if needed

After migration, simply run the build script normally:

```bash
npx lc_build
```

The script will automatically detect the presence of a tsup configuration file and use it for building.

### Notebooks Type-Checking

```bash
npx notebook_validate
```

### Serialized Field Extraction 

```bash
npx extract_serializable_fields
```
