import { BaseCallbackConfig } from "../callbacks/manager.js";
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
  extends Omit<
    RunnableBindingArgs<RunInput, RunOutput, BaseCallbackConfig>,
    "bound" | "config"
  > {
  runnable: Runnable<RunInput, RunOutput>;
  getMessageHistory: GetSessionHistoryCallable;
  inputMessagesKey?: string;
  outputMessagesKey?: string;
  historyMessagesKey?: string;
  config?: RunnableConfig;
}

export class RunnableWithMessageHistory<
  RunInput,
  RunOutput
> extends RunnableBinding<RunInput, RunOutput, BaseCallbackConfig> {
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

  _enterHistory(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any,
    kwargs?: { config?: RunnableConfig }
  ): Array<BaseMessage> {
    const history = kwargs?.config?.configurable?.messageHistory;

    if (this.historyMessagesKey) {
      return history.messages;
    }

    const inputVal =
      input ||
      (this.inputMessagesKey ? input[this.inputMessagesKey] : undefined);
    const historyMessages = history ? history.messages : [];
    const returnType = [
      ...historyMessages,
      ...this._getInputMessages(inputVal),
    ];
    return returnType;
  }

  async _exitHistory(run: Run, config: BaseCallbackConfig): Promise<void> {
    const history = config.configurable?.messageHistory;

    // Get input messages
    const { inputs } = run;
    const inputValue = inputs[this.inputMessagesKey ?? "input"];
    const inputMessages = this._getInputMessages(inputValue);
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

    for await (const message of [...inputMessages, ...outputMessages]) {
      await history.addMessage(message);
    }
  }

  async _mergeConfig(...configs: Array<BaseCallbackConfig | undefined>) {
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
