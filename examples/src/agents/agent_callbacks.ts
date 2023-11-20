import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

const model = new OpenAI({ temperature: 0 });
const tools = [
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "Austin,Texas,United States",
    hl: "en",
    gl: "us",
  }),
  new Calculator(),
];
const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
});

const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;
const result = await executor.invoke(
  { input },
  {
    callbacks: [
      {
        handleAgentAction(action, runId) {
          console.log("\nhandleAgentAction", action, runId);
        },
        handleAgentEnd(action, runId) {
          console.log("\nhandleAgentEnd", action, runId);
        },
        handleToolEnd(output, runId) {
          console.log("\nhandleToolEnd", output, runId);
        },
      },
    ],
  }
);
/*
handleAgentAction {
  tool: 'search',
  toolInput: 'Olivia Wilde boyfriend',
  log: " I need to find out who Olivia Wilde's boyfriend is and then calculate his age raised to the 0.23 power.\n" +
    'Action: search\n' +
    'Action Input: "Olivia Wilde boyfriend"'
} 9b978461-1f6f-4d5f-80cf-5b229ce181b6

handleToolEnd In January 2021, Wilde began dating singer Harry Styles after meeting during the filming of Don't Worry Darling. Their relationship ended in November 2022. 062fef47-8ad1-4729-9949-a57be252e002

handleAgentAction {
  tool: 'search',
  toolInput: 'Harry Styles age',
  log: " I need to find out Harry Styles' age.\n" +
    'Action: search\n' +
    'Action Input: "Harry Styles age"'
} 9b978461-1f6f-4d5f-80cf-5b229ce181b6

handleToolEnd 29 years 9ec91e41-2fbf-4de0-85b6-12b3e6b3784e 61d77e10-c119-435d-a985-1f9d45f0ef08

handleAgentAction {
  tool: 'calculator',
  toolInput: '29^0.23',
  log: ' I need to calculate 29 raised to the 0.23 power.\n' +
    'Action: calculator\n' +
    'Action Input: 29^0.23'
} 9b978461-1f6f-4d5f-80cf-5b229ce181b6

handleToolEnd 2.169459462491557 07aec96a-ce19-4425-b863-2eae39db8199

handleAgentEnd {
  returnValues: {
    output: "Harry Styles is Olivia Wilde's boyfriend and his current age raised to the 0.23 power is 2.169459462491557."
  },
  log: ' I now know the final answer.\n' +
    "Final Answer: Harry Styles is Olivia Wilde's boyfriend and his current age raised to the 0.23 power is 2.169459462491557."
} 9b978461-1f6f-4d5f-80cf-5b229ce181b6
*/

console.log({ result });
// { result: "Harry Styles is Olivia Wilde's boyfriend and his current age raised to the 0.23 power is 2.169459462491557." }
