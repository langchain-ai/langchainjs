import { OpenAI } from "langchain/llms/openai";

// To enable streaming, we pass in `streaming: true` to the LLM constructor.
// Additionally, we pass in a handler for the `handleLLMNewToken` event.
const model = new OpenAI({
  maxTokens: 25,
});

const stream = await model.stream("Tell me a joke.");

for await (const chunk of stream) {
  console.log(chunk);
}

/*


Q
:
 What
 did
 the
 fish
 say
 when
 it
 hit
 the
 wall
?


A
:
 Dam
!
*/
