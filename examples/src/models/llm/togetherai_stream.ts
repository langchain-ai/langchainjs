import { TogetherAI } from "@langchain/community/llms/togetherai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new TogetherAI({
  modelName: "togethercomputer/StripedHyena-Nous-7B",
  streaming: true,
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant."],
  [
    "human",
    `Tell me a joke about bears.
Assistant:`,
  ],
]);
const chain = prompt.pipe(model);
const result = await chain.stream({});
let fullText = "";
for await (const item of result) {
  console.log("stream item:", item);
  fullText += item;
}
console.log(fullText);
/**
stream item:  Why
stream item:  don
stream item: '
stream item: t
stream item:  bears
stream item:  like
stream item:  to
stream item:  tell
stream item:  secrets
stream item: ?
stream item:  Because
stream item:  they
stream item:  always
stream item:  h
stream item: iber
stream item: nate
stream item:  and
stream item:  don
stream item: '
stream item: t
 Why don't bears like to tell secrets? Because they always hibernate and do
 */
