import { test } from "@jest/globals";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { HumanMessage, AIMessage, ToolMessage, AIMessageChunk, ToolMessageChunk, SystemMessageChunk, SystemMessage, HumanMessageChunk, ChatMessageChunk, ChatMessage, FunctionMessage, FunctionMessageChunk } from "../index.js";
import { load } from "../../load/index.js";

test("Test ChatPromptTemplate can format OpenAI content image messages", async () => {
  const message = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,{image_string}`,
        },
      },
    ],
  });
  const prompt = ChatPromptTemplate.fromMessages([
    message,
    ["ai", "Will this format with multiple messages?: {yes_or_no}"],
  ]);
  const formatted = await prompt.invoke({
    image_string: "base_64_encoded_string",
    yes_or_no: "YES!",
  });
  expect(formatted.messages[0].content[0]).toEqual({
    type: "image_url",
    image_url: {
      url: "data:image/jpeg;base64,base_64_encoded_string",
    },
  });
  expect(formatted.messages[1].content).toEqual(
    "Will this format with multiple messages?: YES!"
  );
});

test("Test ChatPromptTemplate can format OpenAI content image messages", async () => {
  const message = new HumanMessage({
    content: [
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,{image_string}`,
        },
      },
    ],
  });
  const prompt = ChatPromptTemplate.fromMessages([
    message,
    ["ai", "Will this format with multiple messages?: {yes_or_no}"],
  ]);
  const formatted = await prompt.invoke({
    image_string: "base_64_encoded_string",
    yes_or_no: "YES!",
  });
  expect(formatted.messages[0].content[0]).toEqual({
    type: "image_url",
    image_url: {
      url: "data:image/jpeg;base64,base_64_encoded_string",
    },
  });
  expect(formatted.messages[1].content).toEqual(
    "Will this format with multiple messages?: YES!"
  );
});

test("Deserialisation and serialisation of additional_kwargs and tool_call_id", async () => {
  const config = {
    importMap: { messages: { AIMessage } },
    optionalImportEntrypoints: [],
    optionalImportsMap: {},
    secretsMap: {},
  };

  const message = new AIMessage({
    content: "",
    additional_kwargs: {
      tool_calls: [
        {
          id: "call_tXJNP1S6LHT5tLfaNHCbYCtH",
          type: "function" as const,
          function: {
            name: "Weather",
            arguments: '{\n  "location": "Prague"\n}',
          },
        },
      ],
    },
  });

  const deserialized: AIMessage = await load(JSON.stringify(message), config);
  expect(deserialized).toEqual(message);
});

test("Deserialisation and serialisation of tool_call_id", async () => {
  const config = {
    importMap: { messages: { ToolMessage } },
    optionalImportEntrypoints: [],
    optionalImportsMap: {},
    secretsMap: {},
  };

  const message = new ToolMessage({
    content: '{"value": 32}',
    tool_call_id: "call_tXJNP1S6LHT5tLfaNHCbYCtH",
  });

  const deserialized: ToolMessage = await load(JSON.stringify(message), config);
  expect(deserialized).toEqual(message);
});

test("Deserialisation and serialisation of messages with ID", async () => {
  const config = {
    importMap: { messages: { AIMessage } },
    optionalImportEntrypoints: [],
    optionalImportsMap: {},
    secretsMap: {},
  };

  const messageId = "uuid-1234";

  const message = new AIMessage({
    content: "The sky is blue because...",
    id: messageId,
  });

  const deserialized: AIMessage = await load(JSON.stringify(message), config);
  expect(deserialized).toEqual(message);
  expect(deserialized.id).toBe(messageId);
});

test("AIMessage can convert to string", () => {
  const fields = {
    id: "msg_id_123",
    content: "The sky is blue because",
    tool_calls: [
      {
        id: "id_123",
        name: "get_weather",
        args: {
          location: "Prague",
        }
      }
    ]
  }
  const expectedMessage = "id: msg_id_123\ncontent: The sky is blue because\ntool_calls: [{\"id\":\"id_123\",\"name\":\"get_weather\",\"args\":{\"location\":\"Prague\"}}]";
  const message = new AIMessage(fields);
  const messageAsString = `${message}`;
  expect(messageAsString).toBe(`AIMessage: ${expectedMessage}`);

  // Message chunk
  const messageChunk = new AIMessageChunk(fields);
  const messageChunkAsString = `${messageChunk}`;
  expect(messageChunkAsString).toBe(`AIMessageChunk: ${expectedMessage}`);
});

