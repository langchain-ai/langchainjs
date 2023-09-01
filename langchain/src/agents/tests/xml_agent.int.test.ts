import { test } from "@jest/globals";

import { ChatAnthropic } from "../../chat_models/anthropic.js";
import { Calculator } from "../../tools/calculator.js";
import { Tool } from "../../tools/base.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";

class FakeWebSearchTool extends Tool {
  name = "fake_web_search_tool";

  description = "useful for when you need to search for up to date webpages.";

  async _call(_query: string): Promise<string> {
    return [...Array(3).keys()]
      .map((n) => `https://langchain.com/tutorial/${n}`)
      .join(", ");
  }
}

test("Run XML agent", async () => {
  const model = new ChatAnthropic({ modelName: "claude-2", temperature: 0.1 });
  const tools = [new Calculator(), new FakeWebSearchTool({})];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "xml",
    verbose: true,
  });
  console.log("Loaded agent.");

  const input0 = `what is 9 to the 2nd power?`;

  const result0 = await executor.call({ input: input0 });

  console.log(`Got output ${result0.output}`);

  const input1 = `Give me some URLs for tutorial articles on LangChain as a comma separated list.`;

  const result1 = await executor.call({ input: input1 });

  console.log(`Got output ${result1.output}`);
});
