import { ChatCompletionRequestMessageFunctionCall } from "openai";
import { CallbackManager } from "../../callbacks/manager.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  AIChatMessage,
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseChatMessage,
  FunctionChatMessage,
  ChainValues,
} from "../../schema/index.js";
import { StructuredTool } from "../../tools/base.js";
import { Agent, AgentArgs } from "../agent.js";
import { AgentInput } from "../types.js";
import { PREFIX } from "./prompt.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";

function parseOutput(message: BaseChatMessage): AgentAction | AgentFinish {
  if (message.additional_kwargs.function_call) {
    // eslint-disable-next-line prefer-destructuring
    const function_call: ChatCompletionRequestMessageFunctionCall =
      message.additional_kwargs.function_call;
    return {
      tool: function_call.name as string,
      toolInput: function_call.arguments
        ? JSON.parse(function_call.arguments)
        : {},
      log: message.text,
    };
  } else {
    return { returnValues: { output: message.text }, log: message.text };
  }
}

export interface OpenAIAgentInput extends AgentInput {
  tools: StructuredTool[];
}

export interface OpenAIAgentCreatePromptArgs {
  prefix?: string;
}

export class OpenAIAgent extends Agent {
  lc_namespace = ["langchain", "agents", "openai"];

  _agentType() {
    return "openai-functions" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  _stop(): string[] {
    return ["Observation:"];
  }

  tools: StructuredTool[];

  constructor(input: Omit<OpenAIAgentInput, "outputParser">) {
    super({ ...input, outputParser: undefined });
    this.tools = input.tools;
  }

  static createPrompt(
    _tools: StructuredTool[],
    fields?: OpenAIAgentCreatePromptArgs
  ): BasePromptTemplate {
    const { prefix = PREFIX } = fields || {};
    return ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(prefix),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: StructuredTool[],
    args?: OpenAIAgentCreatePromptArgs & Pick<AgentArgs, "callbacks">
  ) {
    OpenAIAgent.validateTools(tools);
    if (llm._modelType() !== "base_chat_model" || llm._llmType() !== "openai") {
      throw new Error("OpenAIAgent requires an OpenAI chat model");
    }
    const prompt = OpenAIAgent.createPrompt(tools, args);
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks,
    });
    return new OpenAIAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
      tools,
    });
  }

  async constructScratchPad(
    steps: AgentStep[]
  ): Promise<string | BaseChatMessage[]> {
    return steps.flatMap(({ action, observation }) => [
      new AIChatMessage("", {
        function_call: {
          name: action.tool,
          arguments: JSON.stringify(action.toolInput),
        },
      }),
      new FunctionChatMessage(observation, action.tool),
    ]);
  }

  async plan(
    steps: Array<AgentStep>,
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    // Add scratchpad and stop to inputs
    const thoughts = await this.constructScratchPad(steps);
    const newInputs: ChainValues = {
      ...inputs,
      agent_scratchpad: thoughts,
    };
    if (this._stop().length !== 0) {
      newInputs.stop = this._stop();
    }

    // Split inputs between prompt and llm
    const llm = this.llmChain.llm as ChatOpenAI;
    const valuesForPrompt = { ...newInputs };
    const valuesForLLM: (typeof llm)["CallOptions"] = {
      tools: this.tools,
    };
    for (const key of this.llmChain.llm.callKeys) {
      if (key in inputs) {
        valuesForLLM[key as keyof (typeof llm)["CallOptions"]] = inputs[key];
        delete valuesForPrompt[key];
      }
    }

    const promptValue = await this.llmChain.prompt.formatPromptValue(
      valuesForPrompt
    );
    const message = await llm.predictMessages(
      promptValue.toChatMessages(),
      valuesForLLM,
      callbackManager
    );
    return parseOutput(message);
  }
}
