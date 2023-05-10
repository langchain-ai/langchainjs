import { GPT4All } from "langchain/llms/gpt4all";

export const run = async () => {
  const modelA = new GPT4All({
    model: "gpt4all-lora-unfiltered-quantized",
  });

  // `call` is a simple string-in, string-out method for interacting with the model.
  const resA = await modelA.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ resA });
  /*
  {
    resA: 'Color Box'
  }
  */

  // `generate` allows you to generate multiple completions for multiple prompts (in a single request for some models).
  const resB = await modelA.generate([
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
      [
        {
          "text": "apron string"
        }
      ],
      [
        {
          "text": "Kulut"
        }
      ]
    ]
  }
  */
};
