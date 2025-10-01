import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";
import { HumanMessage } from "../../human.js";

describe("anthropicTranslator", () => {
  it("should translate anthropic message to standard content blocks", () => {
    const message = new AIMessage({
      content: [
        {
          type: "thinking",
          thinking: "foo",
          signature: "foo_signature",
        },
        {
          type: "text",
          text: "Let's call a tool.",
        },
        {
          type: "tool_use",
          id: "abc_123",
          name: "get_weather",
          input: {
            location: "San Francisco",
          },
        },
        {
          type: "text",
          text: "It's sunny.",
          citations: [
            {
              type: "search_result_location",
              cited_text: "The weather is sunny.",
              source: "source_123",
              title: "Document Title",
              search_result_index: 1,
              start_block_index: 0,
              end_block_index: 2,
            },
            {
              bar: "baz",
            },
          ],
        },
        {
          type: "server_tool_use",
          name: "web_search",
          input: {
            query: "web search query",
          },
          id: "srvtoolu_abc123",
        },
        {
          type: "web_search_tool_result",
          tool_use_id: "srvtoolu_abc123",
          content: [
            {
              type: "web_search_result",
              title: "Page Title 1",
              url: "<page url 1>",
              page_age: "January 1, 2025",
              encrypted_content: "<encrypted content 1>",
            },
            {
              type: "web_search_result",
              title: "Page Title 2",
              url: "<page url 2>",
              page_age: "January 2, 2025",
              encrypted_content: "<encrypted content 2>",
            },
          ],
        },
        {
          type: "server_tool_use",
          id: "srvtoolu_def456",
          name: "code_execution",
          input: {
            code: "import numpy as np...",
          },
        },
        {
          type: "code_execution_tool_result",
          tool_use_id: "srvtoolu_def456",
          content: {
            type: "code_execution_result",
            stdout: "Mean: 5.5\nStandard deviation...",
            stderr: "",
          },
        },
        // {
        //   type: "something_else",
        //   foo: "bar",
        // },
      ],
      response_metadata: {
        model_provider: "anthropic",
      },
    });

    const expectedContent: Array<ContentBlock.Standard> = [
      {
        type: "reasoning",
        reasoning: "foo",
        signature: "foo_signature",
      },
      {
        type: "text",
        text: "Let's call a tool.",
      },
      {
        type: "tool_call",
        id: "abc_123",
        name: "get_weather",
        args: {
          location: "San Francisco",
        },
      },
      {
        type: "text",
        text: "It's sunny.",
        annotations: [
          {
            type: "citation",
            title: "Document Title",
            citedText: "The weather is sunny.",
            source: "search",
            search_result_index: 1,
            startIndex: 0,
            endIndex: 2,
            url: "source_123",
          },
        ],
      },
      {
        type: "server_tool_call",
        name: "web_search",
        id: "srvtoolu_abc123",
        args: { query: "web search query" },
      },
      {
        type: "server_tool_call_result",
        toolCallId: "srvtoolu_abc123",
        status: "success",
        output: {
          urls: ["<page url 1>", "<page url 2>"],
        },
      },
      {
        type: "server_tool_call",
        name: "code_execution",
        id: "srvtoolu_def456",
        args: { code: "import numpy as np..." },
      },
      {
        type: "server_tool_call_result",
        toolCallId: "srvtoolu_def456",
        status: "success",
        output: {
          type: "code_execution_result",
          stdout: "Mean: 5.5\nStandard deviation...",
          stderr: "",
        },
      },
      // {
      //   type: "something_else",
      //   foo: "bar",
      // },
    ];

    expect(message.contentBlocks).toEqual(expectedContent);
    // no mutation should be made to the original message
    expect(message.content).not.toEqual(expectedContent);

    // when output_version is v1, content should equal standard output
    const message2 = new AIMessage({
      content: message.contentBlocks,
      response_metadata: {
        output_version: "v1",
      },
    });
    expect(message2.contentBlocks).toEqual(expectedContent);
    expect(message2.content).toEqual(expectedContent);
  });

  it.skip("should translate anthropic message chunk to standard content blocks", () => {
    const chunks = [
      new AIMessageChunk({
        content: [
          {
            type: "text",
            text: "Looking ",
            index: 0,
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "text",
            text: "now.",
            index: 0,
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "tool_use",
            name: "get_weather",
            input: {},
            id: "toolu_abc123",
            index: 1,
          },
        ],
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            name: "get_weather",
            args: "",
            id: "toolu_abc123",
            index: 1,
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "input_json_delta",
            partial_json: "",
            index: 1,
          },
        ],
        tool_call_chunks: [
          {
            args: "",
            index: 1,
            type: "tool_call_chunk",
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "input_json_delta",
            partial_json: '{"loca',
            index: 1,
          },
        ],
        tool_call_chunks: [
          {
            args: '{"loca',
            index: 1,
            type: "tool_call_chunk",
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "input_json_delta",
            partial_json: 'tion": "San ',
            index: 1,
          },
        ],
        tool_call_chunks: [
          {
            args: 'tion": "San ',
            index: 1,
            type: "tool_call_chunk",
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
      new AIMessageChunk({
        content: [
          {
            type: "input_json_delta",
            partial_json: 'Francisco"}',
            index: 1,
          },
        ],
        tool_call_chunks: [
          {
            type: "tool_call_chunk",
            args: 'Francisco"}',
            index: 1,
          },
        ],
        response_metadata: { model_provider: "anthropic" },
      }),
    ];
    const expectedChunkContents: Array<ContentBlock.Standard> = [
      {
        type: "text",
        text: "Looking ",
        index: 0,
      },
      {
        type: "text",
        text: "now.",
        index: 0,
      },
      {
        type: "tool_call_chunk",
        id: "toolu_abc123",
        name: "get_weather",
        args: "",
        index: 1,
      },
      {
        type: "tool_call_chunk",
        args: "",
        index: 1,
      },
      {
        type: "tool_call_chunk",
        args: '{"loca',
        index: 1,
      },
      {
        type: "tool_call_chunk",
        args: 'tion": "San ',
        index: 1,
      },
      {
        type: "tool_call_chunk",
        args: 'Francisco"}',
        index: 1,
      },
    ];
    const chunkPairs = chunks.map((chunk, i) => [
      chunk,
      expectedChunkContents[i],
    ]);
    for (const [chunk, expectedChunk] of chunkPairs) {
      expect(chunk.contentBlocks).toEqual([expectedChunk]);
    }

    let full: AIMessageChunk | undefined;
    for (const chunk of chunks) {
      if (!full) full = chunk;
      else full = full.concat(chunk);
    }

    const expectedContent = [
      {
        type: "text",
        text: "Looking now.",
        index: 0,
      },
      {
        type: "tool_use",
        name: "get_weather",
        partial_json: '{"location": "San Francisco"}',
        input: {},
        id: "toolu_abc123",
        index: 1,
      },
    ];
    expect(full?.contentBlocks).toEqual(expectedContent);

    const expectedContentBlocks = [
      {
        type: "text",
        text: "Looking now.",
        index: 0,
      },
      {
        type: "tool_call_chunk",
        name: "get_weather",
        args: '{"location": "San Francisco"}',
        id: "toolu_abc123",
        index: 1,
      },
    ];
    expect(full?.contentBlocks).toEqual(expectedContentBlocks);
  });

  it("should translate anthropic input to standard content blocks", () => {
    const message = new HumanMessage({
      content: [
        { type: "text", text: "foo" },
        {
          type: "document",
          source: {
            type: "base64",
            data: "<base64 data>",
            media_type: "application/pdf",
          },
        },
        {
          type: "document",
          source: {
            type: "url",
            url: "https://example.com",
          },
        },
        // {
        //   type: "document",
        //   source: {
        //     type: "content",
        //     content: [
        //       { type: "text", text: "The grass is green" },
        //       { type: "text", text: "The sky is blue" },
        //     ],
        //   },
        //   citations: { enabled: true },
        // },
        // {
        //   type: "document",
        //   source: {
        //     type: "text",
        //     data: "<plain text data>",
        //     media_type: "text/plain",
        //   },
        // },
        {
          type: "image",
          source: {
            type: "base64",
            data: "<base64 image data>",
            media_type: "image/jpeg",
          },
        },
        {
          type: "image",
          source: {
            type: "url",
            url: "<image url>",
          },
        },
        {
          type: "image",
          source: {
            type: "file",
            file_id: "<image file id>",
          },
        },
        {
          type: "document",
          source: {
            type: "file",
            file_id: "<pdf file id>",
          },
        },
      ],
    });

    const expectedContent: Array<ContentBlock.Standard> = [
      {
        type: "text",
        text: "foo",
      },
      {
        type: "file",
        data: "<base64 data>",
        mimeType: "application/pdf",
      },
      {
        type: "file",
        url: "https://example.com",
      },
      // {
      //   type: "file",
      //   mimeType: "application/octet-stream",
      //   data: JSON.stringify({
      //     type: "content",
      //     content: [
      //       { type: "text", text: "The grass is green" },
      //       { type: "text", text: "The sky is blue" },
      //     ],
      //   }),
      // },
      // {
      //   type: "file",
      //   mimeType: "text/plain",
      //   data: "<plain text data>",
      // },
      {
        type: "image",
        data: "<base64 image data>",
        mimeType: "image/jpeg",
      },
      {
        type: "image",
        url: "<image url>",
      },
      {
        type: "image",
        fileId: "<image file id>",
      },
      {
        type: "file",
        fileId: "<pdf file id>",
      },
    ];

    expect(message.contentBlocks).toEqual(expectedContent);
    expect(message.content).not.toEqual(expectedContent);

    const message2 = new HumanMessage({
      content: message.contentBlocks,
      response_metadata: {
        output_version: "v1",
      },
    });
    expect(message2.contentBlocks).toEqual(expectedContent);
    expect(message2.content).toEqual(expectedContent);
  });
});
