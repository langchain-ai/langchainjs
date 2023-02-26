import { OpenAI, LLMChain } from "langchain";
import { ZeroShotAgent, AgentExecutor } from "langchain/agents";
import * as fs from "fs";
import * as yaml from "js-yaml";
import {
  JsonSpec,
  JsonToolkit,
  JsonObject,
  RequestsToolkit,
  DynamicTool,
} from "langchain/tools";

export const run = async () => {
  let data: JsonObject;
  try {
    const yamlFile = fs.readFileSync("openai_openapi.yaml", "utf8");
    data = yaml.load(yamlFile) as JsonObject;
    if (!data) {
      throw new Error("Failed to load OpenAPI spec");
    }
  } catch (e) {
    console.error(e);
    return;
  }

  const toolkit = new JsonToolkit(new JsonSpec(data));
  const model = new OpenAI({ temperature: 0 });

  const jsonAgent = ZeroShotAgent.asJsonAgent(model, toolkit);
  const jsonExecutor = AgentExecutor.fromAgentAndTools({
    agent: jsonAgent,
    tools: toolkit.tools,
    returnIntermediateSteps: true,
  });

  // create the combined agent
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };
  const requestsToolkit = new RequestsToolkit(headers);
  const tools = [
    ...requestsToolkit.tools,
    new DynamicTool({
      name: "json_explorer",
      func: async (input: string) => {
        const result = await jsonExecutor.call({ input });
        return result.output as string;
      },
      description: `
                Can be used to answer questions about the openapi spec for the API. Always use this tool before trying to make a request. 
                Example inputs to this tool: 
                    'What are the required query parameters for a GET request to the /bar endpoint?\`
                    'What are the required parameters in the request body for a POST request to the /foo endpoint?'
                Always give this tool a specific question.`,
    }),
  ];
  const prefix = `
You are an agent designed to answer questions by making web requests to an API given the openapi spec.

If the question does not seem related to the API, return I don't know. Do not make up an answer.
Only use information provided by the tools to construct your response.

First, find the base URL needed to make the request.

Second, find the relevant paths needed to answer the question. Take note that, sometimes, you might need to make more than one request to more than one path to answer the question.

Third, find the required parameters needed to make the request. For GET requests, these are usually URL parameters and for POST requests, these are request body parameters.

Fourth, make the requests needed to answer the question. Ensure that you are sending the correct parameters to the request by checking which parameters are required. For parameters with a fixed set of values, please use the spec to look at which values are allowed.

Use the exact parameter names as listed in the spec, do not make up any names or abbreviate the names of parameters.
If you get a not found error, ensure that you are using a path that actually exists in the spec.`;

  const suffix = `Begin!"

Question: {input}
Thought: I should explore the spec to find the base url for the API.
{agent_scratchpad}`;

  const prompt = ZeroShotAgent.createPrompt(tools, { prefix, suffix });
  const llmChain = new LLMChain({
    prompt,
    llm: new OpenAI({ temperature: 0 }),
  });
  const toolNames = tools.map((tool) => tool.name);
  const agent = new ZeroShotAgent({ llmChain, allowedTools: toolNames });
  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });

  const input = `Make a POST request to openai /completions. The prompt should be 'tell me a joke.'`;
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });
  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};
