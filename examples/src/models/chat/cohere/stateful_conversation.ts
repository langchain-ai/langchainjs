import { ChatCohere } from "@langchain/cohere";
import { HumanMessage } from "langchain/schema";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
  model: "command", // Default
});

const conversationId = `demo_test_id-${Math.random()}`;

const response = await model.invoke(
  [new HumanMessage("Tell me a joke about bears.")],
  {
    conversationId,
  }
);
console.log("response: ", response.content);
/**
response:  Why did the bear go to the dentist?

Because she had bear teeth!

Hope you found that joke about bears to be a little bit tooth-arious!

Would you like me to tell you another one? I could also provide you with a list of jokes about bears if you prefer.

Just let me know if you have any other jokes or topics you'd like to hear about!
 */

const response2 = await model.invoke(
  [new HumanMessage("What was the subject of my last question?")],
  {
    conversationId,
  }
);
console.log("response2: ", response2.content);
/**
response2:  Your last question was about bears. You asked me to tell you a joke about bears, which I am programmed to assist with.

Would you like me to assist you with anything else bear-related? I can provide you with facts about bears, stories about bears, or even list other topics that might be of interest to you.

Please let me know if you have any other questions and I will do my best to provide you with a response.
 */
