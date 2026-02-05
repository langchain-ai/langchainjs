#!/usr/bin/env node
import { Command } from "commander";
import { parseConfig, separateOverrides } from "./config.js";
import { generateModelProfiles } from "./generator.js";

const program = new Command();

program
  .name("model-profiles")
  .description("Make model profiles for a provider")
  .requiredOption("--config <path>", "Path to the config TOML file")
  .action(async (options: { config: string }) => {
    try {
      const config = parseConfig(options.config);
      if (!config.provider) {
        throw new Error(
          'Provider name must be specified in the config file (provider = "...")'
        );
      }

      const { providerOverrides, modelOverrides } = separateOverrides(
        config.overrides
      );

      await generateModelProfiles(
        config.provider,
        providerOverrides,
        modelOverrides,
        config.output
      );
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

program.parse(process.argv);
