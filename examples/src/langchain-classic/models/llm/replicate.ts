import { Replicate } from "@langchain/community/llms/replicate";

const modelA = new Replicate({
  model:
    "a16z-infra/llama13b-v2-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
});

// `call` is a simple string-in, string-out method for interacting with the model.
const resA = await modelA.invoke(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ resA });
/*
{
  resA: 'Color Box'
}
*/

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

const text2image = new Replicate({
  model:
    "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
});

const image = await text2image.invoke("A cat");
console.log({ image });
/*
{
  "image": "https://replicate.delivery/pbxt/Nc8qkJ8zkdpDPdNSYuMaDErImcXVMUAybFrLk9Kane7IKOWIA/out-0.png"
}
*/
