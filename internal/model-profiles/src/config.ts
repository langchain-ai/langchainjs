import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "@iarna/toml";
import type { ModelProfile } from "@langchain/core/language_models/profile";

/**
 * Configuration for model profile overrides.
 * All fields are optional and match the ModelProfile interface.
 */
export interface ModelProfileOverride extends Partial<ModelProfile> {}

/**
 * Valid ModelProfile field names for separating provider-level from model-specific overrides.
 */
const MODEL_PROFILE_FIELDS = new Set([
  "maxInputTokens",
  "imageInputs",
  "imageUrlInputs",
  "pdfInputs",
  "audioInputs",
  "videoInputs",
  "imageToolMessage",
  "pdfToolMessage",
  "maxOutputTokens",
  "reasoningOutput",
  "imageOutputs",
  "audioOutputs",
  "videoOutputs",
  "toolCalling",
  "toolChoice",
  "structuredOutput",
]);

/**
 * Overrides structure that can contain both provider-level and model-specific overrides.
 * Provider-level overrides are ModelProfile fields at the top level.
 * Model-specific overrides are nested objects keyed by model name.
 */
export type OverridesConfig = ModelProfileOverride &
  Record<
    string,
    ModelProfileOverride | ModelProfileOverride[keyof ModelProfileOverride]
  >;

/**
 * TOML configuration file structure.
 */
export interface ConfigFile {
  /**
   * Provider name.
   */
  provider?: string;

  /**
   * Output path for the generated TypeScript file.
   */
  output: string;

  /**
   * Overrides that can contain both provider-level and model-specific overrides.
   * Provider-level: ModelProfile fields at the top level (e.g., `maxInputTokens`, `toolCalling`)
   * Model-specific: Nested objects keyed by model name (e.g., `overrides."gpt-4"`)
   */
  overrides?: OverridesConfig;
}

/**
 * Parses a TOML configuration file and returns the configuration object.
 *
 * @param configPath - Path to the TOML configuration file
 * @returns Parsed configuration object with resolved paths
 * @throws Error if the file cannot be read or parsed
 */
export function parseConfig(configPath: string): ConfigFile & {
  configDir: string;
} {
  // When running via pnpm --filter, pnpm sets INIT_CWD to the original working directory
  // where the command was invoked. Use that if available, otherwise use process.cwd().
  const baseDir = process.env.INIT_CWD || process.cwd();

  // Validate that the config path is within the monorepo
  const resolvedPath = validatePathInMonorepo(configPath, baseDir);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Config file not found: ${configPath}\n` +
        `Resolved to: ${resolvedPath}\n` +
        `Base directory: ${baseDir}`
    );
  }

  const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  const configDir = path.dirname(resolvedPath);

  try {
    const parsed = parse(fileContent) as unknown as ConfigFile;

    // Resolve output path relative to the config file's directory
    // and validate it's within the monorepo
    const resolvedOutput = validatePathInMonorepo(parsed.output, configDir);

    return {
      ...parsed,
      output: resolvedOutput,
      configDir,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse TOML config file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Separates provider-level overrides from model-specific overrides.
 *
 * @param overrides - The overrides object from the config
 * @returns Object with providerOverrides and modelOverrides separated
 */
export function separateOverrides(overrides?: OverridesConfig): {
  providerOverrides: ModelProfileOverride;
  modelOverrides: Record<string, ModelProfileOverride>;
} {
  const providerOverrides: ModelProfileOverride = {};
  const modelOverrides: Record<string, ModelProfileOverride> = {};

  if (!overrides) {
    return { providerOverrides, modelOverrides };
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (MODEL_PROFILE_FIELDS.has(key)) {
      // This is a provider-level override
      (providerOverrides as Record<string, unknown>)[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // This is a model-specific override (nested object)
      modelOverrides[key] = value as ModelProfileOverride;
    }
  }

  return { providerOverrides, modelOverrides };
}

/**
 * Applies overrides to a model profile.
 * Provider overrides are applied first, then model-specific overrides.
 *
 * @param baseProfile - The base model profile
 * @param providerOverrides - Provider-level overrides (optional)
 * @param modelOverrides - Model-specific overrides (optional)
 * @returns The merged model profile
 */
export function applyOverrides(
  baseProfile: ModelProfile,
  providerOverrides?: ModelProfileOverride,
  modelOverrides?: ModelProfileOverride
): ModelProfile {
  let result = { ...baseProfile };

  // Apply provider-level overrides first
  if (providerOverrides) {
    result = { ...result, ...providerOverrides };
  }

  // Apply model-specific overrides (these take precedence)
  if (modelOverrides) {
    result = { ...result, ...modelOverrides };
  }

  return result;
}

/**
 * Finds the monorepo root directory by looking for pnpm-workspace.yaml or
 * a package.json file with "private": true at the root.
 *
 * @param startDir - Directory to start searching from (defaults to current working directory)
 * @returns The absolute path to the monorepo root
 * @throws Error if the monorepo root cannot be found
 */
export function findMonorepoRoot(startDir?: string): string {
  const start = startDir ? path.resolve(startDir) : process.cwd();
  let current = start;

  while (true) {
    // Check for pnpm-workspace.yaml (most reliable indicator)
    const pnpmWorkspacePath = path.join(current, "pnpm-workspace.yaml");
    if (fs.existsSync(pnpmWorkspacePath)) {
      return current;
    }

    // Check for package.json with "private": true (alternative indicator)
    const packageJsonPath = path.join(current, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageJsonContent);
        if (packageJson.private === true) {
          // Verify this is likely the root by checking for turbo.json or other monorepo indicators
          const turboJsonPath = path.join(current, "turbo.json");
          if (fs.existsSync(turboJsonPath)) {
            return current;
          }
        }
      } catch {
        // If we can't parse package.json, continue searching
      }
    }

    // Move up one directory
    const parent = path.dirname(current);
    if (parent === current) {
      // We've reached the filesystem root
      throw new Error(
        `Could not find monorepo root. Started searching from: ${start}`
      );
    }
    current = parent;
  }
}

/**
 * Validates that a given path is within the monorepo root.
 * Resolves the path to an absolute path and checks that it's contained
 * within the monorepo boundaries.
 *
 * @param filePath - The path to validate (can be absolute or relative)
 * @param baseDir - Base directory for resolving relative paths (defaults to current working directory)
 * @returns The resolved absolute path if valid
 * @throws Error if the path is outside the monorepo
 */
export function validatePathInMonorepo(
  filePath: string,
  baseDir?: string
): string {
  const base = baseDir ? path.resolve(baseDir) : process.cwd();
  const monorepoRoot = findMonorepoRoot(base);

  // Resolve the path to absolute
  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(base, filePath);

  // Normalize paths to handle symlinks and relative segments
  const normalizedPath = path.normalize(resolvedPath);
  const normalizedRoot = path.normalize(monorepoRoot);

  // Check if the resolved path is within the monorepo root
  // Use path.relative to check if the path is contained
  const relativePath = path.relative(normalizedRoot, normalizedPath);

  // If relativePath starts with ".." or is absolute, it's outside the monorepo
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Path "${filePath}" resolves to "${normalizedPath}" which is outside the monorepo root "${normalizedRoot}". ` +
        `All paths must be within the monorepo for security reasons.`
    );
  }

  return normalizedPath;
}
