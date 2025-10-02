import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { loadEvaluator } from "@langchain/classic/evaluation";

const embedding = new OpenAIEmbeddings();

const chain = await loadEvaluator("pairwise_embedding_distance", {
  embedding,
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
});

const res = await chain.evaluateStringPairs({
  prediction: "Seattle is hot in June",
  predictionB: "Seattle is cool in June.",
});

console.log({ res });

/*
  { res: { score: 0.03633645503883243 } }
*/

const res1 = await chain.evaluateStringPairs({
  prediction: "Seattle is warm in June",
  predictionB: "Seattle is cool in June.",
});

console.log({ res1 });

/*
  { res1: { score: 0.03657957473761331 } }
*/
