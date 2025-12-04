import { expect, it, describe } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { tools } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

describe("OpenAI Code Interpreter Tool Integration Tests", () => {
  it("codeInterpreter executes Python code to solve a math problem", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4.1" });
    const llmWithCodeInterpreter = llm.bindTools([
      tools.codeInterpreter({
        container: { memoryLimit: "1g" },
      }),
    ]);

    const response = await llmWithCodeInterpreter.invoke([
      new HumanMessage(
        "Use the python tool to calculate: what is 15 * 7 + 23? Just give me the number."
      ),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    // The answer should be 128 (15 * 7 = 105, 105 + 23 = 128)
    expect(JSON.stringify(response.content)).toContain("128");
  });

  it("codeInterpreter can perform iterative calculations", async () => {
    const llm = new ChatOpenAI({ model: "gpt-4.1" });
    const llmWithCodeInterpreter = llm.bindTools([tools.codeInterpreter()]);

    const response = await llmWithCodeInterpreter.invoke([
      new HumanMessage(
        "Use the python tool to find the square root of 144, then find the square root of that result. What's the final number?"
      ),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    // sqrt(144) = 12, sqrt(12) ≈ 3.46
    expect(JSON.stringify(response.content)).toMatch(/3\.46|3\.464/);
  });
});
