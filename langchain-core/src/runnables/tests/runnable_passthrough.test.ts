import { PromptTemplate } from "../../prompts/prompt.js";
import { FakeChatModel } from "../../utils/testing/index.js";
import { RunnablePassthrough } from "../passthrough.js";
import { JsonOutputParser } from "../../output_parsers/json.js";
import { RunnableSequence } from "../base.js";

test("RunnablePassthrough can call .assign and pass prev result through", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = new JsonOutputParser();
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

test("RunnablePassthrough can call .assign as the first step with proper typing", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = new JsonOutputParser();
  const text = `\`\`\`
{"outputValue": "testing2"}
\`\`\``;

  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      input: (input) => input.otherProp,
    }),
    promptTemplate,
    llm,
    parser,
  ]);

  const result = await chain.invoke({ otherProp: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing2" });
});
