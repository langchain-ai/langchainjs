#!/usr/bin/env node
import { Command } from "commander";
import { refreshProfiles } from "./refresh.js";

const program = new Command();

program
  .name("model-profiles refresh")
  .description("Refresh all configured provider model profiles")
  .option("--provider <ids>", "Comma-separated models.dev provider IDs", "all")
  .action(async (options: { provider: string }) => {
    try {
      await refreshProfiles(options.provider);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
