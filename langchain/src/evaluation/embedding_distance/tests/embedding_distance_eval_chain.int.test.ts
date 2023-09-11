import {test} from "@jest/globals";
import {
    PairwiseEmbeddingDistanceEvalChain,
} from "../base.js";
import {OpenAIEmbeddings} from "../../../embeddings/openai.js";
import {loadEvaluator} from "../../loader.js";

test("Test Embedding Distance", async () => {
    const chain = await loadEvaluator("embedding_distance");

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        prediction: "I shall go",
        reference: "I shan't go",
    });

    console.log({res});

    const res1 = await chain.evaluateStrings({
        prediction: "I shall go",
        reference: "I will go",
    });

    console.log({res1});
});

test.skip("Test Pairwise Embedding Distance", async () => {
    const chain = new PairwiseEmbeddingDistanceEvalChain({
        embedding: new OpenAIEmbeddings({}, {baseURL: process.env.BASE_URL}),
    });

    console.log("beginning evaluation");
    const res = await chain.evaluateStringPairs({
        prediction: "Seattle is hot in June",
        predictionB: "Seattle is cool in June.",
    });

    console.log({res});

    const res1 = await chain.evaluateStringPairs({
        prediction: "Seattle is warm in June",
        predictionB: "Seattle is cool in June.",
    });

    console.log({res1});
});
