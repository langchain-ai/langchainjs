import { expectTypeOf, it, describe } from "vitest";
import {
  tools,
  ShellAction,
  ShellResult,
  ShellCommandOutput,
} from "../index.js";

describe("OpenAI Shell Tool Type Tests", () => {
  it("shell execute callback receives correct action types", () => {
    tools.shell({
      execute: async (action) => {
        expectTypeOf(action.commands).toEqualTypeOf<string[]>();
        expectTypeOf(action.timeout_ms).toEqualTypeOf<number | null>();
        expectTypeOf(action.max_output_length).toEqualTypeOf<number | null>();

        return {
          output: [
            {
              stdout: "test",
              stderr: "",
              outcome: { type: "exit" as const, exit_code: 0 },
            },
          ],
        };
      },
    });
  });

  it("ShellAction type matches expected structure", () => {
    const action: ShellAction = {
      commands: ["ls -la"],
      timeout_ms: 5000,
      max_output_length: 4096,
    };

    expectTypeOf(action.commands).toEqualTypeOf<string[]>();
    expectTypeOf(action.timeout_ms).toEqualTypeOf<number | null>();
    expectTypeOf(action.max_output_length).toEqualTypeOf<number | null>();
  });

  it("ShellResult type matches expected structure", () => {
    const result: ShellResult = {
      output: [
        {
          stdout: "hello",
          stderr: "",
          outcome: { type: "exit", exit_code: 0 },
        },
      ],
      maxOutputLength: 4096,
    };

    expectTypeOf(result.output).toEqualTypeOf<ShellCommandOutput[]>();
    expectTypeOf(result.maxOutputLength).toEqualTypeOf<
      number | null | undefined
    >();
  });

  it("ShellCommandOutput supports exit outcome", () => {
    const output: ShellCommandOutput = {
      stdout: "success",
      stderr: "",
      outcome: { type: "exit", exit_code: 0 },
    };

    expectTypeOf(output.stdout).toEqualTypeOf<string>();
    expectTypeOf(output.stderr).toEqualTypeOf<string>();
  });

  it("ShellCommandOutput supports timeout outcome", () => {
    const output: ShellCommandOutput = {
      stdout: "",
      stderr: "timed out",
      outcome: { type: "timeout" },
    };

    expectTypeOf(output.stdout).toEqualTypeOf<string>();
    expectTypeOf(output.stderr).toEqualTypeOf<string>();
  });
});
