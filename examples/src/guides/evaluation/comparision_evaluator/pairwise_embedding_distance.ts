import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { loadEvaluator } from "langchain/evaluation";

const embedding = new OpenAIEmbeddings();

const chain = await loadEvaluator("pairwise_embedding_distance", { embedding });

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
