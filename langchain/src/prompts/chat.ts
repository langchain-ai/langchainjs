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
  InputVariableName extends string = any
> {
  abstract inputVariables: InputVariableName[];

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
  InputVariableName extends string = any
> extends BaseMessagePromptTemplate<InputVariableName> {
  variableName: InputVariableName;

  constructor(variableName: InputVariableName) {
    super();
    this.variableName = variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseChatMessage[]);
  }
}

export abstract class BaseMessageStringPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariableName extends string = any
> extends BaseMessagePromptTemplate<InputVariableName> {
  prompt: BaseStringPromptTemplate<InputVariableName, string>;

  protected constructor(
    prompt: BaseStringPromptTemplate<InputVariableName, string>
  ) {
    super();
    this.prompt = prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage>;

  async formatMessages(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariableName extends string = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<InputVariableName, PartialVariableName> {
  constructor(
    input: BasePromptTemplateInput<InputVariableName, PartialVariableName>
  ) {
    super(input);
  }

  abstract formatMessages(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage[]>;

  async format(values: InputValues<InputVariableName>): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(
    values: InputValues<InputVariableName>
  ): Promise<BasePromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export class ChatMessagePromptTemplate<
  InputVariableName extends string
> extends BaseMessageStringPromptTemplate<InputVariableName> {
  role: string;

  async format(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(
    prompt: BaseStringPromptTemplate<InputVariableName, string>,
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
  InputVariableName extends string
> extends BaseMessageStringPromptTemplate<InputVariableName> {
  async format(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage> {
    return new HumanChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableName, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class AIMessagePromptTemplate<
  InputVariableName extends string
> extends BaseMessageStringPromptTemplate<InputVariableName> {
  async format(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage> {
    return new AIChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableName, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class SystemMessagePromptTemplate<
  InputVariableName extends string
> extends BaseMessageStringPromptTemplate<InputVariableName> {
  async format(
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage> {
    return new SystemChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableName, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export interface ChatPromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputVariableName extends string = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<InputVariableName, PartialVariableName> {
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
    InputVariableName extends string = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends BaseChatPromptTemplate<InputVariableName, PartialVariableName>
  implements ChatPromptTemplateInput<InputVariableName, PartialVariableName>
{
  promptMessages: BaseMessagePromptTemplate[];

  validateTemplate = true;

  constructor(
    input: ChatPromptTemplateInput<InputVariableName, PartialVariableName>
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
          (x) => !inputVariablesMessages.has(x as InputVariableName)
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
    values: InputValues<InputVariableName>
  ): Promise<BaseChatMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseChatMessage[] = [];

    for (const promptMessage of this.promptMessages) {
      const inputValues = promptMessage.inputVariables.reduce(
        (acc, inputVariable) => {
          if (!(inputVariable in allValues)) {
            throw new Error(
              `Missing value for input variable \`${inputVariable}\``
            );
          }
          acc[inputVariable] = allValues[inputVariable as InputVariableName];
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
    ) as Exclude<InputVariableName, NewPartialVariableName>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableName | NewPartialVariableName>;
    const promptDict = {
      ...this,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables,
    };
    return new ChatPromptTemplate(promptDict);
  }

  static fromPromptMessages(
    promptMessages: (
      | BaseMessagePromptTemplate<string>
      | ChatPromptTemplate<string, string>
    )[]
  ): ChatPromptTemplate<string, string> {
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
