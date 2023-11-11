import { ChatMinimax } from "langchain/chat_models/minimax";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { HumanMessage } from "langchain/schema";

const model = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
    glyph: {
      type: "raw",
      raw_glyph: "The translated text：{{gen 'content'}}",
    },
  },
});

const messagesTemplate = ChatPromptTemplate.fromMessages([
  HumanMessagePromptTemplate.fromTemplate(
    " Please help me translate the following sentence in English： {text}"
  ),
]);

const messages = await messagesTemplate.formatMessages({ text: "我是谁" });
const result = await model.invoke(messages);

console.log(result);

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

// use json_value

const modelMinimax = new ChatMinimax({
  modelName: "abab5.5-chat",
  botSetting: [
    {
      bot_name: "MM Assistant",
      content: "MM Assistant is an AI Assistant developed by minimax.",
    },
  ],
}).bind({
  replyConstraints: {
    sender_type: "BOT",
    sender_name: "MM Assistant",
    glyph: {
      type: "json_value",
      json_properties: {
        name: {
          type: "string",
        },
        age: {
          type: "number",
        },
        is_student: {
          type: "boolean",
        },
        is_boy: {
          type: "boolean",
        },
        courses: {
          type: "object",
          properties: {
            name: {
              type: "string",
            },
            score: {
              type: "number",
            },
          },
        },
      },
    },
  },
});

const result2 = await modelMinimax.invoke([
  new HumanMessage({
    content:
      " My name is Yue Wushuang, 18 years old this year, just finished the test with 99.99 points.",
    name: "XiaoMing",
  }),
]);

console.log(result2);

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
