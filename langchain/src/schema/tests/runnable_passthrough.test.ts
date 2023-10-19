import { z } from "zod";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { FakeChatModel } from "./lib.js";
import { RunnablePassthrough } from "../runnable/passthrough.js";

test("RunnablePassthrough can call .assign and pass prev result through", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;

  const chain = promptTemplate.pipe(llm).pipe(parser);

  const chainWithAssign = chain.pipe(
    RunnablePassthrough.assign({
      outputValue: (i) => i.outputValue,
    })
  );

  const result = await chainWithAssign.invoke({ input: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing" });
});
