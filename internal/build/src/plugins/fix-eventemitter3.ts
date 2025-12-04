import type { Plugin } from "rolldown";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * `eventemitter3` is bundled with `p-queue`, which is bundled into `@langchain/core`.
 * Unfortunately, rolldown doesn't  bundle `eventemitter3` correctly, so we need to fix it manually.
 */
export function fixEventEmitter3Plugin(): Plugin {
  return {
    name: "fix-eventemitter3",
    buildEnd: {
      async handler() {
        console.log("HAH!H");
        const distPath = path.resolve(process.env.INIT_CWD ?? "", "dist");
        const eventemitter3Path = path.join(
          distPath,
          "node_modules",
          ".pnpm",
          "eventemitter3@5.0.1",
          "node_modules",
          "eventemitter3",
          "index2.cjs"
        );

        try {
          const content = await fs.readFile(eventemitter3Path, "utf-8");

          // Fix the broken require call - index.cjs exports 'default', not 'require_eventemitter3'
          const fixed = content.replace(
            /require_index\.require_eventemitter3\(\)/g,
            "require_index.default"
          );

          if (fixed !== content) {
            await fs.writeFile(eventemitter3Path, fixed, "utf-8");
          }
        } catch (error) {
          // File might not exist if eventemitter3 wasn't bundled
          // This is fine, we'll just skip the fix
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      },
    },
  };
}
