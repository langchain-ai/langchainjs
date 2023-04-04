import {
  BasePromptTemplate,
  BaseStringPromptTemplate,
  BasePromptTemplateInput,
} from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
  InputValues,
  PartialValues,
} from "../schema/index.js";
import { PromptTemplate } from "./prompt.js";
import {
  SerializedChatPromptTemplate,
  SerializedMessagePromptTemplate,
} from "./serde.js";

export abstract class BaseMessagePromptTemplate {
  abstract inputVariables: string[];

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

export class MessagesPlaceholder extends BaseMessagePromptTemplate {
  variableName: string;

  constructor(variableName: string) {
    super();
    this.variableName = variableName;
  }

  get inputVariables() {
    return [this.variableName];
  }

  formatMessages(values: InputValues): Promise<BaseChatMessage[]> {
    return Promise.resolve(values[this.variableName] as BaseChatMessage[]);
  }
}

export abstract class BaseMessageStringPromptTemplate extends BaseMessagePromptTemplate {
  prompt: BaseStringPromptTemplate;

  protected constructor(prompt: BaseStringPromptTemplate) {
    super();
    this.prompt = prompt;
  }

  get inputVariables() {
    return this.prompt.inputVariables;
  }

  abstract format(values: InputValues): Promise<BaseChatMessage>;

  async formatMessages(values: InputValues): Promise<BaseChatMessage[]> {
    return [await this.format(values)];
  }
}

export abstract class BaseChatPromptTemplate extends BasePromptTemplate {
  constructor(input: BasePromptTemplateInput) {
    super(input);
  }

  abstract formatMessages(values: InputValues): Promise<BaseChatMessage[]>;

  async format(values: InputValues): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(values: InputValues): Promise<BasePromptValue> {
    const resultMessages = await this.formatMessages(values);
    return new ChatPromptValue(resultMessages);
  }
}

export class ChatMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  role: string;

  async format(values: InputValues): Promise<BaseChatMessage> {
    return new ChatMessage(await this.prompt.format(values), this.role);
  }

  constructor(prompt: BaseStringPromptTemplate, role: string) {
    super(prompt);
    this.role = role;
  }

  static fromTemplate(template: string, role: string) {
    return new this(PromptTemplate.fromTemplate(template), role);
  }
}

export class HumanMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseChatMessage> {
    return new HumanChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class AIMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseChatMessage> {
    return new AIChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate) {
    super(prompt);
  }

  static fromTemplate(template: string) {
    return new this(PromptTemplate.fromTemplate(template));
  }
}

export class SystemMessagePromptTemplate extends BaseMessageStringPromptTemplate {
  async format(values: InputValues): Promise<BaseChatMessage> {
    return new SystemChatMessage(await this.prompt.format(values));
  }

  constructor(prompt: BaseStringPromptTemplate) {
    super(prompt);
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

  async formatMessages(values: InputValues): Promise<BaseChatMessage[]> {
    const allValues = await this.mergePartialAndUserVariables(values);

    let resultMessages: BaseChatMessage[] = [];
    for (const promptMessage of this.promptMessages) {
      const inputValues: InputValues = {};
      for (const inputVariable of promptMessage.inputVariables) {
        if (!(inputVariable in allValues)) {
          throw new Error(
            `Missing value for input variable \`${inputVariable}\``
          );
        }
        inputValues[inputVariable] = allValues[inputVariable];
      }
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

  async partial(values: PartialValues): Promise<BasePromptTemplate> {
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
    promptMessages: BaseMessagePromptTemplate[]
  ): ChatPromptTemplate {
    const inputVariables = new Set<string>();
    for (const promptMessage of promptMessages) {
      for (const inputVariable of promptMessage.inputVariables) {
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate({
      inputVariables: [...inputVariables],
      promptMessages,
    });
  }
}
