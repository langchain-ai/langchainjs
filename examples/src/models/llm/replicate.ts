import { ReplicateLLM } from "langchain/llms";

export const run = async () => {
  const modelA = new ReplicateLLM({
    model:
      "daanelson/flan-t5:04e422a9b85baed86a4f24981d7f9953e20c5fd82f6103b74ebc431588e1cec8",
  });
  // `call` is a simple string-in, string-out method for interacting with the model.
  const resA = await modelA.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resA });
  // { resA: '\n\nSocktastic Colors' }

  // `generate` allows you to generate multiple completions for multiple prompts (in a single request for some models).
  const resB = await modelA.generate([
    "What would be a good company name a company that makes colorful socks?",
    "What would be a good company name a company that makes colorful sweaters?",
  ]);

  // `resB` is a `LLMResult` object with a `generations` field and `llmOutput` field.
  // `generations` is a `Generation[][]`, each `Generation` having a `text` field.
  // Each input to the LLM could have multiple generations (depending on the `n` parameter), hence the list of lists.
  console.log(JSON.stringify(resB, null, 2));

  const text2image = new ReplicateLLM({
    model:
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
  });

  const image = await text2image.call("A cat");
  console.log(image);
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
};
run();
