import { describe, test } from "@jest/globals";
import { HumanTool } from "../human.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";

describe("Human as a tool integration test suite", () => {
  test("HumanTool run in an agent", async () => {
    const model = new ChatOpenAI({ temperature: 0 });
    const tools = [new HumanTool()];

    const executor = await initializeAgentExecutorWithOptions(tools, model, {
      agentType: "chat-zero-shot-react-description",
      verbose: true,
    });

    const input = `I need help attributing a quote`;
    console.log(`Executing with input "${input}"...`);

    const result = await executor.call({ input });

    console.log(`Got output ${result.output}`);

    expect(result.output).toContain("what is the quote");
    expect(result.output).toContain("attribute");
    expect(result.output).toContain("?");
  });
});
