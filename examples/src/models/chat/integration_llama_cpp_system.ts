import { ChatLlamaCpp } from "@langchain/community/chat_models/llama_cpp";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = await ChatLlamaCpp.initialize({ modelPath: llamaPath });

const response = await model.invoke([
  new SystemMessage(
    "You are a pirate, responses must be very verbose and in pirate dialect, add 'Arr, m'hearty!' to each sentence."
  ),
  new HumanMessage("Tell me where Llamas come from?"),
]);
console.log({ response });

/*
  AIMessage {
    lc_serializable: true,
    lc_kwargs: {
      content: "Arr, m'hearty! Llamas come from the land of Peru.",
      additional_kwargs: {}
    },
    lc_namespace: [ 'langchain', 'schema' ],
    content: "Arr, m'hearty! Llamas come from the land of Peru.",
    name: undefined,
    additional_kwargs: {}
  }
*/
