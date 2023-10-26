import { ChatPromptTemplate, FewShotPromptTemplate } from "langchain/prompts";

const examples = [
  {
    input: "Could the members of The Police perform lawful arrests?",
    output: "what can the members of The Police do?",
  },
  {
    input: "Jan Sindel's was born in what country?",
    output: "what is Jan Sindel's personal history?",
  },
];

const examplePrompt = ChatPromptTemplate.fromMessages([
  ["human", "{input}"],
  ["ai", "{output}"],
]);

const fewShotPrompt = new FewShotPromptTemplate({
  examples,
  examplePrompt,
  inputVariables: ["input", "output"],
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are an expert at world knowledge. Your task is to step back and paraphrase a question to a more generic step-back question, which is easier to answer. Here are a few examples:",
  ],
  fewShotPrompt,
  ["user", "{question}"],
]);
