import { ChatMessage, Role } from "../chat_models/base.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  InputValues,
  PartialValues,
} from "./base.js";
import { DEFAULT_FORMATTER_MAPPING, TemplateFormat } from "./template.js";
import { SerializedPromptTemplate } from "./prompt.js";

export type PromptMessage = {
  role: Role;
  message: BasePromptTemplate;
};

export interface ChatPromptTemplateInput extends BasePromptTemplateInput {
  /**
   * The prompt messages
   */
  promptMessages: PromptMessage[];

  /**
   * The format of the prompt template. Options are 'f-string', 'jinja-2'
   *
   * @defaultValue 'f-string'
   */
  templateFormat?: TemplateFormat;

  /**
   * Whether or not to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

export class ChatPromptTemplate
  extends BasePromptTemplate
  implements ChatPromptTemplateInput
{
  promptMessages: PromptMessage[];

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
      // create a set of all input variables from all prompt messages
      const inputVariables = new Set<string>();
      for (const promptMessage of this.promptMessages) {
        for (const inputVariable of promptMessage.message.inputVariables) {
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
    const messages = await this.formatChat(values);
    return JSON.stringify(messages);
  }

  async formatChat(values: InputValues): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    for (const promptMessage of this.promptMessages) {
      const inputValues: InputValues = {};
      for (const inputVariable of promptMessage.message.inputVariables) {
        if (!(inputVariable in values)) {
          throw new Error(
            `Missing value for input variable \`${inputVariable}\``
          );
        }
        inputValues[inputVariable] = values[inputVariable];
      }
      const message = await promptMessage.message.format(inputValues);
      messages.push({
        role: promptMessage.role,
        text: message,
      });
    }
    return messages;
  }

  serialize(): SerializedPromptTemplate {
    throw new Error("ChatPromptTemplate.serialize() not yet implemented");
  }

  async partial(_: PartialValues): Promise<BasePromptTemplate> {
    throw new Error("ChatPromptTemplate.partial() not yet implemented");
  }

  static fromPromptMessages(
    promptMessages: PromptMessage[]
  ): ChatPromptTemplate {
    const inputVariables = new Set<string>();
    for (const promptMessage of promptMessages) {
      for (const inputVariable of promptMessage.message.inputVariables) {
        inputVariables.add(inputVariable);
      }
    }
    return new ChatPromptTemplate({
      inputVariables: [...inputVariables],
      promptMessages,
    });
  }
}
