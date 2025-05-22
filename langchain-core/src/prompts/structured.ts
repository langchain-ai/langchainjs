import { ChatPromptValueInterface } from "../prompt_values.js";
import { RunnableLike, Runnable, RunnableBinding } from "../runnables/base.js";
import { RunnableConfig } from "../runnables/config.js";
import { InputValues } from "../utils/types/index.js";
import {
  BaseMessagePromptTemplateLike,
  ChatPromptTemplate,
  ChatPromptTemplateInput,
} from "./chat.js";

function isWithStructuredOutput(
  x: unknown
  // eslint-disable-next-line @typescript-eslint/ban-types
): x is {
  withStructuredOutput: (...arg: unknown[]) => Runnable;
} {
  return (
    typeof x === "object" &&
    x != null &&
    "withStructuredOutput" in x &&
    typeof x.withStructuredOutput === "function"
  );
}

function isRunnableBinding(x: unknown): x is RunnableBinding<unknown, unknown> {
  return (
    typeof x === "object" &&
    x != null &&
    "lc_id" in x &&
    Array.isArray(x.lc_id) &&
    x.lc_id.join("/") === "langchain_core/runnables/RunnableBinding"
  );
}

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
  method?: "jsonMode" | "jsonSchema" | "functionMode";
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

  method?: "jsonMode" | "jsonSchema" | "functionMode";

  lc_namespace = ["langchain_core", "prompts", "structured"];

  get lc_aliases(): Record<string, string> {
    return {
      ...super.lc_aliases,
      schema: "schema_",
    };
  }

  constructor(input: StructuredPromptInput<RunInput, PartialVariableName>) {
    super(input);
    this.schema = input.schema;
    this.method = input.method;
  }

  pipe<NewRunOutput>(
    coerceable: RunnableLike<ChatPromptValueInterface, NewRunOutput>
  ): Runnable<RunInput, Exclude<NewRunOutput, Error>, RunnableConfig> {
    if (isWithStructuredOutput(coerceable)) {
      return super.pipe(coerceable.withStructuredOutput(this.schema));
    }

    if (
      isRunnableBinding(coerceable) &&
      isWithStructuredOutput(coerceable.bound)
    ) {
      return super.pipe(
        new RunnableBinding({
          bound: coerceable.bound.withStructuredOutput(
            this.schema,
            ...(this.method ? [{ method: this.method }] : [])
          ),
          kwargs: coerceable.kwargs ?? {},
          config: coerceable.config,
          configFactories: coerceable.configFactories,
        })
      );
    }

    throw new Error(
      `Structured prompts need to be piped to a language model that supports the "withStructuredOutput()" method.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromMessagesAndSchema<RunInput extends InputValues = any>(
    promptMessages: (
      | ChatPromptTemplate<InputValues, string>
      | BaseMessagePromptTemplateLike
    )[],
    schema: StructuredPromptInput["schema"],
    method?: "jsonMode" | "jsonSchema" | "functionMode"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): ChatPromptTemplate<RunInput, any> {
    return StructuredPrompt.fromMessages<
      RunInput,
      StructuredPromptInput<RunInput>
    >(promptMessages, { schema, method });
  }
}
