/* eslint-disable no-process-env */
import { OpenAI } from "../../llms/openai.js";
import { SerpAPI } from "../../tools/serpapi.js";
import { initializeAgentExecutorWithOptions } from "../initialize.js";

test("Run agent locally with GPT-3.5", async () => {
  const model = new OpenAI({ temperature: 0, modelName: "text-ada-001" });
  const tools = [
    new SerpAPI(undefined, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    handleParsingErrors: true,
    verbose: true,
  });

  const input = `Who is Leo DiCaprio's girlfriend?`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
});
