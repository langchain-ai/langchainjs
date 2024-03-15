import { ChatPromptValueInterface } from "../prompt_values.js";
import { RunnableLike, Runnable } from "../runnables/base.js";
import { RunnableConfig } from "../runnables/config.js";
import { InputValues } from "../utils/types.js";
import {
  BaseMessagePromptTemplateLike,
  ChatPromptTemplate,
  ChatPromptTemplateInput,
} from "./chat.js";

/**
 * Interface for the input of a ChatPromptTemplate.
 */
export interface StructuredPromptInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends ChatPromptTemplateInput<RunInput, PartialVariableName> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>;
}

export class StructuredPrompt<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends InputValues = any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PartialVariableName extends string = any
  >
  extends ChatPromptTemplate<RunInput, PartialVariableName>
  implements StructuredPromptInput<RunInput, PartialVariableName>
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>;

  get lc_aliases(): Record<string, string> {
    return {
      ...super.lc_aliases,
      schema: "schema_",
    };
  }

  constructor(input: StructuredPromptInput<RunInput, PartialVariableName>) {
    super(input);
    this.schema = input.schema;
  }

  pipe<NewRunOutput>(
    coerceable: RunnableLike<ChatPromptValueInterface, NewRunOutput>
  ): Runnable<RunInput, Exclude<NewRunOutput, Error>, RunnableConfig> {
    if (
      typeof coerceable === "object" &&
      "withStructuredOutput" in coerceable &&
      typeof coerceable.withStructuredOutput === "function"
    ) {
      return super.pipe(coerceable.withStructuredOutput(this.schema));
    } else {
      throw new Error(
        `Structured prompts need to be piped to a language model that supports the "withStructuredOutput()" method.`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromMessagesAndSchema<RunInput extends InputValues = any>(
    promptMessages: (
      | ChatPromptTemplate<InputValues, string>
      | BaseMessagePromptTemplateLike
    )[],
    schema: StructuredPromptInput["schema"]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): ChatPromptTemplate<RunInput, any> {
    return StructuredPrompt.fromMessages<
      RunInput,
      StructuredPromptInput<RunInput>
    >(promptMessages, { schema });
  }
}
