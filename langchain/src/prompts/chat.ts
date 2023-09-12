// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import { BaseCallbackConfig } from "../callbacks/manager.js";
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  BasePromptValue,
  ChatMessage,
  HumanMessage,
  InputValues,
  PartialValues,
  SystemMessage,
  coerceMessageLikeToMessage,
  isBaseMessage,
} from "../schema/index.js";
import { Runnable } from "../schema/runnable/index.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  BaseStringPromptTemplate,
  TypedPromptInputValues,
} from "./base.js";
import { PromptTemplate } from "./prompt.js";

/**
 * Abstract class that serves as a base for creating message prompt
 * templates. It defines how to format messages for different roles in a
 * conversation.
 */
export abstract class BaseMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  RunOutput extends BaseMessage[] = BaseMessage[]
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "prompts", "chat"];

  lc_serializable = true;

  abstract inputVariables: Array<Extract<keyof RunInput, string>>;

  /**
   * Method that takes an object of TypedPromptInputValues and returns a
   * promise that resolves to an array of BaseMessage instances.
   * @param values Object of TypedPromptInputValues
   * @returns Formatted array of BaseMessages
   */
  abstract formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<RunOutput>;

  /**
   * Calls the formatMessages method with the provided input and options.
   * @param input Input for the formatMessages method
   * @param options Optional BaseCallbackConfig
   * @returns Formatted output messages
   */
  async invoke(
    input: RunInput,
    options?: BaseCallbackConfig
  ): Promise<RunOutput> {
    return this._callWithConfig(
      (input: RunInput) => this.formatMessages(input),
      input,
      { ...options, runType: "prompt" }
    );
  }
}

/**
 * Interface for the fields of a ChatPromptValue.
 */
export interface ChatPromptValueFields {
  messages: BaseMessage[];
}

/**
 * Class that represents a chat prompt value. It extends the
 * BasePromptValue and includes an array of BaseMessage instances.
 */
export class ChatPromptValue extends BasePromptValue {
  lc_namespace = ["langchain", "prompts", "chat"];

  lc_serializable = true;

  static lc_name() {
    return "ChatPromptValue";
  }

  messages: BaseMessage[];

  constructor(messages: BaseMessage[]);

  constructor(fields: ChatPromptValueFields);

  constructor(fields: BaseMessage[] | ChatPromptValueFields) {
    if (Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { messages: fields };
    }

    super(...arguments);
    this.messages = fields.messages;
  }

  toString() {
    return JSON.stringify(this.messages);
  }

  toChatMessages() {
    return this.messages;
  }
}

/**
 * Interface for the fields of a MessagePlaceholder.
 */
export interface MessagePlaceholderFields<T extends string> {
  variableName: T;
}

/**
 * Class that represents a placeholder for messages in a chat prompt. It
 * extends the BaseMessagePromptTemplate.
 */
export class MessagesPlaceholder<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessagePromptTemplate<RunInput> {
  static lc_name() {
    return "MessagesPlaceholder";
  }

  variableName: Extract<keyof RunInput, string>;

  constructor(variableName: Extract<keyof RunInput, string>);

  constructor(
    fields: MessagePlaceholderFields<Extract<keyof RunInput, string>>
  );

  constructor(
    fields:
      | Extract<keyof RunInput, string>
      | MessagePlaceholderFields<Extract<keyof RunInput, string>>
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign
      fields = { variableName: fields };
    }
    super(fields);
    this.variableName = fields.variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseMessage[]);
  }
}

/**
 * Interface for the fields of a MessageStringPromptTemplate.
 */
export interface MessageStringPromptTemplateFields<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends InputValues = any
> {
  prompt: BaseStringPromptTemplate<T, string>;
}

/**
 * Abstract class that serves as a base for creating message string prompt
 * templates. It extends the BaseMessagePromptTemplate.
 */
export abstract class BaseMessageStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessagePromptTemplate<RunInput> {
  prompt: BaseStringPromptTemplate<
    InputValues<Extract<keyof RunInput, string>>,
    string
  >;

  constructor(
    prompt: BaseStringPromptTemplate<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields: MessageStringPromptTemplateFields<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields:
      | MessageStringPromptTemplateFields<
          InputValues<Extract<keyof RunInput, string>>
        >
      | BaseStringPromptTemplate<
          InputValues<Extract<keyof RunInput, string>>,
          string
        >
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { prompt: fields };
    }
    super(fields);
    this.prompt = fields.prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage>;

