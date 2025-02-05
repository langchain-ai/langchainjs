import { test, describe, it, expect } from "@jest/globals";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  ToolMessageChunk,
  AIMessageChunk,
  coerceMessageLikeToMessage,
  SystemMessage,
} from "../index.js";
import { load } from "../../load/index.js";
import { concat } from "../../utils/stream.js";

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
      new AIMessageChunk({ content: [{ index: 0, text: "I am" }] }).concat(
        new AIMessageChunk({ content: [{ index: 0, text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({ content: [{ index: 0, text: "I am indeed." }] })
    );
  });

  it("does not merge when one chunk is missing an index", () => {
    expect(
      new AIMessageChunk({ content: [{ index: 0, text: "I am" }] }).concat(
        new AIMessageChunk({ content: [{ text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [{ index: 0, text: "I am" }, { text: " indeed." }],
      })
    );
  });

  it("does not create a holey array when there's a gap between indexes", () => {
    expect(
      new AIMessageChunk({ content: [{ index: 0, text: "I am" }] }).concat(
        new AIMessageChunk({ content: [{ index: 2, text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, text: "I am" },
          { index: 2, text: " indeed." },
        ],
      })
    );
  });

  it("does not merge content arrays with separate indexes", () => {
    expect(
      new AIMessageChunk({ content: [{ index: 0, text: "I am" }] }).concat(
        new AIMessageChunk({ content: [{ index: 1, text: " indeed." }] })
      )
    ).toEqual(
      new AIMessageChunk({
        content: [
          { index: 0, text: "I am" },
          { index: 1, text: " indeed." },
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
