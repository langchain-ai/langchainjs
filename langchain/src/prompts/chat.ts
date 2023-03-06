import {
  BasePromptTemplate,
  BaseStringPromptTemplate,
  BasePromptTemplateInput,
  InputValues,
  PartialValues,
} from "./base.js";
import { DEFAULT_FORMATTER_MAPPING, TemplateFormat } from "./template.js";
import { SerializedOutputParser } from "./parser.js";
import {
  AIChatMessage,
  BaseChatMessage,
  BasePromptValue,
  ChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../schema/index.js";
import { PromptTemplate } from "./prompt.js";

/** Serialized Chat prompt template */
export type SerializedChatPromptTemplate = {
  _type?: "chat_prompt";
  input_variables: string[];
  output_parser?: SerializedOutputParser;
  template_format?: TemplateFormat;
  prompt_messages: BaseMessagePromptTemplate[];
};

export abstract class BaseMessagePromptTemplate {
  prompt: BaseStringPromptTemplate;

  protected constructor(prompt: BaseStringPromptTemplate) {
    this.prompt = prompt;
  }

  abstract format(values: InputValues): Promise<BaseChatMessage>;
}

export class ChatMessagePromptTemplate extends BaseMessagePromptTemplate {
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

export class HumanMessagePromptTemplate extends BaseMessagePromptTemplate {
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

export class AIMessagePromptTemplate extends BaseMessagePromptTemplate {
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

export class SystemMessagePromptTemplate extends BaseMessagePromptTemplate {
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

export interface ChatPromptTemplateInput extends BasePromptTemplateInput {
  /**
   * The prompt messages
   */
  promptMessages: BaseMessagePromptTemplate[];

  /**
   * The format of the prompt template. Options are 'f-string', 'jinja-2'
   *
   * @defaultValue 'f-string'
   */
  templateFormat?: TemplateFormat;

  /**
   * Whether to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

export class ChatPromptTemplate
  extends BasePromptTemplate
  implements ChatPromptTemplateInput
{
  promptMessages: BaseMessagePromptTemplate[];

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: ChatPromptTemplateInput) {
    super(input);
    Object.assign(this, input);

    if (this.validateTemplate) {
      if (!(this.templateFormat in DEFAULT_FORMATTER_MAPPING)) {
        const validFormats = Object.keys(DEFAULT_FORMATTER_MAPPING);
        throw new Error(`Invalid template format. Got \`${this.templateFormat}\`;
                         should be one of ${validFormats}`);
      }
      const inputVariables = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        for (const inputVariable of promptMessage.prompt.inputVariables) {
          inputVariables.add(inputVariable);
        }
      }
      const difference = new Set(
        [...this.inputVariables].filter((x) => !inputVariables.has(x))
      );
      if (difference.size > 0) {
        throw new Error(
          `Input variables \`${[
            ...difference,
          ]}\` are not used in any of the prompt messages.`
        );
      }
      const thisInputVariables = new Set(this.inputVariables);
      const otherDifference = new Set(
        [...inputVariables].filter((x) => !thisInputVariables.has(x))
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

  async format(values: InputValues): Promise<string> {
    return (await this.formatPromptValue(values)).toString();
  }

  async formatPromptValue(values: InputValues): Promise<BasePromptValue> {
    const resultMessages: BaseChatMessage[] = [];
    for (const promptMessage of this.promptMessages) {
      const inputValues: InputValues = {};
      for (const inputVariable of promptMessage.prompt.inputVariables) {
        if (!(inputVariable in values)) {
          throw new Error(
            `Missing value for input variable \`${inputVariable}\``
          );
        }
        inputValues[inputVariable] = values[inputVariable];
      }
      const message = await promptMessage.format(inputValues);
      resultMessages.push(message);
    }
    return new ChatPromptValue(resultMessages);
  }

  serialize(): SerializedChatPromptTemplate {
    return {
      input_variables: this.inputVariables,
      output_parser: this.outputParser?.serialize(),
      template_format: this.templateFormat,
      prompt_messages: this.promptMessages,
    };
  }

  async partial(_: PartialValues): Promise<BasePromptTemplate> {
    throw new Error("ChatPromptTemplate.partial() not yet implemented");
  }

  static fromPromptMessages(
    promptMessages: BaseMessagePromptTemplate[]
  ): ChatPromptTemplate {
    const inputVariables = new Set<string>();
    for (const promptMessage of promptMessages) {
      for (const inputVariable of promptMessage.prompt.inputVariables) {
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate({
      inputVariables: [...inputVariables],
      promptMessages,
    });
  }
}
