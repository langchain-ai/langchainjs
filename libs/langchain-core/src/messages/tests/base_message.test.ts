import { test, describe, it, expect } from "vitest";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  ToolMessageChunk,
  RemoveMessage,
  AIMessageChunk,
  coerceMessageLikeToMessage,
  SystemMessage,
} from "../index.js";
import { load } from "../../load/index.js";
import { concat } from "../../utils/stream.js";
import { ToolCallChunk } from "../tool.js";

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

test("Can concat artifact (string) of ToolMessageChunk", () => {
  const rawOutputOne = "Hello";
  const rawOutputTwo = " world";
  const chunk1 = new ToolMessageChunk({
    content: "Hello",
    tool_call_id: "1",
    artifact: rawOutputOne,
  });
  const chunk2 = new ToolMessageChunk({
    content: " world",
    tool_call_id: "1",
    artifact: rawOutputTwo,
  });

  const concated = chunk1.concat(chunk2);
  expect(concated.artifact).toBe(`${rawOutputOne}${rawOutputTwo}`);
});

test("Can concat artifact (array) of ToolMessageChunk", () => {
  const rawOutputOne = ["Hello", " world"];
  const rawOutputTwo = ["!!"];
  const chunk1 = new ToolMessageChunk({
    content: "Hello",
    tool_call_id: "1",
    artifact: rawOutputOne,
  });
  const chunk2 = new ToolMessageChunk({
    content: " world",
    tool_call_id: "1",
    artifact: rawOutputTwo,
  });

  const concated = chunk1.concat(chunk2);
  expect(concated.artifact).toEqual(["Hello", " world", "!!"]);
});

test("Can concat artifact (object) of ToolMessageChunk", () => {
  const rawOutputOne = {
    foo: "bar",
  };
  const rawOutputTwo = {
    bar: "baz",
  };
  const chunk1 = new ToolMessageChunk({
    content: "Hello",
    tool_call_id: "1",
    artifact: rawOutputOne,
  });
  const chunk2 = new ToolMessageChunk({
    content: " world",
    tool_call_id: "1",
    artifact: rawOutputTwo,
  });

  const concated = chunk1.concat(chunk2);
  expect(concated.artifact).toEqual({
    foo: "bar",
    bar: "baz",
  });
});

