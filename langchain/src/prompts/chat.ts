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

export abstract class BaseMessagePromptTemplate<InputVariableNames extends string = string> {
  abstract inputVariables: InputVariableNames[];

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

export class MessagesPlaceholder<InputVariableNames extends string = string> extends BaseMessagePromptTemplate<InputVariableNames> {
  variableName: InputVariableNames;

  constructor(variableName: InputVariableNames) {
    super();
    this.variableName = variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(values: InputValues<InputVariableNames>): Promise<BaseChatMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseChatMessage[]);
  }
}

export abstract class BaseMessageStringPromptTemplate<InputVariableNames extends string = string> extends BaseMessagePromptTemplate<InputVariableNames> {
  prompt: BaseStringPromptTemplate<InputVariableNames, string>;

  protected constructor(prompt: BaseStringPromptTemplate<InputVariableNames, string>) {
    super();
    this.prompt = prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(values:InputValues<InputVariableNames>): Promise<BaseChatMessage>;

  async formatMessages(values:InputValues<InputVariableNames>): Promise<BaseChatMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate<InputVariableNames extends string = string, PartialVariableNames extends string = string> extends BasePromptTemplate<InputVariableNames, PartialVariableNames> {
  constructor(input: BasePromptTemplateInput<InputVariableNames, PartialVariableNames>) {
    super(input);
  }

  abstract formatMessages(values: InputValues<InputVariableNames>): Promise<BaseChatMessage[]>;

  async format(values: InputValues<InputVariableNames>): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(values: InputValues<InputVariableNames>): Promise<BasePromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export class ChatMessagePromptTemplate<InputVariableNames extends string> extends BaseMessageStringPromptTemplate<InputVariableNames> {
  role: string;

  async format(values: InputValues<InputVariableNames>): Promise<BaseChatMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableNames, string>, role: string) {
    super(prompt);
    this.role = role;
  }

  static fromTemplate(template: string, role: string) {
    return new this(PromptTemplate.fromTemplate(template), role);
  }
}

export class HumanMessagePromptTemplate<InputVariableNames extends string> extends BaseMessageStringPromptTemplate<InputVariableNames> {
  async format(values: InputValues<InputVariableNames>): Promise<BaseChatMessage> {
    return new HumanChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableNames, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class AIMessagePromptTemplate<InputVariableNames extends string> extends BaseMessageStringPromptTemplate<InputVariableNames> {
  async format(values: InputValues<InputVariableNames>): Promise<BaseChatMessage> {
    return new AIChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableNames, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class SystemMessagePromptTemplate<InputVariableNames extends string> extends BaseMessageStringPromptTemplate<InputVariableNames> {
  async format(values: InputValues<InputVariableNames>): Promise<BaseChatMessage> {
    return new SystemChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate<InputVariableNames, string>) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export interface ChatPromptTemplateInput<InputVariableNames extends string = string, PartialVariableNames extends string = string> extends BasePromptTemplateInput<InputVariableNames, PartialVariableNames> {
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

export class ChatPromptTemplate<InputVariableNames extends string = string, PartialVariableNames extends string = string>
  extends BaseChatPromptTemplate<InputVariableNames, PartialVariableNames>
  implements ChatPromptTemplateInput<InputVariableNames, PartialVariableNames>
{
  promptMessages: BaseMessagePromptTemplate[];

  validateTemplate = true;

  constructor(input: ChatPromptTemplateInput<InputVariableNames, PartialVariableNames>) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        for (const inputVariable of promptMessage.inputVariables) {
          inputVariablesMessages.add(inputVariable);
        }
      }

      let totalInputVariables = this.inputVariables as string[];
      const inputVariablesInstance = new Set(
        this.partialVariables
          ? totalInputVariables.concat(Object.keys(this.partialVariables))
          : totalInputVariables
      );
      const difference = new Set(
        [...inputVariablesInstance].filter(
          (x) => !inputVariablesMessages.has(x as InputVariableNames)
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

  async formatMessages(values: InputValues<InputVariableNames>): Promise<BaseChatMessage[]> {
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
          acc[inputVariable] = allValues[inputVariable as InputVariableNames];
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

  async partial<NewPartialNames extends string>(values: PartialValues<NewPartialNames>) {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<InputVariableNames, NewPartialNames>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableNames | NewPartialNames>;
    const promptDict = { ...this, inputVariables: newInputVariables, partialVariables: newPartialVariables };
    return new ChatPromptTemplate(promptDict);
  }

  static fromPromptMessages(
    promptMessages: (BaseMessagePromptTemplate<string> | ChatPromptTemplate<string, string>)[]
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
