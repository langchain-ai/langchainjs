import {
  afterAll,
  afterEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatAlibabaTongyi } from "../alibaba_tongyi.js";

const weatherTool = {
  type: "function" as const,
  function: {
    name: "get_current_weather",
    description: "Get weather for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name.",
        },
      },
      required: ["location"],
    },
  },
};

function createJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createSseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  const data = events
    .map((event) => `data: ${JSON.stringify(event)}\n`)
    .join("");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

function getRequestBody(fetchMock: ReturnType<typeof jest.spyOn>) {
  const lastCall = fetchMock.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("No fetch call found.");
  }
  const [, requestInit] = lastCall;
  if (!requestInit?.body) {
    throw new Error("Body not found in request.");
  }
  return JSON.parse(requestInit.body.toString()) as {
    input: {
      messages: Array<{
        role: string;
        content: string;
        tool_call_id?: string;
        tool_calls?: Array<{
          type?: string;
          function?: {
            name?: string;
            arguments?: string;
          };
        }>;
      }>;
    };
    parameters: {
      result_format?: string;
      repetition_penalty?: number;
      incremental_output?: boolean;
      parallel_tool_calls?: boolean;
      tools?: Array<{
        type: string;
        function: { name: string };
      }>;
      tool_choice?: unknown;
    };
  };
}

function getRequestHeaders(fetchMock: ReturnType<typeof jest.spyOn>) {
  const lastCall = fetchMock.mock.calls.at(-1);
  if (!lastCall) {
    throw new Error("No fetch call found.");
  }
  const [, requestInit] = lastCall;
  return new Headers(requestInit?.headers);
}

