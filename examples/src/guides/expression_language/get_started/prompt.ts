import { ChatPromptTemplate } from "langchain/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["human", "Tell me a short joke about {topic}"],
]);
const promptValue = await prompt.invoke({ topic: "ice cream" });
console.log(promptValue);
/**
ChatPromptValue {
  messages: [
    HumanMessage {
      content: 'Tell me a short joke about ice cream',
      name: undefined,
      additional_kwargs: {}
    }
  ]
}
 */
const promptAsMessages = promptValue.toChatMessages();
console.log(promptAsMessages);
/**
[
  HumanMessage {
    content: 'Tell me a short joke about ice cream',
    name: undefined,
    additional_kwargs: {}
  }
]
 */
const promptAsString = promptValue.toString();
console.log(promptAsString);
/**
Human: Tell me a short joke about ice cream
 */
