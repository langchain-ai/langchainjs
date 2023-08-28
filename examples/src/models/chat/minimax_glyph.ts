import { HumanMessage } from "langchain/schema";
import { ChatMinimax } from "langchain/chat_models/minimax";

// const model = new ChatMinimax({
//   modelName: "abab5.5-chat",
//   proVersion: true,
//   verbose: true,
//   botSetting: [
//     {
//       bot_name: "MM Assistant",
//       content: "MM Assistant is an AI Assistant developed by minimax."
//     }
//   ]
// }).bind({
//   replyConstraints: {
//     sender_type: "BOT",
//     sender_name: "MM Assistant",
//     glyph: {
//       type: "raw",
//       raw_glyph: "The translated text：{{gen 'content'}}"
//     }
//   }
// });

// const result = await model.invoke([
//   new HumanMessage({
//     content:
//       " Please help me translate the following sentence in English.：我是谁",
//     name: "XiaoMing",
//   }),
// ]);

// console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: 'The translated text： Who am I\x02',
    additional_kwargs: { function_call: undefined }
  },
  lc_namespace: [ 'langchain', 'schema' ],
  content: 'The translated text： Who am I\x02',
  name: undefined,
  additional_kwargs: { function_call: undefined }
}
*/

const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  proVersion: true,
  verbose: true,
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax."
    }
  ]
}).bind({
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
    glyph: {
      type: "json_value",
      json_properties: {
        name: {
          type: "string"
        },
        age: {
          type: "number"
        },
        is_student: {
          type: "boolean"
        },
        is_boy: {
          type: "boolean"
        },
        courses: {
          type: "object",
          properties: {
            name: {
              type: "string"
            },
            score: {
              type: "number"
            }
          }
        }
      }
    }
  }
});

const result = await model.invoke([new HumanMessage({
  content:" My name is Yue Wushuang, 18 years old this year, just finished the test with 99.99 points.",
  name: "XiaoMing",
})]);

console.log(result);

/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: '{\n' +
      '  "name": "Yue Wushuang",\n' +
      '  "is_student": true,\n' +
      '  "is_boy": false,\n' +
      '  "courses":   {\n' +
      '    "name": "Mathematics",\n' +
      '    "score": 99.99\n' +
      '   },\n' +
      '  "age": 18\n' +
      ' }',
    additional_kwargs: { function_call: undefined }
  }
}

 */