describe("ChatAlibabaTongyi tool calling", () => {
  const fetchMock = jest.spyOn(globalThis, "fetch");

  afterEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  test("bindTools serializes tools into parameters and switches to message format", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-1",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "No tool needed.",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool]);

    await model.invoke("What's the weather in SF?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = getRequestBody(fetchMock);
    expect(body.parameters.result_format).toBe("message");
    expect(body.parameters.tools?.[0]?.type).toBe("function");
    expect(body.parameters.tools?.[0]?.function.name).toBe(
      "get_current_weather"
    );
  });

  test("invoke without bound tools keeps text result format and no tools payload", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-text-1",
        usage: {
          input_tokens: 1,
          output_tokens: 2,
          total_tokens: 3,
        },
        output: {
          text: "Plain text response.",
          finish_reason: "stop",
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const response = await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.result_format).toBe("text");
    expect(body.parameters.tools).toBeUndefined();
    expect(response.content).toBe("Plain text response.");
    expect(response.usage_metadata).toEqual({
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    });
  });

  test("invoke parses tool_calls and invalid_tool_calls", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-2",
        usage: {
          input_tokens: 3,
          output_tokens: 4,
          total_tokens: 7,
        },
        output: {
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "get_current_weather",
                      arguments: '{"location":"San Francisco"}',
                    },
                  },
                  {
                    id: "call_2",
                    type: "function",
                    function: {
                      name: "get_current_weather",
                      arguments: '{"location":',
                    },
                  },
                ],
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool]);

    const response = await model.invoke("What's the weather in SF?");
    expect(response.tool_calls).toHaveLength(1);
    expect(response.tool_calls?.[0]?.name).toBe("get_current_weather");
    expect(response.invalid_tool_calls).toHaveLength(1);
    expect(response.additional_kwargs.tool_calls).toHaveLength(2);
    expect(response.usage_metadata).toEqual({
      input_tokens: 3,
      output_tokens: 4,
      total_tokens: 7,
    });
  });

  test("stream yields chunks containing parsed tool calls", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-3",
          usage: {
            input_tokens: 3,
            output_tokens: 1,
            total_tokens: 4,
          },
          output: {
            choices: [
              {
                finish_reason: "null",
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_3",
                      type: "function",
                      index: 0,
                      function: {
                        name: "get_current_weather",
                        arguments: '{"location":"Hangzhou"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          request_id: "req-3",
          usage: {
            input_tokens: 3,
            output_tokens: 2,
            total_tokens: 5,
          },
          output: {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "Done.",
                },
              },
            ],
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool]);

    const stream = await model.stream("What's the weather in Hangzhou?");
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(
      chunks.some((chunk) =>
        chunk.tool_call_chunks?.some(
          (toolCallChunk) => toolCallChunk.type === "tool_call_chunk"
        )
      )
    ).toBe(true);
    expect(
      chunks.some((chunk) =>
        chunk.tool_calls?.some(
          (toolCall) => toolCall.name === "get_current_weather"
        )
      )
    ).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.response_metadata?.request_id === "req-3" ||
          chunk.response_metadata?.requestId === "req-3"
      )
    ).toBe(true);
    expect(
      chunks.some((chunk) => chunk.usage_metadata?.total_tokens === 5)
    ).toBe(true);
  });

  test("serializes assistant tool calls and tool result messages in multi-turn payload", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-serialize-1",
        usage: {
          input_tokens: 4,
          output_tokens: 1,
          total_tokens: 5,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Thanks!",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool]);

    const assistantMessage = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_weather_1",
          type: "tool_call",
          name: "get_current_weather",
          args: { location: "San Francisco" },
        },
      ],
    });
    const toolMessage = new ToolMessage({
      content: '{"temperature":20}',
      tool_call_id: "call_weather_1",
    });

    await model.invoke([assistantMessage, toolMessage]);

    const body = getRequestBody(fetchMock);
    expect(body.input.messages[0].role).toBe("assistant");
    expect(body.input.messages[0].tool_calls?.[0]?.function?.name).toBe(
      "get_current_weather"
    );
    expect(body.input.messages[0].tool_calls?.[0]?.function?.arguments).toBe(
      '{"location":"San Francisco"}'
    );
    expect(body.input.messages[1].role).toBe("tool");
    expect(body.input.messages[1].tool_call_id).toBe("call_weather_1");
  });

  test("forwards tool_choice none through bindTools", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-tool-choice-none",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "No tools called.",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: "none",
    });

    await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.tool_choice).toBe("none");
  });

  test("forwards object tool_choice unchanged", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-tool-choice-object",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Tool selected.",
              },
            },
          ],
        },
      })
    );

    const forcedToolChoice = {
      type: "function",
      function: { name: "get_current_weather" },
    };

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: forcedToolChoice,
    });

    await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.tool_choice).toEqual(forcedToolChoice);
  });

  test("normalizes string tool_choice to forced function tool choice", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-tool-choice-string",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Tool selected.",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: "get_current_weather",
    });

    await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.tool_choice).toEqual({
      type: "function",
      function: { name: "get_current_weather" },
    });
  });

  test("maps tool_choice any to auto for compatibility", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-tool-choice-any",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: "any",
    });

    try {
      await model.invoke("hello");
      const body = getRequestBody(fetchMock);
      expect(body.parameters.tool_choice).toBe("auto");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('received tool_choice="any"')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to "auto"')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("maps tool_choice required to auto for compatibility", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-tool-choice-required",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: "required" as unknown as "auto",
    });

    try {
      await model.invoke("hello");
      const body = getRequestBody(fetchMock);
      expect(body.parameters.tool_choice).toBe("auto");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('received tool_choice="required"')
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to "auto"')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test("non-stream response uses first choice when multiple choices are returned", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-multi-choice-first",
        usage: {
          input_tokens: 2,
          output_tokens: 2,
          total_tokens: 4,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "First choice",
              },
            },
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Second choice",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const result = await model.invoke("hello");
    expect(result.content).toBe("First choice");
  });

  test("rejects malformed tool_choice object", async () => {
    const malformedToolChoice = {
      type: "function",
      function: {},
    } as unknown as "auto";

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      tool_choice: malformedToolChoice,
    });

    await expect(model.invoke("hello")).rejects.toThrow(
      "Unsupported tool_choice value for ChatAlibabaTongyi"
    );
  });

  test("stream assembles partial tool call deltas to full arguments", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-stream-delta",
          usage: {
            input_tokens: 2,
            output_tokens: 1,
            total_tokens: 3,
          },
          output: {
            choices: [
              {
                finish_reason: "null",
                delta: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_9",
                      type: "function",
                      function: {
                        name: "get_current_weather",
                        arguments: '{"location":"Hang',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          request_id: "req-stream-delta",
          usage: {
            input_tokens: 2,
            output_tokens: 2,
            total_tokens: 4,
          },
          output: {
            choices: [
              {
                finish_reason: "tool_calls",
                delta: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      index: 0,
                      function: {
                        arguments: 'zhou"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool]);

    const stream = await model.stream("What's the weather?");
    const chunks = [];
    let aggregated;
    for await (const chunk of stream) {
      chunks.push(chunk);
      aggregated = aggregated ? aggregated.concat(chunk) : chunk;
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(
      chunks.some((chunk) => (chunk.tool_call_chunks?.length ?? 0) > 0)
    ).toBe(true);
    expect(
      aggregated?.tool_calls?.some(
        (toolCall) =>
          toolCall.name === "get_current_weather" &&
          toolCall.args.location === "Hangzhou"
      )
    ).toBe(true);
    expect(
      aggregated?.tool_call_chunks?.some(
        (toolCallChunk) =>
          toolCallChunk.name === "get_current_weather" &&
          toolCallChunk.args === '{"location":"Hangzhou"}'
      )
    ).toBe(true);
    expect(chunks.at(-1)?.response_metadata?.finish_reason).toBe("tool_calls");
    expect(chunks.at(-1)?.usage_metadata?.total_tokens).toBe(4);
  });

  test("throws on non-stream API error response", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        code: "InvalidInput",
        message: "Bad request",
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    await expect(model.invoke("hello")).rejects.toThrow("Bad request");
  });

  test("throws on stream API error chunk", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          code: "DataInspectionFailed",
          message: "Output data may contain inappropriate content.",
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      streaming: true,
    });

    await expect(model.invoke("hello")).rejects.toThrow(
      "Output data may contain inappropriate content."
    );
  });

  test("streaming invoke resolves even when stream ends without terminal finish reason", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-no-terminal-finish",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
          },
          output: {
            choices: [
              {
                finish_reason: "null",
                message: {
                  role: "assistant",
                  content: "partial answer",
                },
              },
            ],
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      streaming: true,
    });

    const result = await model.invoke("hello");
    expect(result.content).toBe("partial answer");
  });

  test("withConfig supports pre-formatted tools and preserves request schema", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-with-config-tools",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).withConfig({
      tools: [weatherTool],
    });

    await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.tools?.[0]?.type).toBe("function");
    expect(body.parameters.tools?.[0]?.function.name).toBe(
      "get_current_weather"
    );
  });

  test("serializes parallel_tool_calls via bindTools and withConfig", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-parallel-bindtools",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const bindToolsModel = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).bindTools([weatherTool], {
      parallel_tool_calls: true,
    });

    await bindToolsModel.invoke("hello");
    const bindToolsBody = getRequestBody(fetchMock);
    expect(bindToolsBody.parameters.parallel_tool_calls).toBe(true);

    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-parallel-withconfig",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const withConfigModel = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    }).withConfig({
      tools: [weatherTool],
      parallel_tool_calls: false,
    });

    await withConfigModel.invoke("hello");
    const withConfigBody = getRequestBody(fetchMock);
    expect(withConfigBody.parameters.parallel_tool_calls).toBe(false);
  });

  test("serializes parallelToolCalls constructor alias", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-parallel-camelcase",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ok",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      parallelToolCalls: true,
    }).bindTools([weatherTool]);

    await model.invoke("hello");
    const body = getRequestBody(fetchMock);
    expect(body.parameters.parallel_tool_calls).toBe(true);
  });

  test("sends DashScope SSE header for streaming requests", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-sse-header",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
          },
          output: {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "ok",
                },
              },
            ],
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      streaming: true,
    });

    await model.invoke("hello");
    const headers = getRequestHeaders(fetchMock);
    expect(headers.get("Accept")).toBe("text/event-stream");
    expect(headers.get("X-DashScope-SSE")).toBe("enable");
  });

  test("sends DashScope SSE header for stream() path", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-sse-stream-path",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
          },
          output: {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "ok",
                },
              },
            ],
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const stream = await model.stream("hello");
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("ok");
    const headers = getRequestHeaders(fetchMock);
    expect(headers.get("Accept")).toBe("text/event-stream");
    expect(headers.get("X-DashScope-SSE")).toBe("enable");
  });

  test("withStructuredOutput parses tool call arguments", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-structured-output",
        usage: {
          input_tokens: 2,
          output_tokens: 3,
          total_tokens: 5,
        },
        output: {
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_structured_1",
                    type: "function",
                    function: {
                      name: "extract_weather",
                      arguments:
                        '{"location":"San Francisco","unit":"celsius"}',
                    },
                  },
                ],
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const structured = model.withStructuredOutput(
      {
        type: "object",
        properties: {
          location: { type: "string" },
          unit: { type: "string" },
        },
        required: ["location", "unit"],
      },
      { name: "extract_weather" }
    );

    const result = await structured.invoke("Extract weather payload.");
    expect(result).toEqual({
      location: "San Francisco",
      unit: "celsius",
    });
    const body = getRequestBody(fetchMock);
    expect(body.parameters.tools?.[0]?.function.name).toBe("extract_weather");
    expect(body.parameters.result_format).toBe("message");
  });

  test("withStructuredOutput includeRaw returns raw and parsed", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-structured-output-raw",
        usage: {
          input_tokens: 2,
          output_tokens: 3,
          total_tokens: 5,
        },
        output: {
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_structured_2",
                    type: "function",
                    function: {
                      name: "extract_weather",
                      arguments: '{"location":"Hangzhou","unit":"celsius"}',
                    },
                  },
                ],
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const structuredWithRaw = model.withStructuredOutput(
      {
        type: "object",
        properties: {
          location: { type: "string" },
          unit: { type: "string" },
        },
        required: ["location", "unit"],
      },
      { name: "extract_weather", includeRaw: true }
    );

    const result = await structuredWithRaw.invoke("Extract weather payload.");
    expect(result.parsed).toEqual({
      location: "Hangzhou",
      unit: "celsius",
    });
    expect(result.raw._getType()).toBe("ai");
  });

  test("withStructuredOutput throws when no tool calls are returned", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-structured-output-no-tool-calls",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "No function call made",
              },
            },
          ],
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const structured = model.withStructuredOutput(
      {
        type: "object",
        properties: {
          location: { type: "string" },
        },
        required: ["location"],
      },
      { name: "extract_weather" }
    );

    await expect(structured.invoke("Extract weather payload.")).rejects.toThrow(
      "No tool calls found in the response."
    );
  });

  test("stream handles non-tool text chunks via output.text fallback", async () => {
    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-stream-text-fallback",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
          },
          output: {
            text: "Hello ",
            finish_reason: "null",
          },
        },
        {
          request_id: "req-stream-text-fallback",
          usage: {
            input_tokens: 1,
            output_tokens: 2,
            total_tokens: 3,
          },
          output: {
            text: "world",
            finish_reason: "stop",
          },
        },
      ])
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
    });

    const stream = await model.stream("hello");
    const chunks = [];
    let concatenated = "";
    for await (const chunk of stream) {
      chunks.push(chunk);
      concatenated += chunk.content as string;
    }

    expect(chunks).toHaveLength(2);
    expect(concatenated).toBe("Hello world");
    expect(chunks[0].tool_call_chunks).toEqual([]);
    expect(chunks.at(-1)?.response_metadata?.finish_reason).toBe("stop");
  });

  test("repetition_penalty is sent only in non-streaming mode", async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        request_id: "req-repetition-non-stream",
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
        output: {
          text: "ok",
          finish_reason: "stop",
        },
      })
    );

    const model = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      repetitionPenalty: 1.1,
      streaming: false,
    });

    await model.invoke("hello");
    const nonStreamingBody = getRequestBody(fetchMock);
    expect(nonStreamingBody.parameters.repetition_penalty).toBe(1.1);

    fetchMock.mockResolvedValue(
      createSseResponse([
        {
          request_id: "req-repetition-stream",
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
          },
          output: {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "ok",
                },
              },
            ],
          },
        },
      ])
    );

    const streamingModel = new ChatAlibabaTongyi({
      alibabaApiKey: "test-api-key",
      repetitionPenalty: 1.1,
      streaming: true,
    });
    await streamingModel.invoke("hello");
    const streamingBody = getRequestBody(fetchMock);
    expect(streamingBody.parameters.repetition_penalty).toBeUndefined();
    expect(streamingBody.parameters.incremental_output).toBe(true);
  });
});
