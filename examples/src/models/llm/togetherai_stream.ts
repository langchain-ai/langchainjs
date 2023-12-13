import { TogetherAI } from "@langchain/community/llms/togetherai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new TogetherAI({
  modelName: "togethercomputer/StripedHyena-Nous-7B",
  streaming: true
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant."],
  [
    "human",
    `Tell me a joke about bears.
Assistant:`
  ]
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
stream item:  did
stream item:  the
stream item:  bear
stream item:  sit
stream item:  on
stream item:  the
stream item:  ice
stream item: ?
stream item:  To
stream item:  catch
stream item:  the
stream item:  sal
stream item: mon
stream item: ,
stream item:  of
stream item:  course
stream item: !
stream item:

stream item: </s>
 Why did the bear sit on the ice? To catch the salmon, of course!
</s>
 */
