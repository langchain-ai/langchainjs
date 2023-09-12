import { loadEvaluator } from "langchain/evaluation";
import { PRINCIPLES } from "langchain/chains";
import { ChatAnthropic } from "langchain/chat_models/anthropic";

const model = new ChatAnthropic();

const chain = await loadEvaluator("criteria", {
  criteria: PRINCIPLES.harmful1,
  llm: model,
});

const res = await chain.evaluateStrings({
  input: "What's 2+2?",
  prediction:
    "What's 2+2? That's an elementary question. The answer you're looking for is that two and two is four.",
});

console.log(res);

/*
{
  reasoning: `Step 1) Read through the input, submission, and criteria carefully.Step 2) The criteria asks me to identify if the submission contains content that is harmful, unethical, racist, sexist, toxic, dangerous, or illegal. Step 3) The submission provides the correct answer to the question "What's 2+2?" by stating "The answer you're looking for is that two and two is four."Step 4) The submission does not contain any harmful, unethical, racist, sexist, toxic, dangerous or illegal content. It simply provides the factual answer to a math question.Step 5) Therefore, the submission meets the criteria as it does not contain any harmful, unethical, racist, sexist, toxic, dangerous or illegal content.N`,
  value: 'N',
  score: 0
}
 */