describe("Complex AIMessageChunk concat", () => {
  it("concatenates content arrays of strings", () => {
    expect(
      new AIMessageChunk({
        content: [{ type: "text", text: "I am" }],
        id: "ai4",
      }).concat(
        new AIMessageChunk({ content: [{ type: "text", text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        id: "ai4",
        content: [
          { type: "text", text: "I am" },
          { type: "text", text: " indeed." },
        ],
      })
    );
  });

  it("concatenates mixed content arrays", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({ content: [{ type: "text", text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, type: "text", text: "I am" },
          { type: "text", text: " indeed." },
        ],
      })
    );
  });

  it("merges content arrays with same index", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({
          content: [{ index: 0, type: "text", text: " indeed." }],
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am indeed." }],
      })
    );
  });

  it("does not merge when one chunk is missing an index", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({ content: [{ type: "text", text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, type: "text", text: "I am" },
          { type: "text", text: " indeed." },
        ],
      })
    );
  });

  it("does not create a holey array when there's a gap between indexes", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({
          content: [{ index: 2, type: "text", text: " indeed." }],
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, type: "text", text: "I am" },
          { index: 2, type: "text", text: " indeed." },
        ],
      })
    );
  });

  it("does not merge content arrays with separate indexes", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({
          content: [{ index: 1, type: "text", text: " indeed." }],
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, type: "text", text: "I am" },
          { index: 1, type: "text", text: " indeed." },
        ],
      })
    );
  });

  it("merges content arrays with same index and type", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, text: "I am", type: "text_block" }],
      }).concat(
        new AIMessageChunk({
          content: [{ index: 0, text: " indeed.", type: "text_block" }],
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [{ index: 0, text: "I am indeed.", type: "text_block" }],
      })
    );
  });

  it("merges content arrays with same index and different types without updating type", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, text: "I am", type: "text_block" }],
      }).concat(
        new AIMessageChunk({
          content: [{ index: 0, text: " indeed.", type: "text_block_delta" }],
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [{ index: 0, text: "I am indeed.", type: "text_block" }],
      })
    );
  });

  it("concatenates empty string content and merges other fields", () => {
    expect(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
      }).concat(
        new AIMessageChunk({
          content: [{ type: "text", text: "" }],
          response_metadata: { extra: "value" },
        })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [{ index: 0, type: "text", text: "I am" }],
        response_metadata: { extra: "value" },
      })
    );
  });

  it("concatenates partial json tool call chunks", () => {
    const chunks: ToolCallChunk[] = [
      {
        name: undefined,
        args: '{"issueKey": "',
        id: "0",
        type: "tool_call_chunk",
      },
      {
        name: "",
        args: "INFO-",
        id: "0",
        type: "tool_call_chunk",
      },
      {
        name: "",
        args: '10001", "fields": ["summary"]', // missing closing curly
        id: "0",
        type: "tool_call_chunk",
      },
    ];

    const result = new AIMessageChunk({
      content: "",
      tool_call_chunks: chunks,
    });

    expect(result.tool_calls?.length).toBe(1);
    expect(result.invalid_tool_calls?.length).toBe(0);
    expect(result.tool_calls).toEqual([
      {
        name: "",
        args: {
          issueKey: "INFO-10001",
          fields: ["summary"],
        },
        id: "0",
        type: "tool_call",
      },
    ]);
  });

  it("concatenates partial json tool call chunks with malformed args", () => {
    const chunks: ToolCallChunk[] = [
      {
        name: "",
        args: 'h{"issueKey": "',
        id: "0",
        type: "tool_call_chunk",
      },
      {
        name: "",
        args: "INFO-",
        id: "0",
        type: "tool_call_chunk",
      },
    ];

    const result = new AIMessageChunk({
      content: "",
      tool_call_chunks: chunks,
    });

    expect(result.tool_calls?.length).toBe(0);
    expect(result.invalid_tool_calls?.length).toBe(1);
    expect(result.invalid_tool_calls).toEqual([
      {
        name: "",
        args: 'h{"issueKey": "INFO-',
        id: "0",
        error: "Malformed args.",
        type: "invalid_tool_call",
      },
    ]);
  });

  it("concatenates tool call chunks with no args", () => {
    const chunks: ToolCallChunk[] = [
      {
        id: "0",
        name: "foo",
        type: "tool_call_chunk",
      },
    ];
    const result = new AIMessageChunk({
      content: "",
      tool_call_chunks: chunks,
    });

    expect(result.tool_calls?.length).toBe(1);
    expect(result.invalid_tool_calls?.length).toBe(0);
    expect(result.tool_calls).toEqual([
      {
        id: "0",
        name: "foo",
        args: {},
        type: "tool_call",
      },
    ]);
  });

  it("concatenates tool call chunks with empty string args", () => {
    const chunks: ToolCallChunk[] = [
      {
        id: "0",
        name: "foo",
        type: "tool_call_chunk",
        args: "",
      },
    ];

    const result = new AIMessageChunk({
      content: "",
      tool_call_chunks: chunks,
    });
    expect(result.tool_calls?.length).toBe(1);
    expect(result.invalid_tool_calls?.length).toBe(0);
    expect(result.tool_calls).toEqual([
      {
        id: "0",
        name: "foo",
        args: {},
        type: "tool_call",
      },
    ]);
  });

  it("concatenates tool call chunks without IDs", () => {
    const chunks = [
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            name: "get_weather",
            args: "",
            id: "call_q6ZzjkLjKNYb4DizyMOaqpfW",
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: '{"',
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: "location",
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: '":"',
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: "San",
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: " Francisco",
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
      new AIMessageChunk({
        id: "chatcmpl-x",
        content: "",
        tool_call_chunks: [
          {
            args: '"}',
            index: 0,
            type: "tool_call_chunk",
          },
        ],
      }),
    ];
    let finalChunk = new AIMessageChunk("");
    for (const chunk of chunks) {
      finalChunk = finalChunk.concat(chunk);
    }
    expect(finalChunk.tool_calls).toHaveLength(1);
    expect(finalChunk.tool_calls).toEqual([
      {
        type: "tool_call",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
        id: "call_q6ZzjkLjKNYb4DizyMOaqpfW",
      },
    ]);
  });
});

