import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({});
const promptAsString = "Human: Tell me a short joke about ice cream";

const response = await model.invoke(promptAsString);
console.log(response);
/**
AIMessage {
  content: 'Sure, here you go: Why did the ice cream go to school? Because it wanted to get a little "sundae" education!',
  name: undefined,
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
 */
