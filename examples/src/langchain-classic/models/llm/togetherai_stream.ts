import { TogetherAI } from "@langchain/community/llms/togetherai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new TogetherAI({
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
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
stream item:  Sure
stream item: ,
stream item:  here
stream item: '
stream item: s
stream item:  a
stream item:  light
stream item: -
stream item: heart
stream item: ed
stream item:  bear
stream item:  joke
stream item:  for
stream item:  you
stream item: :
stream item:

stream item:

stream item: Why
stream item:  do
stream item:  bears
stream item:  hate
stream item:  shoes
stream item:  so
stream item:  much
stream item: ?
stream item:

stream item:

stream item: Because
stream item:  they
stream item:  like
stream item:  to
stream item:  run
stream item:  around
stream item:  in
stream item:  their
stream item:  bear
stream item:  feet
stream item: !
stream item: </s>
 Sure, here's a light-hearted bear joke for you:

Why do bears hate shoes so much?

Because they like to run around in their bear feet!</s>
 */
