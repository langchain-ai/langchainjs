import {test} from "@jest/globals";
import {Criteria, CriteriaEvalChain, LabeledCriteriaEvalChain} from "../criteria.js";
import {ChatOpenAI} from "../../../chat_models/openai.js";
import {PRINCIPLES} from "../../../chains/index.js";
import {ChatAnthropic} from "../../../chat_models/index.js";
import {PromptTemplate} from "../../../prompts/index.js";

test.skip("Test CriteriaEvalChain", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});

    const chain = await CriteriaEvalChain.fromLLM(model, Criteria.CONCISENESS);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What's 2+2?",
        prediction: "4",
        // prediction: "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
    });

    console.log({res});
});

test.skip("Test LabeledCriteriaEvalChain", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});

    const chain = await LabeledCriteriaEvalChain.fromLLM(model, Criteria.CORRECTNESS);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What is the capital of the US?",
        prediction: "Topeka, KS",
        reference: "The capital of the US is Topeka, KS, where it permanently moved from Washington D.C. on May 16, 2023",
    });

    console.log(res);
});

test.skip("Test Custom Criteria", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});
    const customCriterion = {"numeric": "Does the output contain numeric or mathematical information?"};

    const chain = await CriteriaEvalChain.fromLLM(model, customCriterion);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "Tell me a joke",
        prediction: "I ate some square pie but I don't know the square of pi."
    });

    console.log(res);
});

test.skip("Test Custom Multiple Criteria", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});
    const customCriterion = {
        "numeric": "Does the output contain numeric information?",
        "mathematical": "Does the output contain mathematical information?",
        "grammatical": "Is the output grammatically correct?",
        "logical": "Is the output logical?",
    };

    const chain = await CriteriaEvalChain.fromLLM(model, customCriterion);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "Tell me a joke",
        prediction: "I ate some square pie but I don't know the square of pi."
    });

    console.log(res);
});

test.skip("Test Using Constitutional Principles ", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});

    const chain = await CriteriaEvalChain.fromLLM(model, PRINCIPLES.harmful1);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What do you think of Will?",
        prediction: "I say that man is a lilly-livered nincompoop"
    });

    console.log(res);
});

test.skip("Test Configuring the LLM", async () => {
    const model = new ChatAnthropic();

    const chain = await CriteriaEvalChain.fromLLM(model, PRINCIPLES.harmful1);

    console.log("beginning evaluation");
    const res = await chain.evaluateStrings({
        input: "What's 2+2?",
        prediction: "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four."
    });

    console.log(res);
});

test("Test Configuring the Prompt", async () => {
    const model = new ChatOpenAI({
        modelName: "gpt-4",
        verbose: true
    }, {baseURL: process.env.BASE_URL});

    const template = `Respond Y or N based on how well the following response follows the specified rubric. Grade only based on the rubric and expected response:

    Grading Rubric: {criteria}
    Expected Response: {reference}

    DATA:
        ---------
            Question: {input}
    Response: {output}
    ---------
        Write out your explanation for each criterion, then respond with Y or N on a new line.`;


    const chain = await LabeledCriteriaEvalChain.fromLLM(model, Criteria.CORRECTNESS, {
        prompt: PromptTemplate.fromTemplate(template)
    });

    console.log("beginning evaluation");


    const res = await chain.evaluateStrings({
        prediction: "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
        input: "What's 2+2?",
        reference: "It's 17 now.",
    });

    console.log(res);
});
