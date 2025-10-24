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
const tool = new FakeBrowserTool();

// Bind your tools to the model
const modelWithTools = model.withStructuredOutput(tool.schema, {
  name: tool.name, // this is optional
});
// Optionally, you can pass just a Zod schema, or JSONified Zod schema
// const modelWithTools = model.withStructuredOutput(
//   zodSchema,
// );

const res = await modelWithTools.invoke([
  [
    "human",
    "Search the web and tell me what the weather will be like tonight in new york. use a popular weather website",
  ],
]);

console.log(res);
/*
{
  url: 'https://www.accuweather.com/en/us/new-york-ny/10007/night-weather-forecast/349014',
  query: 'weather tonight'
}
*/
