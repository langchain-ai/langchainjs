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
    inputValue: string | BaseMessage | Array<BaseMessage>
  ): Array<BaseMessage> {
    if (typeof inputValue === "string") {
      return [new HumanMessage(inputValue)];
    } else if (Array.isArray(inputValue)) {
      return inputValue;
    } else {
      return [inputValue];
    }
  }

  _getOutputMessages(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outputValue: string | BaseMessage | Array<BaseMessage> | Record<string, any>
  ): Array<BaseMessage> {
    let newOutputValue = outputValue;
    if (
      !Array.isArray(outputValue) &&
      !isBaseMessage(outputValue) &&
      typeof outputValue !== "string"
    ) {
      newOutputValue = outputValue[this.outputMessagesKey ?? "output"];
    }

    if (typeof newOutputValue === "string") {
      return [new AIMessage(newOutputValue)];
    } else if (Array.isArray(newOutputValue)) {
      return newOutputValue;
    } else if (isBaseMessage(newOutputValue)) {
      return [newOutputValue];
    }

    throw new Error(
      `Expected a string, BaseMessage, or array of BaseMessages. Received: ${JSON.stringify(
        newOutputValue,
        null,
        2
      )}`
    );
  }

  async _enterHistory(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any,
    kwargs?: { config?: RunnableConfig }
  ): Promise<BaseMessage[]> {
    const history = kwargs?.config?.configurable?.messageHistory;

    if (this.historyMessagesKey) {
      return history.getMessages();
    }

    let inputValue: string | BaseMessage | BaseMessage[];
    if (this.inputMessagesKey && input[this.inputMessagesKey]) {
      inputValue = input[this.inputMessagesKey];
    } else {
      inputValue = input;
    }
    // const inputVal =
    //   input ||
    //   (this.inputMessagesKey ? input[this.inputMessagesKey] : undefined);
    const historyMessages = history ? await history.getMessages() : [];
    const returnType = [
      ...historyMessages,
      ...this._getInputMessages(inputValue),
    ];
    return returnType;
  }

  async _exitHistory(run: Run, config: RunnableConfig): Promise<void> {
    const history = config.configurable?.messageHistory;

    // Get input messages
    const { inputs } = run;
    let inputValue: string | BaseMessage | BaseMessage[];
    if (this.inputMessagesKey ?? "input" in inputs) {
      inputValue = inputs[this.inputMessagesKey ?? "input"];
    } else if ("messages" in inputs) {
      inputValue = inputs.messages.flat();
    } else {
      throw new Error("Input messages not found in inputs");
    }

    const inputMessages = this._getInputMessages(inputValue);
    // Get output messages
    let outputValue = run.outputs;
    if (!outputValue) {
      throw new Error(
        `Output values from 'Run' undefined. Run: ${JSON.stringify(
          run,
          null,
          2
        )}`
      );
    } else if (
      typeof outputValue === "object" &&
      "generations" in outputValue &&
      Array.isArray(outputValue.generations) &&
      outputValue.generations[0].every((gen: Record<string, unknown>) =>
        isBaseMessage(gen.message)
      )
    ) {
      outputValue = outputValue.generations[0].map(
        (gen: Record<string, BaseMessage>) => gen.message
      ) as BaseMessage[];
    }
    const outputMessages = this._getOutputMessages(outputValue);

    for await (const message of [...inputMessages, ...outputMessages]) {
      await history.addMessage(message);
    }
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
