import { ChatMessage, Role } from "../chat_models/base.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  InputValues,
  PartialValues,
} from "./base.js";
import { TemplateFormat } from "./template.js";
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

  // TODO: add support for validation
}

export class ChatPromptTemplate
  extends BasePromptTemplate
  implements ChatPromptTemplateInput
{
  promptMessages: PromptMessage[];

  templateFormat: TemplateFormat = "f-string";

  constructor(input: ChatPromptTemplateInput) {
    super(input);
    Object.assign(this, input);
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
}
