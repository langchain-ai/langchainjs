import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type { VectorStoreInterface } from "@langchain/core/vectorstores";
import { ToolInterface } from "@langchain/core/tools";
import { VectorStoreQATool } from "../../../tools/vectorstore.js";
import { Toolkit } from "../base.js";
import { ZeroShotCreatePromptArgs, ZeroShotAgent } from "../../mrkl/index.js";
import { VECTOR_PREFIX, VECTOR_ROUTER_PREFIX } from "./prompt.js";
import { SUFFIX } from "../../mrkl/prompt.js";
import { LLMChain } from "../../../chains/llm_chain.js";
import { AgentExecutor } from "../../executor.js";

/**
 * Interface that defines the information about a vector store, including
 * the vector store itself, its name, and description.
 */
export interface VectorStoreInfo {
  vectorStore: VectorStoreInterface;
  name: string;
  description: string;
}

/**
 * Class representing a toolkit for working with a single vector store. It
 * initializes the vector store QA tool based on the provided vector store
 * information and language model.
 * @example
 * ```typescript
 * const toolkit = new VectorStoreToolkit(
 *   {
 *     name: "state_of_union_address",
 *     description: "the most recent state of the Union address",
 *     vectorStore: new HNSWLib(),
 *   },
 *   new ChatOpenAI({ temperature: 0 }),
 * );
 * const result = await toolkit.invoke({
 *   input:
 *     "What did biden say about Ketanji Brown Jackson in the state of the union address?",
 * });
 * console.log(`Got output ${result.output}`);
 * ```
 */
export class VectorStoreToolkit extends Toolkit {
  tools: ToolInterface[];

  llm: BaseLanguageModelInterface;

  constructor(
    vectorStoreInfo: VectorStoreInfo,
    llm: BaseLanguageModelInterface
  ) {
    super();
    const description = VectorStoreQATool.getDescription(
      vectorStoreInfo.name,
      vectorStoreInfo.description
    );
    this.llm = llm;
    this.tools = [
      new VectorStoreQATool(vectorStoreInfo.name, description, {
        vectorStore: vectorStoreInfo.vectorStore,
        llm: this.llm,
      }),
    ];
  }
}

/**
 * Class representing a toolkit for working with multiple vector stores.
 * It initializes multiple vector store QA tools based on the provided
 * vector store information and language model.
 */
export class VectorStoreRouterToolkit extends Toolkit {
  tools: ToolInterface[];

  vectorStoreInfos: VectorStoreInfo[];

  llm: BaseLanguageModelInterface;

  constructor(
    vectorStoreInfos: VectorStoreInfo[],
    llm: BaseLanguageModelInterface
  ) {
    super();
    this.llm = llm;
    this.vectorStoreInfos = vectorStoreInfos;
    this.tools = vectorStoreInfos.map((vectorStoreInfo) => {
      const description = VectorStoreQATool.getDescription(
        vectorStoreInfo.name,
        vectorStoreInfo.description
      );
      return new VectorStoreQATool(vectorStoreInfo.name, description, {
        vectorStore: vectorStoreInfo.vectorStore,
        llm: this.llm,
      });
    });
  }
}

/** @deprecated Create a specific agent with a custom tool instead. */
export function createVectorStoreAgent(
  llm: BaseLanguageModelInterface,
  toolkit: VectorStoreToolkit,
  args?: ZeroShotCreatePromptArgs
) {
  const {
    prefix = VECTOR_PREFIX,
    suffix = SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};
  const { tools } = toolkit;
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix,
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

/** @deprecated Create a specific agent with a custom tool instead. */
export function createVectorStoreRouterAgent(
  llm: BaseLanguageModelInterface,
  toolkit: VectorStoreRouterToolkit,
  args?: ZeroShotCreatePromptArgs
) {
  const {
    prefix = VECTOR_ROUTER_PREFIX,
    suffix = SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};
  const { tools } = toolkit;
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix,
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
