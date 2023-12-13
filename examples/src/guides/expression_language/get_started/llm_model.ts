import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({});
const promptAsString = "Human: Tell me a short joke about ice cream";

const response = await model.invoke(promptAsString);
console.log(response);
/**
Why did the ice cream go to therapy?

Because it was feeling a little rocky road.
 */
