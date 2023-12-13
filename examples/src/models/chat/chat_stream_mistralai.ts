import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "langchain/prompts";

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  modelName: "mistral-small"
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"]
]);
const chain = prompt.pipe(model);
const response = await chain.stream({
  input: "Hello"
});
for await (const item of response) {
  console.log("stream item:", item.content);
}
/**
stream item:
stream item: Hello! I'm here to help answer any questions
stream item:  you might have or provide information on various topics. Feel free
stream item:  to ask me anything.

For example, if you
stream item:  have a math problem, I can help you solve it.
stream item:  If you want to know the capital city of a certain country,
stream item:  I can tell you that. Or if you're curious
stream item:  about a particular topic, I can provide you with information and
stream item:  resources to learn more.

Is there something specific you
stream item: 'd like to know or ask about? Let me know
stream item:  and I'll do my best to help you out!

stream item:
Additionally, if you have any requests or suggestions
stream item: ,
stream item:  please feel free to share them with me. I'm
stream item:  here to make your experience as helpful and enjoyable as possible.
stream item:

So, how can I assist you today?
stream item:
 */
