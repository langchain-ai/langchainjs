import { expect, it, describe } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { tools } from "../index.js";
import type { ShellAction } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

describe("OpenAI Shell Tool Integration Tests", () => {
  it("shell tool can be bound and invoked with gpt-5.1", async () => {
    const executedCommands: string[][] = [];
    const shellTool = tools.shell({
      execute: async (action) => {
        executedCommands.push(action.commands);
        // Simulate command execution
        return {
          output: action.commands.map((cmd) => ({
            /**
             * let's not actually execute the command, just return a mock output
             * (who knows what the command does)
             */
            stdout: cmd === "echo hello" ? "hello\n" : `executed: ${cmd}`,
            stderr: "",
            outcome: { type: "exit" as const, exit_code: 0 },
          })),
          maxOutputLength: action.max_output_length,
        };
      },
    });

    const llm = new ChatOpenAI({ model: "gpt-5.1" });
    const llmWithShell = llm.bindTools([shellTool]);

    const response = await llmWithShell.invoke([
      new HumanMessage(
        'Use the shell tool to run "echo hello" and tell me what it outputs.'
      ),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect((response as AIMessage).tool_calls).toHaveLength(1);
    const result = await shellTool.func(
      (response as AIMessage).tool_calls?.[0].args as unknown as ShellAction &
        string
    );
    expect(result).toMatchInlineSnapshot(
      `"{"output":[{"stdout":"hello\\n","stderr":"","outcome":{"type":"exit","exit_code":0}}],"max_output_length":2000}"`
    );
    expect(executedCommands).toEqual([["echo hello"]]);
  });
});
