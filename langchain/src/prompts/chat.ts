import {
  AIMessage,
  BaseMessage,
  BasePromptValue,
  ChatMessage,
  HumanMessage,
  InputValues,
  PartialValues,
  SystemMessage,
} from "../schema/index.js";
import { Serializable } from "../load/serializable.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  BaseStringPromptTemplate,
} from "./base.js";
import { PromptTemplate } from "./prompt.js";

export abstract class BaseMessagePromptTemplate extends Serializable {
  lc_namespace = ["langchain", "prompts", "chat"];

  lc_serializable = true;

  abstract inputVariables: string[];

  abstract formatMessages(values: InputValues): Promise<BaseMessage[]>;
}

export interface ChatPromptValueFields {
  messages: BaseMessage[];
}

export class ChatPromptValue extends BasePromptValue {
  lc_namespace = ["langchain", "prompts", "chat"];

  lc_serializable = true;

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

export interface MessagePlaceholderFields {
  variableName: string;
}

export class MessagesPlaceholder extends BaseMessagePromptTemplate {
  variableName: string;

  constructor(variableName: string);

  constructor(fields: MessagePlaceholderFields);

  constructor(fields: string | MessagePlaceholderFields) {
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

  formatMessages(values: InputValues): Promise<BaseMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseMessage[]);
  }
}

export interface MessageStringPromptTemplateFields {
  prompt: BaseStringPromptTemplate;
}

export abstract class BaseMessageStringPromptTemplate extends BaseMessagePromptTemplate {
  prompt: BaseStringPromptTemplate;

  constructor(prompt: BaseStringPromptTemplate);

  constructor(fields: MessageStringPromptTemplateFields);

  constructor(
    fields: MessageStringPromptTemplateFields | BaseStringPromptTemplate
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

  abstract format(values: InputValues): Promise<BaseMessage>;

  async formatMessages(values: InputValues): Promise<BaseMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate extends BasePromptTemplate<ChatPromptValue> {
  constructor(input: BasePromptTemplateInput) {
    super(input);
  }

  abstract formatMessages(values: InputValues): Promise<BaseMessage[]>;

  async format(values: InputValues): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(values: InputValues): Promise<ChatPromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export interface ChatMessagePromptTemplateFields
  extends MessageStringPromptTemplateFields {
  role: string;
}

export class ChatMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  role: string;

  async format(values: InputValues): Promise<BaseMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(prompt: BaseStringPromptTemplate, role: string);

  constructor(fields: ChatMessagePromptTemplateFields);

  constructor(
    fields: ChatMessagePromptTemplateFields | BaseStringPromptTemplate,
    role?: string
  ) {
    if (!("prompt" in fields)) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { prompt: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  static fromTemplate(template: string, role: string) {
    return new this(PromptTemplate.fromTemplate(template), role);
  }
}

export class HumanMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseMessage> {
    return new HumanMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class AIMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseMessage> {
    return new AIMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class SystemMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseMessage> {
    return new SystemMessage(await this.prompt.format(values));
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export interface ChatPromptTemplateInput extends BasePromptTemplateInput {
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

export class ChatPromptTemplate
  extends BaseChatPromptTemplate
  implements ChatPromptTemplateInput
{
  get lc_aliases() {
    return {
      promptMessages: "messages",
    };
  }

  promptMessages: BaseMessagePromptTemplate[];

  validateTemplate = true;

  constructor(input: ChatPromptTemplateInput) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      const inputVariablesMessages = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        for (const inputVariable of promptMessage.inputVariables) {
          inputVariablesMessages.add(inputVariable);
        }
      }
      const inputVariablesInstance = new Set(
        this.partialVariables
          ? this.inputVariables.concat(Object.keys(this.partialVariables))
          : this.inputVariables
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

  async formatMessages(values: InputValues): Promise<BaseMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseMessage[] = [];

    for (const promptMessage of this.promptMessages) {
      const inputValues = promptMessage.inputVariables.reduce(
        (acc, inputVariable) => {
          if (!(inputVariable in allValues)) {
            throw new Error(
              `Missing value for input variable \`${inputVariable}\``
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

  async partial(values: PartialValues): Promise<ChatPromptTemplate> {
    // This is implemented in a way it doesn't require making
    // BaseMessagePromptTemplate aware of .partial()
    const promptDict: ChatPromptTemplateInput = { ...this };
    promptDict.inputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    );
    promptDict.partialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    };
    return new ChatPromptTemplate(promptDict);
  }

  static fromPromptMessages(
    promptMessages: (BaseMessagePromptTemplate | ChatPromptTemplate)[]
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