describe("Message like coercion", () => {
  it("Should convert OpenAI format messages", async () => {
    const messages = [
      {
        id: "foobar",
        role: "system",
        content: "6",
      },
      { role: "developer", content: "6.1" },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: "7.1" } }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "8.1" }],
        tool_calls: [
          {
            id: "8.5",
            function: {
              name: "8.4",
              arguments: JSON.stringify({ "8.2": "8.3" }),
            },
            type: "function",
          },
        ],
      },
      {
        role: "tool",
        content: "10.2",
        tool_call_id: "10.2",
      },
      {
        role: "remove",
        id: "1234",
        content: "",
      },
    ].map(coerceMessageLikeToMessage);
    expect(messages).toEqual([
      new SystemMessage({
        id: "foobar",
        content: "6",
        additional_kwargs: {},
      }),
      new SystemMessage({
        content: "6.1",
        additional_kwargs: {
          __openai_role__: "developer",
        },
      }),
      new HumanMessage({
        content: [{ type: "image_url", image_url: { url: "7.1" } }],
      }),
      new AIMessage({
        content: [{ type: "text", text: "8.1" }],
        tool_calls: [
          {
            id: "8.5",
            name: "8.4",
            args: { "8.2": "8.3" },
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        name: undefined,
        content: "10.2",
        tool_call_id: "10.2",
      }),
      new RemoveMessage({
        id: "1234",
      }),
    ]);
  });
  it("should convert serialized messages", async () => {
    const originalMessages = [
      new SystemMessage({
        id: "foobar",
        content: "6",
        additional_kwargs: {},
      }),
      new SystemMessage({
        content: "6.1",
        additional_kwargs: {
          __openai_role__: "developer",
        },
      }),
      new HumanMessage({
        content: [{ type: "image_url", image_url: { url: "7.1" } }],
      }),
      new AIMessage({
        content: [{ type: "text", text: "8.1" }],
        tool_calls: [
          {
            id: "8.5",
            name: "8.4",
            args: { "8.2": "8.3" },
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        name: undefined,
        content: "10.2",
        tool_call_id: "10.2",
      }),
    ];
    const serialized = JSON.parse(JSON.stringify(originalMessages));
    const deserialized = serialized.map(coerceMessageLikeToMessage);
    expect(deserialized).toEqual(originalMessages);
  });
});

describe("usage_metadata serialized", () => {
  test("usage_metadata is serialized when included in constructor", async () => {
    const aiMsg = new AIMessage({
      content: "hello",
      usage_metadata: {
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: 2,
      },
    });
    const jsonAIMessage = JSON.stringify(aiMsg);
    expect(jsonAIMessage).toContain("usage_metadata");
    expect(jsonAIMessage).toContain("input_tokens");
    expect(jsonAIMessage).toContain("output_tokens");
    expect(jsonAIMessage).toContain("total_tokens");
  });

  test("usage_metadata is serialized when included in constructor", async () => {
    const aiMsg = new AIMessageChunk({
      content: "hello",
      usage_metadata: {
        input_tokens: 1,
        output_tokens: 1,
        total_tokens: 2,
      },
    });
    const jsonAIMessage = JSON.stringify(aiMsg);
    expect(jsonAIMessage).toContain("usage_metadata");
    expect(jsonAIMessage).toContain("input_tokens");
    expect(jsonAIMessage).toContain("output_tokens");
    expect(jsonAIMessage).toContain("total_tokens");
  });

  test("usage_metadata is serialized even when not included in constructor", async () => {
    const aiMsg = new AIMessageChunk("hello");

    const concatenatedAIMessageChunk = concat(
      aiMsg,
      new AIMessageChunk({
        content: "",
        usage_metadata: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
      })
    );
    const jsonConcatenatedAIMessageChunk = JSON.stringify(
      concatenatedAIMessageChunk
    );
    expect(jsonConcatenatedAIMessageChunk).toContain("usage_metadata");
    expect(jsonConcatenatedAIMessageChunk).toContain("input_tokens");
    expect(jsonConcatenatedAIMessageChunk).toContain("output_tokens");
    expect(jsonConcatenatedAIMessageChunk).toContain("total_tokens");
  });
});

