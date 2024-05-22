import { OpenAI } from "@langchain/openai";

export const run = async () => {
  const modelA = new OpenAI();
  // `call` is a simple string-in, string-out method for interacting with the model.
  const resA = await modelA.invoke(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resA });
  // { resA: '\n\nSocktastic Colors' }

  // `generate` allows you to generate multiple completions for multiple prompts (in a single request for some models).
  const resB = await modelA.invoke([
    "What would be a good company name a company that makes colorful socks?",
    "What would be a good company name a company that makes colorful sweaters?",
  ]);

  // `resB` is a `LLMResult` object with a `generations` field and `llmOutput` field.
  // `generations` is a `Generation[][]`, each `Generation` having a `text` field.
  // Each input to the LLM could have multiple generations (depending on the `n` parameter), hence the list of lists.
  console.log(JSON.stringify(resB, null, 2));
  /*
  {
      "generations": [
          [{
              "text": "\n\nVibrant Socks Co.",
              "generationInfo": {
                  "finishReason": "stop",
                  "logprobs": null
              }
          }],
          [{
              "text": "\n\nRainbow Knitworks.",
              "generationInfo": {
                  "finishReason": "stop",
                  "logprobs": null
              }
          }]
      ],
      "llmOutput": {
          "tokenUsage": {
              "completionTokens": 17,
              "promptTokens": 29,
              "totalTokens": 46
          }
      }
  }
  */

  // We can specify additional parameters the specific model provider supports, like `temperature`:
  const modelB = new OpenAI({ temperature: 0.9 });
  const resC = await modelA.invoke(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resC });
  // { resC: '\n\nKaleidoSox' }

  // We can get the number of tokens for a given input for a specific model.
  const numTokens = modelB.getNumTokens("How many tokens are in this input?");
  console.log({ numTokens });
  // { numTokens: 8 }
};
