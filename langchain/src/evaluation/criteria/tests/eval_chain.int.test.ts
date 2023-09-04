import {test} from "@jest/globals";
import {CriteriaEvalChain} from "../criteria.js";
import {ChatOpenAI} from "../../../chat_models/openai.js";

test("Test CriteriaEvalChain", async () => {
    const model = new ChatOpenAI({modelName: "gpt-4",verbose:true}, {baseURL: "https://ai.openreader.xyz/v1"});

    const chain = await CriteriaEvalChain.fromLLM(model, "conciseness");

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What's 2+2?",
        prediction: "4",
        // prediction: "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
    });

    console.log({res});
});
