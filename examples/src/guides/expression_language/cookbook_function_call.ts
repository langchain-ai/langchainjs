import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";

const prompt = PromptTemplate.fromTemplate(`Tell me a joke about {subject}`);

const model = new ChatOpenAI({});

const functionSchema = [
  {
    name: "joke",
    description: "A joke",
    parameters: {
      type: "object",
      properties: {
        setup: {
          type: "string",
          description: "The setup for the joke",
        },
        punchline: {
          type: "string",
          description: "The punchline for the joke",
        },
      },
      required: ["setup", "punchline"],
    },
  },
];

const chain = prompt.pipe(
  model.bind({
    functions: functionSchema,
    function_call: { name: "joke" },
  })
);

const result = await chain.invoke({ subject: "bears" });

console.log(result);

/*
  AIMessage {
    content: "",
    additional_kwargs: {
      function_call: {
        name: "joke",
        arguments: '{\n  "setup": "Why don\'t bears wear shoes?",\n  "punchline": "Because they have bear feet!"\n}'
      }
    }
  }
*/
