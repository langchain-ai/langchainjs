import { ChatAnthropicFunctions } from "langchain/chat_models/anthropicfunctions";
import { HumanMessage } from "langchain/schema";
import {
  createExtractionChain,
  createExtractionChainFromZod,
  createTaggingChain,
} from "langchain/chains";
import { z } from "zod";
import { FunctionParameters } from "langchain/output_parsers";
import { ChatOpenAI } from "langchain/chat_models";

// const functionSchema = {
//   name: "get_weather",
//   description: " Get weather information.",
//   parameters: {
//     type: "object",
//     properties: {
//       location: {
//         type: "string",
//         description: " The location to get the weather",
//       },
//     },
//     required: ["location"],
//   },
// };
//
// // Passing in functions
// const model = new ChatAnthropicFunctions({ modelName: "claude-2" }).bind({
//   functions: [functionSchema],
// });
//
// const result = await model.invoke([
//   new HumanMessage({ content: "whats the weater in boston?" }),
// ]);
//
// console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: { content: '', additional_kwargs: { function_call: [Object] } },
  lc_namespace: [ 'langchain', 'schema' ],
  content: '',
  name: undefined,
  additional_kwargs: {
    function_call: { name: 'get_weather', arguments: '{"location":"Boston"}' }
  }
}
*/

// Using for extraction

// const zodSchema = z.object({
//   "person-name": z.string().optional(),
//   "person-age": z.number().optional(),
//   "person-hair_color": z.string().optional(),
//   "dog-name": z.string().optional(),
//   "dog-breed": z.string().optional(),
// });
//
// const chatModel = new ChatAnthropicFunctions({
//   modelName: "claude-2",
//   temperature: 0,
// });
//
// const chain = createExtractionChainFromZod(zodSchema, chatModel);
//
// console.log(
//   await chain.run(`Alex is 5 feet tall. Claudia is 4 feet taller Alex and jumps higher than him. Claudia is a brunette and Alex is blonde.
// Alex's dog Frosty is a labrador and likes to play hide and seek.`)
// );

/*
{
  'person-name': 'Alex',
  'person-age': '5 feet',
  'person-hair_color': 'blonde',
  'dog-name': 'Frosty',
  'dog-breed': 'labrador'
}
 */

//  Using for tagging
const schema: FunctionParameters = {
  type: "object",
  properties: {
    sentiment: { type: "string" },
    tone: { type: "string" },
    language: { type: "string" },
  },
  required: ["tone"],
};

const tagChatModel = new ChatAnthropicFunctions({
  modelName: "claude-2",
  temperature: 0,
});

const tagChain = createTaggingChain(schema, tagChatModel);

console.log(
  await tagChain.run(
    `Estoy increiblemente contento de haberte conocido! Creo que seremos muy buenos amigos!`
  )
);
/*
{ language: 'spanish', tone: 'positive' }
*/
