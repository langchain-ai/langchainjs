import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Shell Tool Tests", () => {
  it("shell creates valid tool definitions", () => {
    const shellTool = tools.shell({
      execute: async () => ({
        output: [
          {
            stdout: "output",
            stderr: "",
            outcome: { type: "exit" as const, exit_code: 0 },
          },
        ],
      }),
    });

    expect(shellTool.name).toBe("shell");
    expect(shellTool.extras?.providerToolDefinition).toMatchObject({
      type: "shell",
    });
  });

  it("shell execute callback receives action correctly", async () => {
    const actions: Array<{
      commands: string[];
      timeout_ms?: number | null;
      max_output_length?: number | null;
    }> = [];

    const shellTool = tools.shell({
      execute: async (action) => {
        actions.push(action);
        return {
          output: action.commands.map((cmd) => ({
            stdout: `executed: ${cmd}`,
            stderr: "",
            outcome: { type: "exit" as const, exit_code: 0 },
          })),
          maxOutputLength: action.max_output_length,
        };
      },
    });

    const testAction = {
      commands: ["ls -la", "pwd"],
      timeout_ms: 5000,
      max_output_length: 4096,
    };

    const executeFunc = shellTool.func;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeFunc(testAction as any);

    expect(actions).toHaveLength(1);
    expect(actions[0].commands).toEqual(["ls -la", "pwd"]);
    expect(actions[0].timeout_ms).toBe(5000);
    expect(actions[0].max_output_length).toBe(4096);

    const parsed = JSON.parse(result);
    expect(parsed.output).toHaveLength(2);
    expect(parsed.output[0].stdout).toBe("executed: ls -la");
    expect(parsed.output[1].stdout).toBe("executed: pwd");
    expect(parsed.max_output_length).toBe(4096);
  });

  it("shell handles timeout outcome", async () => {
    const shellTool = tools.shell({
      execute: async () => ({
        output: [
          {
            stdout: "",
            stderr: "Command timed out",
            outcome: { type: "timeout" as const },
          },
        ],
      }),
    });

    const testAction = {
      commands: ["sleep 1000"],
      timeout_ms: 100,
      max_output_length: null,
    };

    const executeFunc = shellTool.func;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeFunc(testAction as any);

    const parsed = JSON.parse(result);
    expect(parsed.output).toHaveLength(1);
    expect(parsed.output[0].outcome.type).toBe("timeout");
  });

  it("shell handles exit outcome with non-zero exit code", async () => {
    const shellTool = tools.shell({
      execute: async () => ({
        output: [
          {
            stdout: "",
            stderr: "command not found",
            outcome: { type: "exit" as const, exit_code: 127 },
          },
        ],
      }),
    });

    const testAction = {
      commands: ["nonexistent-command"],
      timeout_ms: null,
      max_output_length: null,
    };

    const executeFunc = shellTool.func;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeFunc(testAction as any);

    const parsed = JSON.parse(result);
    expect(parsed.output).toHaveLength(1);
    expect(parsed.output[0].outcome.type).toBe("exit");
    expect(parsed.output[0].outcome.exit_code).toBe(127);
    expect(parsed.output[0].stderr).toBe("command not found");
  });

  it("shell handles multiple commands", async () => {
    const shellTool = tools.shell({
      execute: async (action) => ({
        output: action.commands.map((_cmd, idx) => ({
          stdout: `output ${idx}`,
          stderr: "",
          outcome: { type: "exit" as const, exit_code: 0 },
        })),
      }),
    });

    const testAction = {
      commands: ["echo hello", "echo world", "ls"],
      timeout_ms: null,
      max_output_length: null,
    };

    const executeFunc = shellTool.func;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await executeFunc(testAction as any);

    const parsed = JSON.parse(result);
    expect(parsed.output).toHaveLength(3);
    expect(parsed.output[0].stdout).toBe("output 0");
    expect(parsed.output[1].stdout).toBe("output 1");
    expect(parsed.output[2].stdout).toBe("output 2");
  });
});
