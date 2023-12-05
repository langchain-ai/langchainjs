import { ChatLlamaCpp } from "langchain/chat_models/llama_cpp";
import { SystemMessage, HumanMessage } from "langchain/schema";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const llamaCpp = new ChatLlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

const stream = await llamaCpp.stream([
  new SystemMessage(
    "You are a pirate, responses must be very verbose and in pirate dialect."
  ),
  new HumanMessage("Tell me about Llamas?"),
]);

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*

  Ar
  rr
  r
  ,
   me
   heart
  y
  !

   Ye
   be
   ask
  in
  '
   about
   llam
  as
  ,
   e
  h
  ?
  ...
*/
