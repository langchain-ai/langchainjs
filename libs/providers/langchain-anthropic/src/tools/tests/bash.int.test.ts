import { expect, it, describe } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { execSync } from "child_process";

import { ChatAnthropic } from "../../chat_models.js";
import { bash_20250124 } from "../bash.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  });

describe("Anthropic Bash Tool Integration Tests", () => {
  it("bash tool can be bound to ChatAnthropic and triggers tool use", async () => {
    const llm = createModel();

    const bash = bash_20250124({
      execute: async (args) => {
        if (args.restart) {
          return "Bash session restarted";
        }
        try {
          const output = execSync(args.command!, {
            encoding: "utf-8",
            timeout: 10000,
          });
          return output;
        } catch (error) {
          return `Error: ${(error as Error).message}`;
        }
      },
    });

    const llmWithBash = llm.bindTools([bash]);

    const response = await llmWithBash.invoke([
      new HumanMessage("What is 2+2? Use bash to calculate it with echo."),
    ]);

    expect(AIMessage.isInstance(response)).toBe(true);
    expect(response.tool_calls?.[0]).toEqual(
      expect.objectContaining({
        name: "bash",
        type: "tool_call",
        args: expect.objectContaining({
          command: "echo $((2+2))",
        }),
      })
    );

    const result = await bash.invoke({
      command: response.tool_calls?.[0]?.args?.command,
    });
    expect(result).toBe("4\n");
  }, 60000);
});
