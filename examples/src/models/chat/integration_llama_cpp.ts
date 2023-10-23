import { ChatLlamaCpp } from "langchain/chat_models/llama_cpp";
import { HumanMessage } from "langchain/schema";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = new ChatLlamaCpp({ modelPath: llamaPath });

const response = await model.call([
  new HumanMessage({ content: "My name is John." }),
]);
console.log({ response });

/*
  AIMessage {
    lc_serializable: true,
    lc_kwargs: {
      content: 'Hello John.',
      additional_kwargs: {}
    },
    lc_namespace: [ 'langchain', 'schema' ],
    content: 'Hello John.',
    name: undefined,
    additional_kwargs: {}
  }
*/
