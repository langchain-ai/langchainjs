import { loadEvaluator } from "langchain/evaluation";

const customCriterion = {
  simplicity: "Is the language straightforward and unpretentious?",
  clarity: "Are the sentences clear and easy to understand?",
  precision: "Is the writing precise, with no unnecessary words or details?",
  truthfulness: "Does the writing feel honest and sincere?",
  subtext: "Does the writing suggest deeper meanings or themes?",
};

const chain = await loadEvaluator("pairwise_string", {
  criteria: customCriterion,
});

const res = await chain.evaluateStringPairs({
  prediction:
    "Every cheerful household shares a similar rhythm of joy; but sorrow, in each household, plays a unique, haunting melody.",
  predictionB:
    "Where one finds a symphony of joy, every domicile of happiness resounds in harmonious, identical notes; yet, every abode of despair conducts a dissonant orchestra, each playing an elegy of grief that is peculiar and profound to its own existence.",
  input: "Write some prose about families.",
});

console.log(res);

/*
{
  reasoning: "Response A is simple, clear, and precise. It uses straightforward language to convey a deep and universal truth about families. The metaphor of joy and sorrow as music is effective and easy to understand. Response B, on the other hand, is more complex and less clear. It uses more sophisticated language and a more elaborate metaphor, which may make it harder for some readers to understand. It also includes unnecessary words and details that don't add to the overall meaning of the prose.Both responses are truthful and sincere, and both suggest deeper meanings about the nature of family life. However, Response A does a better job of conveying these meanings in a simple, clear, and precise way.Therefore, the better response is [[A]].",
  value: 'A',
  score: 1
}
 */
