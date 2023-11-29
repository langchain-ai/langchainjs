import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { loadEvaluator } from "langchain/evaluation";

// Capturing Trajectory
// The easiest way to return an agent's trajectory (without using tracing callbacks like those in LangSmith)
// for evaluation is to initialize the agent with return_intermediate_steps=True.
// Below, create an example agent we will call to evaluate.

const model = new OpenAI({ temperature: 0 }, { baseURL: process.env.BASE_URL });

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

const result = await executor.invoke({ input });

// Evaluate Trajectory

const chain = await loadEvaluator("trajectory");

const res = await chain.evaluateAgentTrajectory({
  prediction: result.output,
  input,
  agentTrajectory: result.intermediateSteps,
});

console.log({ res });

/*

{
  res: {
    reasoning: "i. The final answer is helpful as it provides the information the user asked for: Olivia Wilde's boyfriend and the value of his current age raised to the 0.23 power.\n" +
      '\n' +
      "ii. The AI language model uses a logical sequence of tools to answer the question. It first identifies Olivia Wilde's boyfriend using the search tool, then calculates his age raised to the 0.23 power using the calculator tool.\n" +
      '\n' +
      "iii. The AI language model uses the tools in a helpful way. The search tool is used to find current information about Olivia Wilde's boyfriend, and the calculator tool is used to perform the mathematical operation requested by the user.\n" +
      '\n' +
      'iv. The AI language model does not use too many steps to answer the question. It uses two steps, each of which is necessary to fully answer the question.\n' +
      '\n' +
      'v. The appropriate tools are used to answer the question. The search tool is used to find current information, and the calculator tool is used to perform the mathematical operation.\n' +
      '\n' +
      "However, there is a mistake in the calculation. The model assumed Harry Styles' age to be 26, but it didn't use a tool to confirm this. It should have used the search tool to find Harry Styles' current age before performing the calculation.\n" +
      '\n' +
      "Given these considerations, the model's performance can be rated as 3 out of 5.",
    score: 0.5
  }
}
 */

// Providing List of Valid Tools
// By default, the evaluator doesn't take into account the tools the agent is permitted to call.
// You can provide these to the evaluator via the agent_tools argument.

const chainWithTools = await loadEvaluator("trajectory", { agentTools: tools });

const res2 = await chainWithTools.evaluateAgentTrajectory({
  prediction: result.output,
  input,
  agentTrajectory: result.intermediateSteps,
});

console.log({ res2 });

/*
{
  res2: {
    reasoning: "i. The final answer is helpful. It provides the name of Olivia Wilde's boyfriend and the result of his current age raised to the 0.23 power.\n" +
      '\n' +
      "ii. The AI language model uses a logical sequence of tools to answer the question. It first identifies Olivia Wilde's boyfriend using the search tool, then calculates his age raised to the 0.23 power using the calculator tool.\n" +
      '\n' +
      "iii. The AI language model uses the tools in a helpful way. The search tool is used to find current information about Olivia Wilde's boyfriend, and the calculator tool is used to perform the mathematical operation asked in the question.\n" +
      '\n' +
      'iv. The AI language model does not use too many steps to answer the question. It uses two steps, each corresponding to a part of the question.\n' +
      '\n' +
      'v. The appropriate tools are used to answer the question. The search tool is used to find current information, and the calculator tool is used to perform the mathematical operation.\n' +
      '\n' +
      "However, there is a mistake in the model's response. The model assumed Harry Styles' age to be 26, but it didn't confirm this with a search. This could lead to an incorrect calculation if his age is not 26.\n" +
      '\n' +
      "Given these considerations, I would give the model a score of 4 out of 5. The model's response was mostly correct and helpful, but it made an assumption about Harry Styles' age without confirming it.",
    score: 0.75
  }
}
 */