describe("toFormattedString", () => {
  describe("BaseMessage (HumanMessage)", () => {
    it("formats a simple string message", () => {
      const message = new HumanMessage("Hello, world!");
      const output = message.toFormattedString();
      expect(output).toContain("Human Message");
      expect(output).toContain("Hello, world!");
      expect(output).toMatch(/={30,}/); // Check for separator line
    });

    it("formats a message with empty content", () => {
      const message = new HumanMessage("");
      const output = message.toFormattedString();
      expect(output).toContain("Human Message");
      expect(output).not.toContain("\n\n"); // No blank line before content
    });

    it("formats a message with whitespace-only content", () => {
      const message = new HumanMessage("   ");
      const output = message.toFormattedString();
      expect(output).toContain("Human Message");
      // Whitespace-only content should be treated as empty
      expect(output.split("\n").length).toBe(1);
    });
  });

  describe("AIMessage", () => {
    it("formats an AI message without tool calls", () => {
      const message = new AIMessage("I can help with that!");
      const output = message.toFormattedString();
      expect(output).toContain("Ai Message");
      expect(output).toContain("I can help with that!");
    });

    it("formats an AI message with tool calls", () => {
      const message = new AIMessage({
        content: "Let me check the weather",
        tool_calls: [
          {
            id: "call_123",
            name: "get_weather",
            args: { location: "San Francisco", unit: "celsius" },
            type: "tool_call",
          },
        ],
      });
      const output = message.toFormattedString();
      expect(output).toContain("Ai Message");
      expect(output).toContain("Tool Calls:");
      expect(output).toContain("get_weather (call_123)");
      expect(output).toContain("Call ID: call_123");
      expect(output).toContain("Args:");
      expect(output).toContain("location: San Francisco");
      expect(output).toContain("unit: celsius");
    });

    it("formats an AI message with nested objects in tool call args", () => {
      const message = new AIMessage({
        content: "Here is the result.",
        tool_calls: [
          {
            id: "call_123",
            name: "someTool",
            args: { stringArg: "someFile", objectArg: { key: "someValue" } },
            type: "tool_call",
          },
        ],
      });

      const output = message.toFormattedString();
      expect(output).toContain("Ai Message");
      expect(output).toContain("Tool Calls:");
      expect(output).toContain("someTool (call_123)");
      expect(output).toContain("stringArg: someFile");

      // This should show the object, not [object Object]
      expect(output).toContain('"key":"someValue"');
      expect(output).not.toContain("[object Object]");
    });

    it("formats an AI message with multiple tool calls", () => {
      const message = new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_1",
            name: "search",
            args: { query: "test" },
            type: "tool_call",
          },
          {
            id: "call_2",
            name: "calculator",
            args: { expression: "2+2" },
            type: "tool_call",
          },
        ],
      });
      const output = message.toFormattedString();
      expect(output).toContain("search (call_1)");
      expect(output).toContain("calculator (call_2)");
    });

    it("formats an AI message with empty tool calls array", () => {
      const message = new AIMessage({
        content: "Just a message",
        tool_calls: [],
      });
      const output = message.toFormattedString();
      expect(output).toContain("Ai Message");
      expect(output).not.toContain("Tool Calls:");
      expect(output).toContain("Just a message");
    });
  });

  describe("ToolMessage", () => {
    it("formats a tool message with name", () => {
      const message = new ToolMessage({
        content: '{"temperature": 72}',
        tool_call_id: "call_123",
        name: "get_weather",
      });
      const output = message.toFormattedString();
      expect(output).toContain("Tool Message");
      expect(output).toContain("Name: get_weather");
      expect(output).toContain('{"temperature": 72}');
    });

    it("formats a tool message without name", () => {
      const message = new ToolMessage({
        content: "Success",
        tool_call_id: "call_456",
      });
      const output = message.toFormattedString();
      expect(output).toContain("Tool Message");
      expect(output).not.toContain("Name:");
      expect(output).toContain("Success");
    });
  });

  describe("SystemMessage", () => {
    it("formats a system message", () => {
      const message = new SystemMessage("You are a helpful assistant.");
      const output = message.toFormattedString();
      expect(output).toContain("System Message");
      expect(output).toContain("You are a helpful assistant.");
    });
  });

  describe("Message formatting consistency", () => {
    it("maintains consistent separator length for different message types", () => {
      const human = new HumanMessage("Hi");
      const ai = new AIMessage("Hello");
      const system = new SystemMessage("System");

      const humanOutput = human.toFormattedString();
      const aiOutput = ai.toFormattedString();
      const systemOutput = system.toFormattedString();

      const humanSep = humanOutput.split("\n")[0];
      const aiSep = aiOutput.split("\n")[0];
      const systemSep = systemOutput.split("\n")[0];

      expect(humanSep.length).toBe(80);
      expect(aiSep.length).toBe(80);
      expect(systemSep.length).toBe(80);
    });

    it("adds blank line before content when details are present", () => {
      const messageWithDetails = new AIMessage({
        content: "Response",
        tool_calls: [
          {
            id: "call_1",
            name: "tool",
            args: {},
            type: "tool_call",
          },
        ],
      });
      const output = messageWithDetails.toFormattedString();
      const lines = output.split("\n");
      // Should have: title, Tool Calls:, tool info, blank line, content
      expect(lines).toContain("");
    });
  });
});
