import { StructuredTool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-pro",
});

// Define your tool
class FakeBrowserTool extends StructuredTool {
  schema = z.object({
    url: z.string(),
    query: z.string().optional(),
  });

  name = "fake_browser_tool";

  description =
    "useful for when you need to find something on the web or summarize a webpage.";

  async _call(_: z.infer<this["schema"]>): Promise<string> {
    return "fake_browser_tool";
  }
}

// Bind your tools to the model
const modelWithTools = model.bindTools([new FakeBrowserTool()]);

const res = await modelWithTools.invoke([
  [
    "human",
    "Search the web and tell me what the weather will be like tonight in new york. use a popular weather website",
  ],
]);

console.log(res.tool_calls);

/*
[
  {
    name: 'fake_browser_tool',
    args: {
      query: 'weather in new york',
      url: 'https://www.google.com/search?q=weather+in+new+york'
    }
  }
]
*/
