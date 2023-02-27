import {
  Tool,
  InfoSqlTool,
  ListTablesSqlTool,
  QueryCheckerTool,
  QuerySqlTool,
  SqlDatabase,
} from "../tools";
import { Toolkit } from "./base";
import { BaseLLM } from "../../llms";
import { SQL_PREFIX, SQL_SUFFIX } from "./prompt";
import { interpolateFString } from "../../prompts/template";
import { LLMChain } from "../../chains";
import { ZeroShotAgent, CreatePromptArgs } from "../mrkl";
import { AgentExecutor } from "../executor";

type SqlCreatePromptArgs = {
  /** Number of results to return. */
  topK?: number;
} & CreatePromptArgs;

export class SqlToolkit extends Toolkit {
  tools: Tool[];

  db: SqlDatabase;

  dialect = "sqlite";

  constructor(db: SqlDatabase) {
    super();
    this.db = db;
    this.tools = [
      new QuerySqlTool(db),
      new InfoSqlTool(db),
      new ListTablesSqlTool(db),
      new QueryCheckerTool(),
    ];
  }
}

export function createSqlAgent(
  llm: BaseLLM,
  toolkit: SqlToolkit,
  args?: SqlCreatePromptArgs
) {
  const {
    prefix = SQL_PREFIX,
    suffix = SQL_SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
    topK = 10,
  } = args ?? {};
  const { tools } = toolkit;
  const formattedPrefix = interpolateFString(prefix, {
    dialect: toolkit.dialect,
    top_k: topK,
  });
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix: formattedPrefix,
    suffix,
    inputVariables,
  });
  const chain = new LLMChain({ prompt, llm });
  const agent = new ZeroShotAgent({
    llmChain: chain,
    allowedTools: tools.map((t) => t.name),
  });
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
}
