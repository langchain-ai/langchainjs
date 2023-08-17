import { ChatCompletionRequestMessageFunctionCall } from "openai";
import { CallbackManager } from "../../callbacks/manager.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  AIMessage,
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  FunctionMessage,
  ChainValues,
  SystemMessage,
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
import { OutputParserException } from "../../schema/output_parser.js";

type FunctionsAgentAction = AgentAction & {
  messageLog?: BaseMessage[];
};

function parseOutput(message: BaseMessage): FunctionsAgentAction | AgentFinish {
  if (message.additional_kwargs.function_call) {
    // eslint-disable-next-line prefer-destructuring
    const function_call: ChatCompletionRequestMessageFunctionCall =
      message.additional_kwargs.function_call;
    try {
      const toolInput = function_call.arguments
        ? JSON.parse(function_call.arguments)
        : {};
      return {
        tool: function_call.name as string,
        toolInput,
        log: `Invoking "${function_call.name}" with ${
          function_call.arguments ?? "{}"
        }\n${message.content}`,
        messageLog: [message],
      };
    } catch (error) {
      throw new OutputParserException(
        `Failed to parse function arguments from chat model response. Text: "${function_call.arguments}". ${error}`
      );
    }
  } else {
    return { returnValues: { output: message.content }, log: message.content };
  }
}

function isFunctionsAgentAction(
  action: AgentAction | FunctionsAgentAction
): action is FunctionsAgentAction {
  return (action as FunctionsAgentAction).messageLog !== undefined;
}

function _convertAgentStepToMessages(
  action: AgentAction | FunctionsAgentAction,
  observation: string
) {
  if (isFunctionsAgentAction(action) && action.messageLog !== undefined) {
    return action.messageLog?.concat(
      new FunctionMessage(observation, action.tool)
    );
  } else {
    return [new AIMessage(action.log)];
  }
}

export function _formatIntermediateSteps(
  intermediateSteps: AgentStep[]
): BaseMessage[] {
  return intermediateSteps.flatMap(({ action, observation }) =>
    _convertAgentStepToMessages(action, observation)
  );
}

export interface OpenAIAgentInput extends AgentInput {
  tools: StructuredTool[];
}

export interface OpenAIAgentCreatePromptArgs {
  prefix?: string;
  systemMessage?: SystemMessage;
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
  ): Promise<string | BaseMessage[]> {
    return _formatIntermediateSteps(steps);
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
