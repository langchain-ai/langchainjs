import { ChatLlamaCpp } from "@langchain/community/chat_models/llama_cpp";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = await ChatLlamaCpp.initialize({
  modelPath: llamaPath,
  temperature: 0.7,
});

const controller = new AbortController();

setTimeout(() => {
  controller.abort();
  console.log("Aborted");
}, 5000);

await model.invoke(
  [
    new SystemMessage(
      "You are a pirate, responses must be very verbose and in pirate dialect."
    ),
    new HumanMessage("Tell me about Llamas?"),
  ],
  {
    signal: controller.signal,
    callbacks: [
      {
        handleLLMNewToken(token) {
          console.log(token);
        },
      },
    ],
  }
);
/*

  Once
   upon
   a
   time
  ,
   in
   a
   green
   and
   sunny
   field
  ...
  Aborted

  AbortError

*/
