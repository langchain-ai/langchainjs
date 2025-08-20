import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import {
  createReactAgent,
  tool,
  asJsonSchemaOutput,
  asToolOutput,
} from "langchain";

const chatModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const getCapital = tool(
  async (input) => {
    console.log("tool called with country:", input.country);
    return "foobar";
  },
  {
    name: "getCapital",
    description: "Get the capital of a country",
    schema: z.object({
      country: z.string(),
    }),
  }
);

const agent = createReactAgent({
  llm: chatModel,
  tools: [getCapital],
  //   responseFormat: z.object({})

  responseFormat: asJsonSchemaOutput(
    z.object({
      capital: z.string(),
    })
  ),
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the capital of FakeCountry?" }],
});
console.log("Last Message", result.messages.at(-1)?.content);
console.log("Sturctured Result: ", result.structuredResponse);
