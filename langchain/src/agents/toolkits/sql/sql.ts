import type {
  BaseLanguageModel,
  BaseLanguageModelInterface,
} from "@langchain/core/language_models/base";
import type { Tool, ToolInterface } from "@langchain/core/tools";
import { Toolkit } from "@langchain/community/agents/toolkits/base";
import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  renderTemplate,
} from "@langchain/core/prompts";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Runnable } from "@langchain/core/runnables";
import {
  InfoSqlTool,
  ListTablesSqlTool,
  QueryCheckerTool,
  QuerySqlTool,
} from "../../../tools/sql.js";
import { SQL_PREFIX, SQL_SUFFIX } from "./prompt.js";
import { LLMChain } from "../../../chains/llm_chain.js";
import { ZeroShotAgent, ZeroShotCreatePromptArgs } from "../../mrkl/index.js";
import { AgentExecutor } from "../../executor.js";
import { SqlDatabase } from "../../../sql_db.js";
import { StoppingMethod } from "../../types.js";
import {
  createOpenAIFunctionsAgent,
  createOpenAIToolsAgent,
  createReactAgent,
} from "../../index.js";

/**
 * Interface that extends ZeroShotCreatePromptArgs and adds an optional
 * topK parameter for specifying the number of results to return.
 */
export interface SqlCreatePromptArgs extends ZeroShotCreatePromptArgs {
  /** Number of results to return. */
  topK?: number;
}

/**
 * Class that represents a toolkit for working with SQL databases. It
 * initializes SQL tools based on the provided SQL database.
 * @example
 * ```typescript
 * const model = new ChatOpenAI({});
 * const toolkit = new SqlToolkit(sqlDb, model);
 * const executor = createSqlAgent(model, toolkit);
 * const result = await executor.invoke({ input: 'List the total sales per country. Which country's customers spent the most?' });
 * console.log(`Got output ${result.output}`);
 * ```
 */
export class SqlToolkit extends Toolkit {
  tools: ToolInterface[];

  db: SqlDatabase;

  dialect = "sqlite";

  constructor(db: SqlDatabase, llm?: BaseLanguageModelInterface) {
    super();
    this.db = db;
    this.tools = [
      new QuerySqlTool(db),
      new InfoSqlTool(db),
      new ListTablesSqlTool(db),
      new QueryCheckerTool({ llm }),
    ];
  }
}

