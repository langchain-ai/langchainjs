import { test } from "@jest/globals";
import { ChatOpenAI } from "../../../chat_models/openai.js";
import { TrajectoryEvalChain } from "../trajectory.js";
import { OpenAI } from "../../../llms/openai.js";
import { Calculator } from "../../../tools/calculator.js";
import { SerpAPI } from "../../../tools/index.js";
import { initializeAgentExecutorWithOptions } from "../../../agents/index.js";

test("Test TrajectoryEvalChain", async () => {
  const model = new OpenAI(
    { temperature: 0 },
    { baseURL: process.env.BASE_URL }
  );
  const tools = [
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

  console.log(`Got output `, JSON.stringify(result));

  const model2 = new ChatOpenAI(
    {
      modelName: "gpt-4",
      verbose: true,
    },
    { baseURL: process.env.BASE_URL }
  );

  const chain = await TrajectoryEvalChain.fromLLM(model2);

  console.log("beginning evaluation");
  const res = await chain.evaluateAgentTrajectory({
    prediction: result.output,
    input,
    agentTrajectory: result.intermediateSteps,
  });

  console.log({ res });
});
