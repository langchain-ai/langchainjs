import { AIMessage } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";
import { convertToV1FromChatBedrockConverseInput } from "../bedrock_converse.js";

describe("ChatBedrockConverseTranslator", () => {
  it("should translate ChatBedrockConverse messages to standard content blocks", () => {
    const message = new AIMessage({
      content: [
        { type: "cache_point", cachePoint: { type: "default" } },
        {
          type: "citations_content",
          citationsContent: {
            content: [{ text: "foo" }, { text: "bar" }],
            citations: [
              {
                title: "Document Title",
                sourceContent: [{ text: "lorem" }, { text: "ipsum" }],
                location: {
                  documentChar: {
                    documentIndex: 0,
                    start: 10,
                    end: 20,
                  },
                },
              },
              {
                title: "Document Title",
                sourceContent: [{ text: "lorem" }, { text: "ipsum" }],
                location: {
                  documentPage: {
                    documentIndex: 1,
                    start: 20,
                    end: 30,
                  },
                },
              },
              {
                title: "Document Title",
                sourceContent: [{ text: "lorem" }, { text: "ipsum" }],
                location: {
                  documentChunk: {
                    documentIndex: 2,
                    start: 30,
                    end: 40,
                  },
                },
              },
            ],
          },
        },
        {
          type: "document",
          document: {
            format: "md",
            name: "doc_name_1",
            source: {
              bytes: Buffer.from("doc_text_1"),
            },
            context: "doc_context_1",
            citations: { enabled: true },
          },
        },
        {
          type: "document",
          document: {
            format: "pdf",
            name: "doc_name_2",
            source: {
              s3Location: {
                uri: "s3://doc_text_2",
                bucketOwner: "owner",
              },
            },
            context: "doc_context_2",
          },
        },
        {
          type: "guard_content",
          guardContent: {
            text: {
              text: "foo",
            },
          },
        },
        {
          type: "image",
          image: {
            format: "jpeg",
            source: {
              bytes: Buffer.from("image_bytes"),
            },
          },
        },
        {
          type: "reasoning_content",
          reasoningText: "foo",
        },
        {
          type: "reasoning_content",
          redactedContent: Buffer.from("redacted_content").toString("base64"),
        },
        {
          type: "text",
          text: "release the list",
        },
        {
          type: "tool_result",
          toolResult: {
            toolUseId: "abc_123",
            content: [{ text: "It's sunny." }],
            status: "success",
          },
        },
        {
          type: "video",
          video: {
            format: "mp4",
            source: {
              bytes: Buffer.from("video_bytes"),
            },
          },
        },
        {
          type: "video",
          video: {
            format: "mp4",
            source: {
              s3Location: {
                uri: "s3://video_url",
                bucketOwner: "owner",
              },
            },
          },
        },
        {
          type: "random",
          random: {
            foo: "bar",
          },
        },
      ],
      response_metadata: {
        model_provider: "bedrock-converse",
      },
    });
    const expectedContent: ContentBlock.Standard[] = [
      {
        type: "non_standard",
        value: { type: "cache_point", cachePoint: { type: "default" } },
      },
      {
        type: "text",
        text: "foobar",
        annotations: [
          {
            type: "citation",
            citedText: "loremipsum",
            source: "0",
            startIndex: 10,
            endIndex: 20,
          },
          {
            type: "citation",
            citedText: "loremipsum",
            source: "1",
            startIndex: 20,
            endIndex: 30,
          },
          {
            type: "citation",
            citedText: "loremipsum",
            source: "2",
            startIndex: 30,
            endIndex: 40,
          },
        ],
      },
      {
        type: "file",
        mimeType: "text/markdown",
        data: Buffer.from("doc_text_1"),
      },
      {
        type: "file",
        mimeType: "application/pdf",
        fileId: "s3://doc_text_2",
      },
      {
        type: "non_standard",
        value: {
          type: "guard_content",
          guardContent: { text: { text: "foo" } },
        },
      },
      {
        type: "image",
        mimeType: "image/jpeg",
        data: Buffer.from("image_bytes"),
      },
      { type: "reasoning", reasoning: "foo" },
      {
        type: "non_standard",
        value: {
          type: "reasoning_content",
          redactedContent: Buffer.from("redacted_content").toString("base64"),
        },
      },
      {
        type: "text",
        text: "release the list",
      },
      {
        type: "non_standard",
        value: {
          type: "tool_result",
          toolResult: {
            toolUseId: "abc_123",
            content: [{ text: "It's sunny." }],
            status: "success",
          },
        },
      },
      {
        type: "video",
        mimeType: "video/mp4",
        data: Buffer.from("video_bytes"),
      },
      {
        type: "video",
        mimeType: "video/mp4",
        fileId: "s3://video_url",
      },
      {
        type: "non_standard",
        value: {
          type: "random",
          random: {
            foo: "bar",
          },
        },
      },
    ];
    expect(message.contentBlocks).toEqual(expectedContent);
  });
  it("should translate ChatBedrockConverse inputs to standard content blocks", () => {
    const message = new AIMessage([
      { type: "text", text: "foo" },
      {
        type: "document",
        document: {
          format: "txt",
          name: "doc_name_1",
          source: { text: "doc_text_1" },
          context: "doc_context_1",
          citations: { enabled: true },
        },
      },
      {
        type: "document",
        document: {
          format: "pdf",
          name: "doc_name_2",
          source: { bytes: Buffer.from("doc_text_2") },
        },
      },
      {
        type: "document",
        document: {
          format: "txt",
          name: "doc_name_3",
          source: { content: [{ text: "doc_text" }, { text: "_3" }] },
          context: "doc_context_3",
        },
      },
      {
        type: "image",
        image: {
          format: "jpeg",
          source: { bytes: Buffer.from("image_bytes") },
        },
      },
      {
        type: "document",
        document: {
          format: "pdf",
          name: "doc_name_4",
          source: {
            s3Location: { uri: "s3://bla", bucketOwner: "owner" },
          },
        },
      },
    ]);
    const expectedContent: ContentBlock.Standard[] = [
      { type: "text", text: "foo" },
      {
        type: "file",
        mimeType: "text/plain",
        data: Buffer.from("doc_text_1").toString("base64"),
      },
      {
        type: "file",
        mimeType: "application/pdf",
        data: Buffer.from("doc_text_2"),
      },
      { type: "file", mimeType: "text/plain", data: "doc_text_3" },
      {
        type: "image",
        mimeType: "image/jpeg",
        data: Buffer.from("image_bytes"),
      },
      { type: "file", mimeType: "application/pdf", fileId: "s3://bla" },
    ];
    expect(convertToV1FromChatBedrockConverseInput(message)).toEqual(
      expectedContent
    );
  });
});
