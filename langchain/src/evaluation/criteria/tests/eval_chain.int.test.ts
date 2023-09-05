import {test} from "@jest/globals";
import {CriteriaEvalChain, LabeledCriteriaEvalChain} from "../criteria.js";
import {ChatOpenAI} from "../../../chat_models/openai.js";

test.skip("Test CriteriaEvalChain", async () => {
    const model = new ChatOpenAI({modelName: "gpt-4", verbose: true}, {baseURL: "https://ai.openreader.xyz/v1"});

    const chain = await CriteriaEvalChain.fromLLM(model, "conciseness");

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What's 2+2?",
        prediction: "4",
        // prediction: "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
    });

    console.log({res});
});

test("Test LabeledCriteriaEvalChain", async () => {
    const model = new ChatOpenAI({modelName: "gpt-4", verbose: true}, {baseURL: "https://ai.openreader.xyz/v1"});

    const chain = await LabeledCriteriaEvalChain.fromLLM(model, "correctness");

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What is the capital of the US?",
        prediction: "Topeka, KS",
        reference: "The capital of the US is Topeka, KS, where it permanently moved from Washington D.C. on May 16, 2023",
    });

    console.log(res);
});
