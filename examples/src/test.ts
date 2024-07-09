import { tool } from "@langchain/core/tools";
import { spawn } from "node:child_process";
import { z } from "zod";

const terminalToolSchema = z.object({
  command: z.string().describe("The command to execute in the terminal."),
  args: z
    .array(z.string())
    .default([])
    .describe("The arguments to pass to the command."),
});

async function asyncSpawn(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, args, {
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=4096",
      },
    });

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`Command failed: ${command} ${args.join(" ")}\n${output}`)
        );
      } else {
        resolve(output);
      }
    });
  });
}

const terminalTool = tool((input) => asyncSpawn(input.command, input.args), {
  name: "terminal_tool",
  description: "Executes a command in the terminal.",
  schema: terminalToolSchema,
});
