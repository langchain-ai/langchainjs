import { BaseChatMessageHistory } from "../chat_history.js";
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
  RunnableBindingArgs,
  RunnableLambda,
} from "./base.js";
import { RunnableConfig } from "./config.js";
import { RunnablePassthrough } from "./passthrough.js";

type GetSessionHistoryCallable = (
  ...args: Array<any>
) => BaseChatMessageHistory;

export class RunnableWithMessageHistory<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> extends RunnableBinding<RunInput, RunOutput, CallOptions> {
  runnable: Runnable<RunInput, RunOutput>;

  inputMessagesKey = "input";

  outputMessagesKey = "output";

  historyMessagesKey = "history";

  getMessageHistory: GetSessionHistoryCallable;

  constructor(
    fields: RunnableBindingArgs<RunInput, RunOutput, CallOptions> & {
      runnable: Runnable<RunInput, RunOutput>;
      getMessageHistory: GetSessionHistoryCallable;
      inputMessagesKey?: string;
      outputMessagesKey?: string;
      historyMessagesKey?: string;
    }
  ) {
    super(fields);
    this.runnable = fields.runnable;
    this.getMessageHistory = fields.getMessageHistory;
    this.inputMessagesKey = fields.inputMessagesKey ?? this.inputMessagesKey;
    this.outputMessagesKey = fields.outputMessagesKey ?? this.outputMessagesKey;
    this.historyMessagesKey =
      fields.historyMessagesKey ?? this.historyMessagesKey;

    let historyChain: Runnable = new RunnableLambda({
      func: (input: any) => (config: CallOptions) =>
        this._enterHistory(input, config),
    }).withConfig({ runName: "load_history" });

    const messages_key =
      (fields.historyMessagesKey ?? this.historyMessagesKey) ||
      (fields.inputMessagesKey ?? this.inputMessagesKey);
    if (messages_key) {
      historyChain = RunnablePassthrough.assign({
        [messages_key]: historyChain,
      }).withConfig({ runName: "insert_history" });
    }

    // const bound = historyChain
    //   .pipe(fields.runnable)
    //   .withConfig({ runName: "RunnableWithMessageHistory" })

    // this.bound = bound;
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
      newOutputValue = outputValue[this.outputMessagesKey];
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

  _enterHistory(input: any, config: CallOptions): Array<BaseMessage> {
    // what the hell is python doin?
    const history = config.configurable?.messageHistory;

    if (this.historyMessagesKey) {
      // from python, once again, what the??
      // return history.messages.copy();
      return history.messages;
    }

    const inputVal = this.inputMessagesKey
      ? input[this.inputMessagesKey]
      : input;
    return [...history.messages, ...this._getInputMessages(inputVal)];
  }

  _exitHistory(run: Run, config: CallOptions): void {
    // what the hell is python doin?
    const history = config.configurable?.messageHistory;

    // Get input messages
    const { inputs } = run;
    const inputValue = inputs[this.inputMessagesKey];
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

    for (const message of [...inputMessages, ...outputMessages]) {
      history.addMessage(message);
    }
  }

  _mergeConfigs(...configs: Array<CallOptions | undefined>) {
    const config = super._mergeConfig(...configs);
    // Extract sessionId
    if (!config.configurable || !config.configurable.sessionId) {
      const exampleInput = {
        [this.inputMessagesKey]: "foo",
      };
      const exampleConfig = { configurable: { sessionId: "123" } };
      throw new Error(
        `session_id is required. Pass it in as part of the config argument to .invoke() or .stream()\n` +
          `eg. chain.invoke(${JSON.stringify(exampleInput)}, ${JSON.stringify(
            exampleConfig
          )})`
      );
    }
    // attach messageHistory
    const { sessionId } = config.configurable;
    config.configurable.messageHistory = this.getMessageHistory(sessionId);
    return config;
  }
}
