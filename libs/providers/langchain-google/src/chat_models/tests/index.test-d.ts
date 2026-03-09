import { describe, it, expectTypeOf } from "vitest";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { type BaseMessage } from "@langchain/core/messages";
import { ChatGoogle } from "../index.js";
import { z } from "zod";

describe("ChatGoogle withStructuredOutput type narrowing", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });
  type Person = z.infer<typeof schema>;

  const model = new ChatGoogle({
    model: "gemini-2.5-flash",
  });

  it("narrows to parsed output when includeRaw is false", () => {
    const structured = model.withStructuredOutput(schema, {
      includeRaw: false,
    });

    type StructuredOutput = Awaited<ReturnType<typeof structured.invoke>>;
    expectTypeOf<StructuredOutput>().toEqualTypeOf<Person>();
  });

  it("narrows to raw and parsed output when includeRaw is true", () => {
    const structured = model.withStructuredOutput(schema, {
      includeRaw: true,
    });

    type StructuredOutput = Awaited<ReturnType<typeof structured.invoke>>;
    expectTypeOf<StructuredOutput>().toEqualTypeOf<{
      raw: BaseMessage;
      parsed: Person;
    }>();
  });

  it("allows prompt.pipe() with parsed structured output", () => {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "Extract structured data from the text."],
      ["human", "{input}"],
    ]);
    const structured = model.withStructuredOutput(schema, {
      includeRaw: false,
    });

    const chain = prompt.pipe(structured);

    type ChainOutput = Awaited<ReturnType<typeof chain.invoke>>;
    expectTypeOf<ChainOutput>().toEqualTypeOf<Person>();
  });
});
