import {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "../chat_history.js";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isBaseMessage,
} from "../messages/index.js";
import { Run } from "../tracers/base.js";
import {
  Runnable,
  RunnableBinding,
  type RunnableBindingArgs,
  RunnableLambda,
} from "./base.js";
import { RunnableConfig } from "./config.js";
import { RunnablePassthrough } from "./passthrough.js";

type GetSessionHistoryCallable = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: Array<any>
) =>
  | Promise<BaseChatMessageHistory | BaseListChatMessageHistory>
  | BaseChatMessageHistory
  | BaseListChatMessageHistory;

export interface RunnableWithMessageHistoryInputs<RunInput, RunOutput>
  extends Omit<RunnableBindingArgs<RunInput, RunOutput>, "bound" | "config"> {
  runnable: Runnable<RunInput, RunOutput>;
  getMessageHistory: GetSessionHistoryCallable;
  inputMessagesKey?: string;
  outputMessagesKey?: string;
  historyMessagesKey?: string;
  config?: RunnableConfig;
}

/**
 * Wraps a LCEL chain and manages history. It appends input messages
 * and chain outputs as history, and adds the current history messages to
 * the chain input.
 * @example
 * ```typescript
 * // yarn add @langchain/anthropic @langchain/community @upstash/redis
 *
 * import {
 *   ChatPromptTemplate,
 *   MessagesPlaceholder,
 * } from "@langchain/core/prompts";
 * import { ChatAnthropic } from "@langchain/anthropic";
 * import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";
 * // For demos, you can also use an in-memory store:
 * // import { ChatMessageHistory } from "langchain/stores/message/in_memory";
 *
 * const prompt = ChatPromptTemplate.fromMessages([
 *   ["system", "You're an assistant who's good at {ability}"],
 *   new MessagesPlaceholder("history"),
 *   ["human", "{question}"],
 * ]);
 *
 * const chain = prompt.pipe(new ChatAnthropic({}));
 *
 * const chainWithHistory = new RunnableWithMessageHistory({
 *   runnable: chain,
 *   getMessageHistory: (sessionId) =>
 *     new UpstashRedisChatMessageHistory({
 *       sessionId,
 *       config: {
 *         url: process.env.UPSTASH_REDIS_REST_URL!,
 *         token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *       },
 *     }),
 *   inputMessagesKey: "question",
 *   historyMessagesKey: "history",
 * });
 *
 * const result = await chainWithHistory.invoke(
 *   {
 *     ability: "math",
 *     question: "What does cosine mean?",
 *   },
 *   {
 *     configurable: {
 *       sessionId: "some_string_identifying_a_user",
 *     },
 *   }
 * );
 *
 * const result2 = await chainWithHistory.invoke(
 *   {
 *     ability: "math",
 *     question: "What's its inverse?",
 *   },
 *   {
 *     configurable: {
 *       sessionId: "some_string_identifying_a_user",
 *     },
 *   }
 * );
 * ```
 */
export class RunnableWithMessageHistory<
  RunInput,
  RunOutput
