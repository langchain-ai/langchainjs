import {test} from "@jest/globals";
import {EmbeddingDistanceEvalChain} from "../base.js";
import {OpenAIEmbeddings} from "../../../embeddings/index.js";

test("Test Embedding Distance", async () => {

    const chain = new EmbeddingDistanceEvalChain({
        embedding: new OpenAIEmbeddings({}, {baseURL: process.env.BASE_URL})
    });

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        prediction: "I shall go", reference: "I shan't go"
    });

    console.log({res});

    const res1 = await chain.evaluateStrings({
        prediction: "I shall go", reference: "I will go"
    });

    console.log({res1});
});

