import { expect, it, describe } from "vitest";
import { bash_20250124 } from "../bash.js";

describe("Anthropic Bash Tool Unit Tests", () => {
  describe("bash_20250124", () => {
    it("creates a valid bash tool with no options", () => {
      const bash = bash_20250124();

      expect(bash.name).toBe("bash");
      expect(bash.extras?.providerToolDefinition).toMatchInlineSnapshot(`
        {
          "name": "bash",
          "type": "bash_20250124",
        }
      `);
    });

    it("creates a valid bash tool with execute function", async () => {
      const mockExecute = async (args: {
        command?: string;
        restart?: boolean;
      }) => {
        if (args.restart) {
          return "Session restarted";
        }
        return `Executed: ${args.command}`;
      };

      const bash = bash_20250124({
        execute: mockExecute,
      });

      expect(bash.name).toBe("bash");
      expect(bash.func).toBeDefined();
    });

    it("can execute a command", async () => {
      let executedCommand: string | undefined;

      const bash = bash_20250124({
        execute: async (args) => {
          if ("command" in args) {
            executedCommand = args.command;
            return "command output";
          }
          return "no command";
        },
      });

      const result = await bash.invoke({ command: "ls -la" });

      expect(result).toBe("command output");
      expect(executedCommand).toBe("ls -la");
    });

    it("can restart the session", async () => {
      let wasRestarted = false;

      const bash = bash_20250124({
        execute: async (args) => {
          if ("restart" in args) {
            wasRestarted = true;
            return "Bash session restarted";
          }
          return "command executed";
        },
      });

      const result = await bash.invoke({ restart: true });

      expect(result).toBe("Bash session restarted");
      expect(wasRestarted).toBe(true);
    });
  });
});