> extends RunnableBinding<RunInput, RunOutput> {
  runnable: Runnable<RunInput, RunOutput>;

  inputMessagesKey?: string;

  outputMessagesKey?: string;

  historyMessagesKey?: string;

  getMessageHistory: GetSessionHistoryCallable;

  constructor(fields: RunnableWithMessageHistoryInputs<RunInput, RunOutput>) {
    let historyChain: Runnable = new RunnableLambda({
      func: (input, options) => this._enterHistory(input, options ?? {}),
    }).withConfig({ runName: "loadHistory" });

    const messagesKey = fields.historyMessagesKey ?? fields.inputMessagesKey;
    if (messagesKey) {
      historyChain = RunnablePassthrough.assign({
        [messagesKey]: historyChain,
      }).withConfig({ runName: "insertHistory" });
    }

    const bound = historyChain
      .pipe(
        fields.runnable.withListeners({
          onEnd: (run, config) => this._exitHistory(run, config ?? {}),
        })
      )
      .withConfig({ runName: "RunnableWithMessageHistory" });

    const config = fields.config ?? {};

    super({
      ...fields,
      config,
      bound,
    });
    this.runnable = fields.runnable;
    this.getMessageHistory = fields.getMessageHistory;
    this.inputMessagesKey = fields.inputMessagesKey;
    this.outputMessagesKey = fields.outputMessagesKey;
    this.historyMessagesKey = fields.historyMessagesKey;
  }

  _getInputMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputValue: string | BaseMessage | Array<BaseMessage> | Record<string, any>
  ): Array<BaseMessage> {
    let parsedInputValue;
    if (
      typeof inputValue === "object" &&
      !Array.isArray(inputValue) &&
      !isBaseMessage(inputValue)
    ) {
      let key;
      if (this.inputMessagesKey) {
        key = this.inputMessagesKey;
      } else if (Object.keys(inputValue).length === 1) {
        key = Object.keys(inputValue)[0];
      } else {
        key = "input";
      }
      if (Array.isArray(inputValue[key]) && Array.isArray(inputValue[key][0])) {
        parsedInputValue = inputValue[key][0];
      } else {
        parsedInputValue = inputValue[key];
      }
    } else {
      parsedInputValue = inputValue;
    }
    if (typeof parsedInputValue === "string") {
      return [new HumanMessage(parsedInputValue)];
    } else if (Array.isArray(parsedInputValue)) {
      return parsedInputValue;
    } else if (isBaseMessage(parsedInputValue)) {
      return [parsedInputValue];
    } else {
      throw new Error(
        `Expected a string, BaseMessage, or array of BaseMessages.\nGot ${JSON.stringify(
          parsedInputValue,
          null,
          2
        )}`
      );
    }
  }

  _getOutputMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputValue: string | BaseMessage | Array<BaseMessage> | Record<string, any>
  ): Array<BaseMessage> {
    let parsedOutputValue;
    if (
      !Array.isArray(outputValue) &&
      !isBaseMessage(outputValue) &&
      typeof outputValue !== "string"
    ) {
      let key;
      if (this.outputMessagesKey !== undefined) {
        key = this.outputMessagesKey;
      } else if (Object.keys(outputValue).length === 1) {
        key = Object.keys(outputValue)[0];
      } else {
        key = "output";
      }
      // If you are wrapping a chat model directly
      // The output is actually this weird generations object
      if (outputValue.generations !== undefined) {
        parsedOutputValue = outputValue.generations[0][0].message;
      } else {
        parsedOutputValue = outputValue[key];
      }
    } else {
      parsedOutputValue = outputValue;
    }

    if (typeof parsedOutputValue === "string") {
      return [new AIMessage(parsedOutputValue)];
    } else if (Array.isArray(parsedOutputValue)) {
      return parsedOutputValue;
    } else if (isBaseMessage(parsedOutputValue)) {
      return [parsedOutputValue];
    } else {
      throw new Error(
        `Expected a string, BaseMessage, or array of BaseMessages. Received: ${JSON.stringify(
          parsedOutputValue,
          null,
          2
        )}`
      );
    }
  }

  async _enterHistory(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any,
    kwargs?: { config?: RunnableConfig }
  ): Promise<BaseMessage[]> {
    const history = kwargs?.config?.configurable?.messageHistory;
    const messages = await history.getMessages();
    if (this.historyMessagesKey === undefined) {
      return messages.concat(this._getInputMessages(input));
    }
    return messages;
  }

  async _exitHistory(run: Run, config: RunnableConfig): Promise<void> {
    const history = config.configurable?.messageHistory;

    // Get input messages
    let inputs;
    // Chat model inputs are nested arrays
    if (Array.isArray(run.inputs) && Array.isArray(run.inputs[0])) {
      inputs = run.inputs[0];
    } else {
      inputs = run.inputs;
    }
    let inputMessages = this._getInputMessages(inputs);
    // If historic messages were prepended to the input messages, remove them to
    // avoid adding duplicate messages to history.
    if (this.historyMessagesKey === undefined) {
      const existingMessages = await history.getMessages();
      inputMessages = inputMessages.slice(existingMessages.length);
    }
    // Get output messages
    const outputValue = run.outputs;
    if (!outputValue) {
      throw new Error(
        `Output values from 'Run' undefined. Run: ${JSON.stringify(
          run,
          null,
          2
        )}`
      );
    }
    const outputMessages = this._getOutputMessages(outputValue);
    await history.addMessages([...inputMessages, ...outputMessages]);
  }

  async _mergeConfig(...configs: Array<RunnableConfig | undefined>) {
    const config = await super._mergeConfig(...configs);
    // Extract sessionId
    if (!config.configurable || !config.configurable.sessionId) {
      const exampleInput = {
        [this.inputMessagesKey ?? "input"]: "foo",
      };
      const exampleConfig = { configurable: { sessionId: "123" } };
      throw new Error(
        `sessionId is required. Pass it in as part of the config argument to .invoke() or .stream()\n` +
          `eg. chain.invoke(${JSON.stringify(exampleInput)}, ${JSON.stringify(
            exampleConfig
          )})`
      );
    }
    // attach messageHistory
    const { sessionId } = config.configurable;
    config.configurable.messageHistory = await this.getMessageHistory(
      sessionId
    );
    return config;
  }
}
