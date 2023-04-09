import { Tool } from "../../../tools/base.js";
import {
  InfoSqlTool,
  ListTablesSqlTool,
  QueryCheckerTool,
  QuerySqlTool,
} from "../../../tools/sql.js";
import { Toolkit } from "../base.js";
import { BaseLanguageModel } from "../../../base_language/index.js";
import { SQL_PREFIX, SQL_SUFFIX } from "./prompt.js";
import { renderTemplate } from "../../../prompts/template.js";
import { LLMChain } from "../../../chains/llm_chain.js";
import { ZeroShotAgent, CreatePromptArgs } from "../../mrkl/index.js";
import { AgentExecutor } from "../../executor.js";
import { SqlDatabase } from "../../../sql_db.js";

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
  llm: BaseLanguageModel,
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
  const formattedPrefix = renderTemplate(prefix, "f-string", {
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
