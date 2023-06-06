// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.

import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatMessage,
  HumanChatMessage,
  InputValues,
  PartialValues,
  SystemChatMessage,
} from "../schema/index.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  BaseStringPromptTemplate,
} from "./base.js";
import { PromptTemplate } from "./prompt.js";
import {
  SerializedChatPromptTemplate,
  SerializedMessagePromptTemplate,
} from "./serde.js";

export abstract class BaseMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> {
  abstract inputVariables: Array<Extract<keyof InputVariables, string>>;

  abstract formatMessages(values: InputValues): Promise<BaseChatMessage[]>;

  serialize(): SerializedMessagePromptTemplate {
    return {
      _type: this.constructor.name,
      ...JSON.parse(JSON.stringify(this)),
    };
  }
}

export class ChatPromptValue extends BasePromptValue {
  messages: BaseChatMessage[];

  constructor(messages: BaseChatMessage[]) {
    super();
    this.messages = messages;
  }

  toString() {
    return JSON.stringify(this.messages);
  }

  toChatMessages() {
    return this.messages;
  }
}

export class MessagesPlaceholder<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessagePromptTemplate<InputVariables> {
  variableName: Extract<keyof InputVariables, string>;

  constructor(variableName: Extract<keyof InputVariables, string>) {
    super();
    this.variableName = variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseChatMessage[]);
  }
}

export abstract class BaseMessageStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessagePromptTemplate<InputVariables> {
  prompt: BaseStringPromptTemplate<InputVariables, string>;

  protected constructor(
    prompt: BaseStringPromptTemplate<InputVariables, string>
  ) {
    super();
    this.prompt = prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage>;

  async formatMessages(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<InputVariables, PartialVariableName> {
  constructor(
    input: BasePromptTemplateInput<InputVariables, PartialVariableName>
  ) {
    super(input);
  }

  abstract formatMessages(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage[]>;

  async format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BasePromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export class ChatMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessageStringPromptTemplate<InputVariables> {
  role: string;

  async format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(
    prompt: BaseStringPromptTemplate<InputVariables, string>,
    role: string
  ) {
    super(prompt);
    this.role = role;
  }

  static fromTemplate(template: string, role: string) {
    return new this(PromptTemplate.fromTemplate(template), role);
  }
}

export class HumanMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessageStringPromptTemplate<InputVariables> {
  async format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage> {
    return new HumanChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariables, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class AIMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessageStringPromptTemplate<InputVariables> {
  async format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage> {
    return new AIChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariables, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class SystemMessagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any
> extends BaseMessageStringPromptTemplate<InputVariables> {
  async format(
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage> {
    return new SystemChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariables, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export interface ChatPromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariables extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<InputVariables, PartialVariableName> {
  /**
   * The prompt messages
   */
  promptMessages: BaseMessagePromptTemplate[];

  /**
   * Whether to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

export class ChatPromptTemplate<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    InputVariables extends InputValues = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends BaseChatPromptTemplate<InputVariables, PartialVariableName>
  implements ChatPromptTemplateInput<InputVariables, PartialVariableName>
{
  promptMessages: BaseMessagePromptTemplate[];

  validateTemplate = true;

  constructor(
    input: ChatPromptTemplateInput<InputVariables, PartialVariableName>
  ) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
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
    values: InputValues<Extract<keyof InputVariables, string>>
  ): Promise<BaseChatMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseChatMessage[] = [];

    for (const promptMessage of this.promptMessages) {
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
    return resultMessages;
  }

  serialize(): SerializedChatPromptTemplate {
    if (this.outputParser !== undefined) {
      throw new Error(
        "ChatPromptTemplate cannot be serialized if outputParser is set"
      );
    }
    return {
      input_variables: this.inputVariables,
      prompt_messages: this.promptMessages.map((m) => m.serialize()),
    };
  }

  async partial<NewPartialVariableName extends string>(
    values: PartialValues<NewPartialVariableName>
  ) {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<
      Extract<keyof InputVariables, string>,
      NewPartialVariableName
    >[];
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
        Exclude<Extract<keyof InputVariables, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  static fromPromptMessages(
    promptMessages: (
      | BaseMessagePromptTemplate<InputValues>
      | ChatPromptTemplate<InputValues, string>
    )[]
  ): ChatPromptTemplate {
    const flattenedMessages = promptMessages.reduce(
      (acc, promptMessage) =>
        acc.concat(
          // eslint-disable-next-line no-instanceof/no-instanceof
          promptMessage instanceof ChatPromptTemplate
            ? promptMessage.promptMessages
            : [promptMessage]
        ),
      [] as BaseMessagePromptTemplate[]
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
      for (const inputVariable of promptMessage.inputVariables) {
        if (inputVariable in flattenedPartialVariables) {
          continue;
        }
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate({
      inputVariables: [...inputVariables],
      promptMessages: flattenedMessages,
      partialVariables: flattenedPartialVariables,
    });
  }
}
