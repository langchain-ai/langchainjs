/* eslint-disable @typescript-eslint/no-explicit-any */
import { ZodType, ZodTypeDef } from "zod";
import { test, expect } from "@jest/globals";
import {
  StructuredOutputMethodParams,
  StructuredOutputMethodOptions,
  BaseLanguageModelInput,
} from "../../language_models/base.js";
import { BaseMessage } from "../../messages/index.js";
import { Runnable, RunnableLambda } from "../../runnables/base.js";
import { RunnableConfig } from "../../runnables/config.js";
import { FakeListChatModel } from "../../utils/testing/index.js";
import { StructuredPrompt } from "../structured.js";
import { load } from "../../load/index.js";

class FakeStructuredChatModel extends FakeListChatModel {
  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | Record<string, any>
      | StructuredOutputMethodParams<RunOutput, false>
      | ZodType<RunOutput, ZodTypeDef, RunOutput>,
    config?: StructuredOutputMethodOptions<false> | undefined
  ): Runnable<BaseLanguageModelInput, RunOutput, RunnableConfig>;

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | Record<string, any>
      | StructuredOutputMethodParams<RunOutput, true>
      | ZodType<RunOutput, ZodTypeDef, RunOutput>,
    config?: StructuredOutputMethodOptions<true> | undefined
  ): Runnable<
    BaseLanguageModelInput,
    { raw: BaseMessage; parsed: RunOutput },
    RunnableConfig
  >;

  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | Record<string, any>
      | StructuredOutputMethodParams<RunOutput, boolean>
      | ZodType<RunOutput, ZodTypeDef, RunOutput>,
    _config?: StructuredOutputMethodOptions<boolean> | undefined
  ):
    | Runnable<BaseLanguageModelInput, RunOutput, RunnableConfig>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput },
        RunnableConfig
      > {
    if (!_config?.includeRaw) {
      if (typeof _params === "object") {
        const func = RunnableLambda.from(
          (_: BaseLanguageModelInput) => _params
        );
        return func as any;
      }
    }

    throw new Error("Invalid schema");
  }
}

test("Test format", async () => {
  const schema = {
    name: "yo",
    description: "a structured output",
    parameters: {
      name: { type: "string" },
      value: { type: "integer" },
    },
  };
  const prompt = StructuredPrompt.fromMessagesAndSchema(
    [["human", "I'm very structured, how about you?"]],
    schema
  );

  const model = new FakeStructuredChatModel({ responses: [] });

  const chain = prompt.pipe(model);

  await chain.invoke({});

  await expect(chain.invoke({})).resolves.toEqual(schema);

  const revived: StructuredPrompt = await load(JSON.stringify(prompt));

  expect(JSON.stringify(prompt)).toEqual(
    '{"lc":1,"type":"constructor","id":["langchain_core","prompts","structured","StructuredPrompt"],"kwargs":{"schema_":{"name":"yo","description":"a structured output","parameters":{"name":{"type":"string"},"value":{"type":"integer"}}},"input_variables":[],"messages":[{"lc":1,"type":"constructor","id":["langchain_core","prompts","chat","HumanMessagePromptTemplate"],"kwargs":{"prompt":{"lc":1,"type":"constructor","id":["langchain_core","prompts","prompt","PromptTemplate"],"kwargs":{"input_variables":[],"template_format":"f-string","template":"I\'m very structured, how about you?","schema":{"name":"yo","description":"a structured output","parameters":{"name":{"type":"string"},"value":{"type":"integer"}}}}}}}]}}'
  );

  const revivedChain = revived.pipe(model);

  await expect(revivedChain.invoke({})).resolves.toEqual(schema);

  const boundModel = model.withConfig({ runName: "boundModel" });

  const chainWithBoundModel = prompt.pipe(boundModel);

  await expect(chainWithBoundModel.invoke({})).resolves.toEqual(schema);
});
