import { ChatYandexGPT } from "langchain/chat_models/yandex";
import { HumanMessage, SystemMessage } from "langchain/schema";

const chat = new ChatYandexGPT();

const res = await chat.call([
  new SystemMessage(
    "You are a helpful assistant that translates English to French."
  ),
  new HumanMessage("I love programming."),
]);
console.log(res);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: { content: "Je t'aime programmer.", additional_kwargs: {} },
  lc_namespace: [ 'langchain', 'schema' ],
  content: "Je t'aime programmer.",
  name: undefined,
  additional_kwargs: {}
}
 */
