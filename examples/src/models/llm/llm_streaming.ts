import { OpenAI } from "langchain/llms/openai";

export const run = async () => {
  // To enable streaming, we pass in `streaming: true` to the LLM constructor.
  // Additionally, we pass in a handler for the `handleLLMNewToken` event.
  const chat = new OpenAI({
    maxTokens: 25,
    streaming: true,
    callbacks: [
      {
        handleLLMNewToken(token: string) {
          console.log({ token });
        },
      },
    ],
  });

  const response = await chat.call("Tell me a joke.");
  console.log(response);
  /*
  { token: '\n' }
  { token: '\n' }
  { token: 'Q' }
  { token: ':' }
  { token: ' Why' }
  { token: ' did' }
  { token: ' the' }
  { token: ' chicken' }
  { token: ' cross' }
  { token: ' the' }
  { token: ' playground' }
  { token: '?' }
  { token: '\n' }
  { token: 'A' }
  { token: ':' }
  { token: ' To' }
  { token: ' get' }
  { token: ' to' }
  { token: ' the' }
  { token: ' other' }
  { token: ' slide' }
  { token: '.' }


  Q: Why did the chicken cross the playground?
  A: To get to the other slide.
  */
};