  async formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    return [await this.format(values)];
  }
}

/**
 * Abstract class that serves as a base for creating chat prompt
 * templates. It extends the BasePromptTemplate.
 */
export abstract class BaseChatPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<RunInput, ChatPromptValue, PartialVariableName> {
  constructor(input: BasePromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
  }

  abstract formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]>;

  async format(values: TypedPromptInputValues<RunInput>): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<ChatPromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

/**
 * Interface for the fields of a ChatMessagePromptTemplate.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ChatMessagePromptTemplateFields<T extends InputValues = any>
  extends MessageStringPromptTemplateFields<T> {
  role: string;
}

/**
 * Class that represents a chat message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class ChatMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessageStringPromptTemplate<RunInput> {
  static lc_name() {
    return "ChatMessagePromptTemplate";
  }

  role: string;

  constructor(
    prompt: BaseStringPromptTemplate<
      InputValues<Extract<keyof RunInput, string>>
    >,
    role: string
  );

  constructor(
    fields: ChatMessagePromptTemplateFields<
      InputValues<Extract<keyof RunInput, string>>
    >
  );

  constructor(
    fields:
      | ChatMessagePromptTemplateFields<
          InputValues<Extract<keyof RunInput, string>>
        >
      | BaseStringPromptTemplate<InputValues<Extract<keyof RunInput, string>>>,
    role?: string
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { prompt: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  async format(values: RunInput): Promise<BaseMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  static fromTemplate(template: string, role: string) {
    return new this(PromptTemplate.fromTemplate(template), role);
  }
}

/**
 * Class that represents a human message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class HumanMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessageStringPromptTemplate<RunInput> {
  static lc_name() {
    return "HumanMessagePromptTemplate";
  }

  async format(values: RunInput): Promise<BaseMessage> {
    return new HumanMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

/**
 * Class that represents an AI message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class AIMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessageStringPromptTemplate<RunInput> {
  static lc_name() {
    return "AIMessagePromptTemplate";
  }

  async format(values: RunInput): Promise<BaseMessage> {
    return new AIMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

/**
 * Class that represents a system message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
export class SystemMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any
> extends BaseMessageStringPromptTemplate<RunInput> {
  static lc_name() {
    return "SystemMessagePromptTemplate";
  }

  async format(values: RunInput): Promise<BaseMessage> {
    return new SystemMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

/**
 * Interface for the input of a ChatPromptTemplate.
 */
export interface ChatPromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<RunInput, PartialVariableName> {
  /**
   * The prompt messages
   */
  promptMessages: Array<BaseMessagePromptTemplate | BaseMessage>;