test("HumanMessage can convert to string", () => {
  const fields = {
    id: "msg_id_123",
    content: "The sky is blue because",
  }
  const expectedMessage = "id: msg_id_123\ncontent: The sky is blue because";
  const message = new HumanMessage(fields);
  const messageAsString = `${message}`;
  expect(messageAsString).toBe(`HumanMessage: ${expectedMessage}`);

  // Message chunk
  const messageChunk = new HumanMessageChunk(fields);
  const messageChunkAsString = `${messageChunk}`;
  expect(messageChunkAsString).toBe(`HumanMessageChunk: ${expectedMessage}`);
});

test("SystemMessage can convert to string", () => {
  const fields = {
    id: "msg_id_123",
    content: "The sky is blue because",
  }
  const expectedMessage = "id: msg_id_123\ncontent: The sky is blue because";
  const message = new SystemMessage(fields);
  const messageAsString = `${message}`;
  expect(messageAsString).toBe(`SystemMessage: ${expectedMessage}`);

  // Message chunk
  const messageChunk = new SystemMessageChunk(fields);
  const messageChunkAsString = `${messageChunk}`;
  expect(messageChunkAsString).toBe(`SystemMessageChunk: ${expectedMessage}`);
});

test("ChatMessage can convert to string", () => {
  const fields = {
    id: "msg_id_123",
    content: "The sky is blue because",
    role: "my_role"
  }
  const expectedMessage = "id: msg_id_123\nrole: my_role\ncontent: The sky is blue because";
  const message = new ChatMessage(fields);
  const messageAsString = `${message}`;
  expect(messageAsString).toBe(`ChatMessage: ${expectedMessage}`);

  // Message chunk
  const messageChunk = new ChatMessageChunk(fields);
  const messageChunkAsString = `${messageChunk}`;
  expect(messageChunkAsString).toBe(`ChatMessageChunk: ${expectedMessage}`);
});

test("ToolMessage can convert to string", () => {
  // ------------------------------------
  // ToolMessage
  // ------------------------------------

  // Test case 1: String content with tool_call_id
  const fields1 = {
    content: "The sky is blue because",
    tool_call_id: "call_123",
  };
  const message1 = new ToolMessage(fields1);
  expect(`${message1}`).toBe("ToolMessage: tool_call_id: call_123\ncontent: The sky is blue because");

  // Test case 2: Complex content without tool_call_id in content
  const fields2 = {
    content: JSON.stringify({ temperature: 25, conditions: "Clear" }),
    tool_call_id: "call_789",
  };
  const message2 = new ToolMessage(fields2);
  expect(`${message2}`).toBe('ToolMessage: tool_call_id: call_789\ncontent: {"temperature":25,"conditions":"Clear"}');

  // Test case 3: With name
  const fields3 = {
    content: "Weather report",
    tool_call_id: "call_abc",
    name: "WeatherTool",
  };
  const message3 = new ToolMessage(fields3);
  expect(`${message3}`).toBe("ToolMessage: tool_call_id: call_abc\nname: WeatherTool\ncontent: Weather report");

  // Test case 4: Using string constructor
  const message4 = new ToolMessage("Forecast: Cloudy", "call_def", "WeatherForecast");
  expect(`${message4}`).toBe("ToolMessage: tool_call_id: call_def\nname: WeatherForecast\ncontent: Forecast: Cloudy");

  // ------------------------------------
  // ToolMessageChunk
  // ------------------------------------

  const messageChunk1 = new ToolMessageChunk(fields1);
  expect(`${messageChunk1}`).toBe("ToolMessageChunk: tool_call_id: call_123\ncontent: The sky is blue because");

  const messageChunk2 = new ToolMessageChunk(fields2);
  expect(`${messageChunk2}`).toBe('ToolMessageChunk: tool_call_id: call_789\ncontent: {"temperature":25,"conditions":"Clear"}');

  const messageChunk3 = new ToolMessageChunk(fields3);
  expect(`${messageChunk3}`).toBe("ToolMessageChunk: tool_call_id: call_abc\nname: WeatherTool\ncontent: Weather report");
});

test("FunctionMessage can convert to string", () => {
  const fields = {
    id: "msg_id_123",
    name: "get_weather",
    content: "The sky is blue because",
    additional_kwargs: {
      function_call: {
        name: "get_weather",
        arguments: JSON.stringify({
          location: "Prague",
        })
      }
    }
  }
  const expectedMessage = "id: msg_id_123\n" +
    "name: get_weather\n" +
    "content: The sky is blue because\n" +
    "function_call: {\"name\":\"get_weather\",\"arguments\":\"{\\\"location\\\":\\\"Prague\\\"}\"}";
  const message = new FunctionMessage(fields);
  const messageAsString = `${message}`;
  expect(messageAsString).toBe(`FunctionMessage: ${expectedMessage}`);

  // Message chunk
  const messageChunk = new FunctionMessageChunk(fields);
  const messageChunkAsString = `${messageChunk}`;
  expect(messageChunkAsString).toBe(`FunctionMessageChunk: ${expectedMessage}`);
});