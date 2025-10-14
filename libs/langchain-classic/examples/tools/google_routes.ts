import { GoogleRoutesAPI } from "@langchain/community/tools/google_routes";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

const tools = [new GoogleRoutesAPI()];

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-0125",
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const agent = await createAgent({
  llm,
  tools,
  prompt,
});

const result = await agent.invoke({
  messages: [
    "How to go from the Eiffel Tower to the Louvre Museum by transit?",
  ],
});

console.log(result);

/**
 * {
 *   input: 'How to go from the Eiffel Tower to the Louvre Museum by transit?',
 *   output: 'To travel from the Eiffel Tower to the Louvre Museum by transit, here is the route information:\n' +
 *     '\n' +
 *     '- Departure: Eiffel Tower\n' +
 *     '- Arrival: Louvre Museum\n' +
 *     '- Distance: 4.1 km\n' +
 *     '- Duration: 18 minutes\n' +
 *     '- Transit Fare: €2.15\n' +
 *     '\n' +
 *     'Travel Instructions:\n' +
 *     "1. Walk to Pont d'Iéna\n" +
 *     '2. Take bus 72 towards Gare de Lyon - Maison de La RATP\n' +
 *     '3. Walk to your destination\n' +
 *     '\n' +
 *     'Departure Time: 22:03\n' +
 *     'Arrival Time: 22:15\n' +
 *     '\n' +
 *     'Please follow these instructions to reach the Louvre Museum from the Eiffel Tower.'
 * }
 */
