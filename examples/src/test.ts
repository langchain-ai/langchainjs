import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  temperature: 0,
});

const prompt = ChatPromptTemplate.fromTemplate("tell me a joke about {topic}");

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const analysisPrompt = ChatPromptTemplate.fromTemplate(
  "is this a funny joke? {joke}"
);

const composedChainWithLambda = RunnableSequence.from([
  chain,
  (input) => ({ joke: input }),
  analysisPrompt,
  model,
  new StringOutputParser(),
]);

console.log("composedChainWithLambda\n\n");
console.log(await composedChainWithLambda.invoke({ topic: "beets" }));
