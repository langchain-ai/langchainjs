import { OpenAI } from "langchain";
import { ZeroShotAgent, AgentExecutor } from "langchain/agents";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { JsonSpec, JsonToolkit } from "langchain/tools";

export const run = async () => {
  let data: object;
  try {
    const yamlFile = fs.readFileSync("openai_openapi.yaml", "utf8");
    data = yaml.load(yamlFile) as object;
    if (!data) {
      console.error("Could not load YAML file");
    }
  } catch (e) {
    console.error(e);
    return;
  }

  const toolkit = new JsonToolkit(new JsonSpec(data));
  const model = new OpenAI({ temperature: 0 });

  const agent = ZeroShotAgent.asJsonAgent(model, toolkit);
  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: toolkit.tools,
    returnIntermediateSteps: true,
  });

  const input = `What are the required parameters in the request body to the /completions endpoint?`;

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
