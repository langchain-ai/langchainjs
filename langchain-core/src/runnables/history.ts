import { BaseCallbackConfig } from "../callbacks/manager.js";
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
import { RunnablePassthrough } from "./passthrough.js";

type GetSessionHistoryCallable = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: Array<any>
) => Promise<BaseChatMessageHistory>;

export class RunnableWithMessageHistory<
  RunInput,
  RunOutput
> extends RunnableBinding<RunInput, RunOutput, BaseCallbackConfig> {
  runnable: Runnable<RunInput, RunOutput>;

  inputMessagesKey?: string;

  outputMessagesKey?: string;

  historyMessagesKey?: string;

  getMessageHistory: GetSessionHistoryCallable;

  constructor(
    fields: RunnableBindingArgs<RunInput, RunOutput, BaseCallbackConfig> & {
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
    this.inputMessagesKey = fields.inputMessagesKey;
    this.outputMessagesKey = fields.outputMessagesKey;
    this.historyMessagesKey = fields.historyMessagesKey;

    let historyChain: Runnable = new RunnableLambda({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      func: (input: any) => {
        console.log("HISTORY CHAIN CALLED", input);
        return this._enterHistory(input, {});
      },
    }).withConfig({ runName: "loadHistory" });

    const messagesKey = fields.historyMessagesKey || fields.inputMessagesKey;
    if (messagesKey) {
      historyChain = RunnablePassthrough.assign({
        [messagesKey]: historyChain,
      }).withConfig({ runName: "insertHistory" });
    }

    const bound = historyChain
      .pipe(fields.runnable)
      .withConfig({ runName: "RunnableWithMessageHistory" });

    this.bound = bound;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _enterHistory(input: any, config: BaseCallbackConfig): Array<BaseMessage> {
    console.log("Running _enterHistory");
    const history = config.configurable?.messageHistory;

    // @TODO I think this is broken
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
    console.log("returning", returnType);
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

  _mergeConfig(...configs: Array<BaseCallbackConfig | undefined>) {
    const config = super._mergeConfig(...configs);
    // Extract sessionId
    if (!config.configurable || !config.configurable.sessionId) {
      const exampleInput = {
        [this.inputMessagesKey ?? "input"]: "foo",
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
