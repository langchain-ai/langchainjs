import { existsSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { findMonorepoRoot, parseConfig, separateOverrides } from "./config.js";
import { generateModelProfiles } from "./generator.js";

export function resolveProfileConfigs(
  providerFilter = "all"
): ReturnType<typeof parseConfig>[] {
  const requested = providerFilter
    .split(",")
    .map((provider) => provider.trim());
  if (requested.some((provider) => !provider)) {
    throw new Error("Provider filter must not be empty");
  }

  const providersDir = path.join(findMonorepoRoot(), "libs/providers");
  const configs = readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(providersDir, name, "profiles.toml"))
    .filter((configPath) => existsSync(configPath))
    .map((configPath) => {
      const config = parseConfig(configPath);
      if (!config.provider) {
        throw new Error(`Provider name missing in ${configPath}`);
      }
      return config;
    });

  if (!configs.length) {
    throw new Error("No model profile configurations found");
  }
  if (requested.length === 1 && requested[0] === "all") return configs;

  const known = new Set(configs.map((config) => config.provider));
  const unknown = requested.filter((provider) => !known.has(provider));
  if (unknown.length) {
    throw new Error(`Unknown provider ID(s): ${unknown.join(", ")}`);
  }
  return configs.filter((config) => requested.includes(config.provider!));
}

export async function refreshProfiles(providerFilter = "all"): Promise<void> {
  const configs = resolveProfileConfigs(providerFilter);
  const failedProviders = new Set<string>();
  for (const config of configs) {
    try {
      const { providerOverrides, modelOverrides } = separateOverrides(
        config.overrides
      );
      await generateModelProfiles(
        config.provider!,
        providerOverrides,
        modelOverrides,
        config.output
      );
    } catch (error) {
      failedProviders.add(config.provider!);
      console.error(
        `Failed to refresh ${config.provider} (${config.configDir}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  if (failedProviders.size) {
    throw new Error(
      `Failed to refresh model profiles for: ${[...failedProviders].join(", ")}`
    );
  }
}