  /**
   * Whether to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

export type BaseMessagePromptTemplateLike =
  | BaseMessagePromptTemplate
  | BaseMessageLike;

function _isBaseMessagePromptTemplate(
  baseMessagePromptTemplateLike: BaseMessagePromptTemplateLike
): baseMessagePromptTemplateLike is BaseMessagePromptTemplate {
  return (
    typeof (baseMessagePromptTemplateLike as BaseMessagePromptTemplate)
      .formatMessages === "function"
  );
}

function _coerceMessagePromptTemplateLike(
  messagePromptTemplateLike: BaseMessagePromptTemplateLike
): BaseMessagePromptTemplate | BaseMessage {
  if (
    _isBaseMessagePromptTemplate(messagePromptTemplateLike) ||
    isBaseMessage(messagePromptTemplateLike)
  ) {
    return messagePromptTemplateLike;
  }
  const message = coerceMessageLikeToMessage(messagePromptTemplateLike);
  if (message._getType() === "human") {
    return HumanMessagePromptTemplate.fromTemplate(message.content);
  } else if (message._getType() === "ai") {
    return AIMessagePromptTemplate.fromTemplate(message.content);
  } else if (message._getType() === "system") {
    return SystemMessagePromptTemplate.fromTemplate(message.content);
  } else if (ChatMessage.isInstance(message)) {
    return ChatMessagePromptTemplate.fromTemplate(
      message.content,
      message.role
    );
  } else {
    throw new Error(
      `Could not coerce message prompt template from input. Received message type: "${message._getType()}".`
    );
  }
}

/**
 * Class that represents a chat prompt. It extends the
 * BaseChatPromptTemplate and uses an array of BaseMessagePromptTemplate
 * instances to format a series of messages for a conversation.
 */
export class ChatPromptTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends BaseChatPromptTemplate<RunInput, PartialVariableName>
  implements ChatPromptTemplateInput<RunInput, PartialVariableName>
{
  static lc_name() {
    return "ChatPromptTemplate";
  }

  get lc_aliases() {
    return {
      promptMessages: "messages",
    };
  }

  promptMessages: Array<BaseMessagePromptTemplate | BaseMessage>;

  validateTemplate = true;

  constructor(input: ChatPromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (promptMessage instanceof BaseMessage) continue;
        for (const inputVariable of promptMessage.inputVariables) {
          inputVariablesMessages.add(inputVariable);
        }
      }

      const totalInputVariables = this.inputVariables as string[];
      const inputVariablesInstance = new Set(
        this.partialVariables
          ? totalInputVariables.concat(Object.keys(this.partialVariables))
          : totalInputVariables
      );
      const difference = new Set(
        [...inputVariablesInstance].filter(
          (x) => !inputVariablesMessages.has(x)
        )
      );
      if (difference.size > 0) {
        throw new Error(
          `Input variables \`${[
            ...difference,
          ]}\` are not used in any of the prompt messages.`
        );
      }
      const otherDifference = new Set(
        [...inputVariablesMessages].filter(
          (x) => !inputVariablesInstance.has(x)
        )
      );
      if (otherDifference.size > 0) {
        throw new Error(
          `Input variables \`${[
            ...otherDifference,
          ]}\` are used in prompt messages but not in the prompt template.`
        );
      }
    }
  }

  _getPromptType(): "chat" {
    return "chat";
  }

  async formatMessages(
    values: TypedPromptInputValues<RunInput>
  ): Promise<BaseMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseMessage[] = [];

    for (const promptMessage of this.promptMessages) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (promptMessage instanceof BaseMessage) {
        resultMessages.push(promptMessage);
      } else {
        const inputValues = promptMessage.inputVariables.reduce(
          (acc, inputVariable) => {
            if (!(inputVariable in allValues)) {
              throw new Error(
                `Missing value for input variable \`${inputVariable.toString()}\``
              );
            }
            acc[inputVariable] = allValues[inputVariable];
            return acc;
          },
          {} as InputValues
        );
        const message = await promptMessage.formatMessages(inputValues);
        resultMessages = resultMessages.concat(message);
      }
    }
    return resultMessages;
  }

  async partial<NewPartialVariableName extends string>(
    values: PartialValues<NewPartialVariableName>
  ) {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableName | NewPartialVariableName>;
    const promptDict = {
      ...this,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables,
    };
    return new ChatPromptTemplate<
      InputValues<
        Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromPromptMessages<RunInput extends InputValues = any>(
    promptMessages: (
      | ChatPromptTemplate<InputValues, string>
      | BaseMessagePromptTemplateLike
    )[]
  ): ChatPromptTemplate<RunInput> {
    const flattenedMessages = promptMessages.reduce(
      (acc: Array<BaseMessagePromptTemplate | BaseMessage>, promptMessage) =>
        acc.concat(
          // eslint-disable-next-line no-instanceof/no-instanceof
          promptMessage instanceof ChatPromptTemplate
            ? promptMessage.promptMessages
            : [_coerceMessagePromptTemplateLike(promptMessage)]
        ),
      []
    );
    const flattenedPartialVariables = promptMessages.reduce(
      (acc, promptMessage) =>
        // eslint-disable-next-line no-instanceof/no-instanceof
        promptMessage instanceof ChatPromptTemplate
          ? Object.assign(acc, promptMessage.partialVariables)
          : acc,
      Object.create(null) as PartialValues
    );

    const inputVariables = new Set<string>();
    for (const promptMessage of flattenedMessages) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (promptMessage instanceof BaseMessage) continue;
      for (const inputVariable of promptMessage.inputVariables) {
        if (inputVariable in flattenedPartialVariables) {
          continue;
        }
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate<RunInput>({
      inputVariables: [...inputVariables] as Extract<keyof RunInput, string>[],
      promptMessages: flattenedMessages,
      partialVariables: flattenedPartialVariables,
    });
  }
}
