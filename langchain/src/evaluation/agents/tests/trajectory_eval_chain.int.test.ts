import { expect, test } from "@jest/globals";
import process from "process";
import { OpenAI } from "@langchain/openai";
import { SerpAPI } from "../../../util/testing/tools/serpapi.js";
import { Calculator } from "../../../util/testing/tools/calculator.js";
import { initializeAgentExecutorWithOptions } from "../../../agents/index.js";
import { loadEvaluator } from "../../loader.js";

test("Test TrajectoryEvalChain", async () => {
  const model = new OpenAI({ temperature: 0 });

  const tools = [
    // eslint-disable-next-line no-process-env
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    returnIntermediateSteps: true,
  });

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  const result = await executor.call({ input });

  const chain = await loadEvaluator("trajectory");

  const res = await chain.evaluateAgentTrajectory({
    prediction: result.output,
    input,
    agentTrajectory: result.intermediateSteps,
  });

  expect(res.score).toBeDefined();
  console.log({ res });
});
