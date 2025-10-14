import { ChatYandexGPT } from "@langchain/yandex/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const chat = new ChatYandexGPT();

const res = await chat.invoke([
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