export function createSqlAgent(
  llm: BaseLanguageModelInterface,
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

type AgentType =
  | "openai-tools"
  | "openai-functions"
  | "zero-shot-react-description";

interface CreateSqlAgentRunnableFields {
  llm: BaseLanguageModel;
  toolkit?: SqlToolkit;
  agentType?: AgentType;
  /**
   * Prompt prefix string. Must contain variables "top_k" and "dialect".
   */
  prefix?: string;
  /**
   * Prompt suffix string. Default depends on agent type.
   */
  suffix?: string;
  /**
   * Only used when agentType is "zero-shot-react-description".
   */
  formatInstructions?: string;
  /**
   * @default 10
   */
  topK?: number;
  /**
   * Passed to AgentExecutor init.
   * @default 15
   */
  maxIterations?: number;
  /**
   * Passed to AgentExecutor init.
   * @default "force"
   */
  earlyStoppingMethod?: StoppingMethod;
  extraTools?: Tool[];
  db?: SqlDatabase;
  prompt?: BasePromptTemplate;
}

export async function createSqlAgentRunnable(
  fields: CreateSqlAgentRunnableFields
) {
  if (!fields.toolkit && !fields.db) {
    throw new Error(
      "Must provide exactly one of 'toolkit' or 'db'. Received neither."
    );
  }
  if (fields.toolkit && fields.db) {
    throw new Error(
      "Must provide exactly one of 'toolkit' or 'db'. Received both."
    );
  }

  // Type casting as SqlDatabase here because TypeScript does not recognize that
  // the errors above will throw if both are undefined.
  const newToolkit =
    fields.toolkit ?? new SqlToolkit(fields.db as SqlDatabase, fields.llm);
  const newAgentType = fields.agentType ?? "zero-shot-react-description";
  let tools = [...newToolkit.getTools(), ...(fields.extraTools ?? [])];
  const newTopK = fields.topK ?? 10;

  let prefix = "";
  let newPrompt = fields.prompt;
  let dbContext = "";
  // Constructing prompt
  if (!newPrompt) {
    prefix = fields.prefix ?? SQL_PREFIX;
    prefix = prefix
      .replace("{dialect}", newToolkit.dialect)
      .replace("{top_k}", newTopK.toString());
  } else {
    if (newPrompt.inputVariables.includes("top_k")) {
      newPrompt = await newPrompt.partial({ top_k: newTopK.toString() });
    }
    if (newPrompt.inputVariables.includes("dialect")) {
      newPrompt = await newPrompt.partial({ dialect: newToolkit.dialect });
      dbContext = await newToolkit.db.getTableInfo();
    }
    if (newPrompt.inputVariables.includes("table_info")) {
      newPrompt = await newPrompt.partial({ table_info: dbContext });
      tools = tools.filter((t) => t.name !== "list-tables-sql");
    }
  }

  let runnableAgent: Runnable;
  if (newAgentType === "zero-shot-react-description") {
    if (!newPrompt) {
      const mrklPrompts = await import("../../mrkl/prompt.js");

      const formatInstructions =
        fields.formatInstructions ?? mrklPrompts.FORMAT_INSTRUCTIONS;
      const template = [
        mrklPrompts.PREFIX,
        "{tools}",
        formatInstructions,
        mrklPrompts.SUFFIX,
      ].join("\n\n");
      newPrompt = PromptTemplate.fromTemplate(template);
    }
    runnableAgent = await createReactAgent({
      llm: fields.llm,
      tools,
      prompt: newPrompt,
    });
  } else if (newAgentType === "openai-tools") {
    if (!newPrompt) {
      const messages = [
        new SystemMessage(prefix),
        ...(!fields.suffix
          ? [HumanMessagePromptTemplate.fromTemplate("{input}")]
          : []),
        new AIMessage(
          fields.suffix ?? SQL_SUFFIX.replace("{agent_scratchpad}", "")
        ),
        new MessagesPlaceholder("agent_scratchpad"),
      ];
      newPrompt = ChatPromptTemplate.fromMessages(messages);
    } else if (newPrompt._getPromptType() !== "chat") {
      throw new Error(
        `Prompt type must be 'chat' if using 'openai-tools. Received prompt type '${newPrompt._getPromptType()}'.`
      );
    }

    if (!fields.llm.lc_namespace.includes("chat_models")) {
      throw new Error(
        `Must provide a chat model if using 'openai-tools'. Received: ${fields.llm.lc_namespace.join(
          ", "
        )}`
      );
    }

    runnableAgent = await createOpenAIToolsAgent({
      llm: fields.llm as BaseChatModel,
      tools,
      prompt: newPrompt as ChatPromptTemplate,
    });
  } else if (newAgentType === "openai-functions") {
    if (!newPrompt) {
      const messages = [
        new SystemMessage(prefix),
        ...(!fields.suffix
          ? [HumanMessagePromptTemplate.fromTemplate("{input}")]
          : []),
        new AIMessage(
          fields.suffix ?? SQL_SUFFIX.replace("{agent_scratchpad}", "")
        ),
        new MessagesPlaceholder("agent_scratchpad"),
      ];
      newPrompt = ChatPromptTemplate.fromMessages(messages);
    } else if (newPrompt._getPromptType() !== "chat") {
      throw new Error(
        `Prompt type must be 'chat' if using 'openai-functions. Received prompt type '${newPrompt._getPromptType()}'.`
      );
    }

    if (!fields.llm.lc_namespace.includes("chat_models")) {
      throw new Error(
        `Must provide a chat model if using 'openai-functions'. Received: ${fields.llm.lc_namespace.join(
          ", "
        )}`
      );
    }

    runnableAgent = await createOpenAIFunctionsAgent({
      llm: fields.llm as BaseChatModel,
      tools,
      prompt: newPrompt as ChatPromptTemplate,
    });
  } else {
    throw new Error(`Agent type ${newAgentType} not supported at the moment.`);
  }

  return new AgentExecutor({
    agent: runnableAgent,
    tools,
    maxIterations: fields.maxIterations ?? 15,
    earlyStoppingMethod: fields.earlyStoppingMethod,
  });
}
