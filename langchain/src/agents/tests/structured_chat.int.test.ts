import { test } from "@jest/globals";
import { z } from "zod";

import { ChatOpenAI } from "../../chat_models/openai.js";
import { Calculator } from "../../tools/calculator.js";
import { StructuredTool } from "../../tools/base.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { MessagesPlaceholder } from "../../prompts/chat.js";

class FakeWebSearchTool extends StructuredTool {
  schema = z.object({
    query: z.string(),
    max_results: z.number(),
  });

  name = "fake_web_search_tool";

  description = "useful for when you need to search for up to date webpages.";

  async _call({
    query: _query,
    max_results,
  }: z.infer<this["schema"]>): Promise<string> {
    return [...Array(max_results).keys()]
      .map((n) => `https://langchain.com/tutorial/${n}`)
      .join(", ");
  }
}

test("Run structured chat agent", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const tools = [new Calculator(), new FakeWebSearchTool({})];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input0 = `what is 9 to the 2nd power?`;

  const result0 = await executor.call({ input: input0 });

  console.log(`Got output ${result0.output}`);

  const input1 = `Give me some URLs for tutorial articles on LangChain as a comma separated list.`;

  const result1 = await executor.call({ input: input1 });

  console.log(`Got output ${result1.output}`);
});

test("Run structured chat agent with memory", async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [new Calculator()];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
    memory: new BufferMemory({
      memoryKey: "chat_history",
      returnMessages: true,
    }),
    agentArgs: {
      inputVariables: ["input", "agent_scratchpad", "chat_history"],
      memoryPrompts: [new MessagesPlaceholder("chat_history")],
    },
  });

  const result0 = await executor.call({ input: `what is 9 to the 2nd power?` });

  console.log(result0);

  const result1 = await executor.call({
    input: `what is that number squared?`,
  });

  console.log(result1);
});
