import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { Calculator } from "@langchain/community/tools/calculator";

// Use a pre-built tool
const calculatorTool = convertToOpenAITool(new Calculator());

const modelWithCalculator = new ChatTogetherAI({
  temperature: 0,
  // This is the default env variable name it will look for if none is passed.
  apiKey: process.env.TOGETHER_AI_API_KEY,
  // Together JSON mode/tool calling only supports a select number of models
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
})
  // Bind the tool to the model.
  .bindTools([calculatorTool])
  .withConfig({
    // Specify what tool the model should use
    tool_choice: calculatorTool,
  });

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a super not-so-smart mathmatician."],
  ["human", "Help me out, how can I add {math}?"],
]);

// Use LCEL to chain the prompt to the model.
const response = await prompt.pipe(modelWithCalculator).invoke({
  math: "2 plus 3",
});

console.log(JSON.stringify(response.additional_kwargs.tool_calls));
/**
[
  {
    "id": "call_f4lzeeuho939vs4dilwd7267",
    "type":"function",
    "function": {
      "name":"calculator",
      "arguments": "{\"input\":\"2 + 3\"}"
    }
  }
]
 */
