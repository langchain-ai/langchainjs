import { z } from "zod";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { FakeChatModel } from "./lib.js";
import { RunnablePassthrough } from "../runnable/passthrough.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { RunnableSequence } from "../runnable/base.js";
import { StringOutputParser } from "../output_parser.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompts/chat.js";

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

test("RunnablePassthrough with RunnableAssign & memory", async () => {
  const prompt = ChatPromptTemplate.fromPromptMessages([
    ["system", "You are a helpful chatbot"],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);
  const llm = new FakeChatModel({});
  const memory = new BufferMemory({
    returnMessages: true,
  });

  const chain = RunnableSequence.from([
    RunnablePassthrough.assign({
      memory: () => memory.loadMemoryVariables({}),
    }),
    {
      input: (previousOutput) => previousOutput.input,
      history: (previousOutput) => previousOutput.memory.history,
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  const inputValues = { input: "test" };
  const response1 = await chain.invoke(inputValues);
  console.log(response1);
  expect(response1).toEqual("You are a helpful chatbot\ntest");

  await memory.saveContext(inputValues, {
    output: response1,
  });

  const response2 = await chain.invoke({ input: "test2" });
  console.log(response2);
  expect(response2).toEqual(
    "You are a helpful chatbot\ntest\nYou are a helpful chatbot\ntest\ntest2"
  );
});
