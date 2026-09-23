import { describe, expect, test, vi } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { _convertMessagesToAnthropicPayload } from "../message_inputs.js";
import { convertPromptToAnthropic } from "../prompts.js";

describe("system messages", () => {
  test("hoists a single leading system message as a plain string", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage("You are a code reviewer."),
      new HumanMessage("Review foo()"),
    ]);

    expect(payload).toEqual({
      system: "You are a code reviewer.",
      messages: [{ role: "user", content: "Review foo()" }],
    });
  });

  test("merges a leading run of system messages into a block array", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage("You are a code reviewer."),
      new SystemMessage("Be concise."),
      new HumanMessage("Review foo()"),
    ]);

    expect(payload).toEqual({
      system: [
        { type: "text", text: "You are a code reviewer." },
        { type: "text", text: "Be concise." },
      ],
      messages: [{ role: "user", content: "Review foo()" }],
    });
  });

  test("sends a trailing system message in place", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
      new AIMessage("Looks good."),
      new HumanMessage("Review bar()"),
      new SystemMessage("Every suggestion must include type annotations."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "assistant", content: "Looks good." },
        { role: "user", content: "Review bar()" },
        {
          role: "system",
          content: "Every suggestion must include type annotations.",
        },
      ],
    });
  });

  test("sends a system message between a user turn and an assistant turn in place", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
      new SystemMessage("Be concise."),
      new AIMessage("Looks good."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: "Be concise." },
        { role: "assistant", content: "Looks good." },
      ],
    });
  });

  test("sends a system message after the user turn a tool result folds into", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("What is the weather in SF?"),
      new AIMessage({
        content: "",
        tool_calls: [
          { name: "get_weather", id: "weather_call", args: { location: "SF" } },
        ],
      }),
      new ToolMessage({
        name: "get_weather",
        tool_call_id: "weather_call",
        content: "24 degrees with hail.",
      }),
      new SystemMessage("Answer in Celsius from now on."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "What is the weather in SF?" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "weather_call",
              name: "get_weather",
              input: { location: "SF" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              content: "24 degrees with hail.",
              tool_use_id: "weather_call",
            },
          ],
        },
        { role: "system", content: "Answer in Celsius from now on." },
      ],
    });
  });

  test("hoists the leading run and leaves a later system message in place", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage("You are a code reviewer."),
      new SystemMessage("Be concise."),
      new HumanMessage("Review foo()"),
      new SystemMessage("Every suggestion must include type annotations."),
    ]);

    expect(payload).toEqual({
      system: [
        { type: "text", text: "You are a code reviewer." },
        { type: "text", text: "Be concise." },
      ],
      messages: [
        { role: "user", content: "Review foo()" },
        {
          role: "system",
          content: "Every suggestion must include type annotations.",
        },
      ],
    });
  });

  test("sends several non-adjacent system messages at their own positions", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
      new SystemMessage("Be concise."),
      new AIMessage("Looks good."),
      new HumanMessage("Review bar()"),
      new SystemMessage("Include type annotations."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: "Be concise." },
        { role: "assistant", content: "Looks good." },
        { role: "user", content: "Review bar()" },
        { role: "system", content: "Include type annotations." },
      ],
    });
  });

  test("sends consecutive non-leading system messages as separate entries", () => {
    // Anthropic already treats a run of `role: "system"` entries as a single
    // system section, so there is nothing to gain by merging them here. Sending
    // them as written also keeps per-message fields addressable, which a merge
    // would drop from every message after the first.
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
      new SystemMessage("Be concise."),
      new SystemMessage("Include type annotations."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: "Be concise." },
        { role: "system", content: "Include type annotations." },
      ],
    });
  });

  test("preserves cache_control on hoisted and in-place system blocks", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({
        content: [
          {
            type: "text",
            text: "You are a code reviewer.",
            cache_control: { type: "ephemeral" },
          },
        ],
      }),
      new HumanMessage("Review foo()"),
      new SystemMessage({
        content: [
          {
            type: "text",
            text: "Include type annotations.",
            cache_control: { type: "ephemeral" },
          },
        ],
      }),
    ]);

    expect(payload).toEqual({
      system: [
        {
          type: "text",
          text: "You are a code reviewer.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: "Review foo()" },
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "Include type annotations.",
              cache_control: { type: "ephemeral" },
            },
          ],
        },
      ],
    });
  });

  test("strips framework-internal fields from standard content blocks", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({
        content: [
          {
            type: "text",
            text: "You are a code reviewer.",
            id: "lc-0aa4f1a0",
            index: 0,
          },
        ],
      }),
      new HumanMessage("Review foo()"),
      new SystemMessage({
        content: [
          {
            type: "text",
            text: "Include type annotations.",
            id: "lc-6b2c9d31",
            index: 1,
          },
        ],
      }),
    ]);

    expect(payload).toEqual({
      system: [{ type: "text", text: "You are a code reviewer." }],
      messages: [
        { role: "user", content: "Review foo()" },
        {
          role: "system",
          content: [{ type: "text", text: "Include type annotations." }],
        },
      ],
    });
  });

  test("drops an unrecognized system block with a warning", () => {
    // Anthropic accepts a closed set of system content blocks, so anything
    // else would be rejected by the provider.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const documentBlock = {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: "Style guide" },
      title: "Style guide",
    };
    const text = { type: "text" as const, text: "Follow the style guide." };
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({ content: [text, documentBlock] }),
      new HumanMessage("Review foo()"),
      new SystemMessage({
        content: [text, { type: "non_standard", value: documentBlock }],
      }),
    ]);

    expect(payload).toEqual({
      system: [text],
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: [text] },
      ],
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"document"'));
    warn.mockRestore();
  });

  test("coerces a bare string entry to a text block", () => {
    const content = ["Be concise."] as unknown as SystemMessage["content"];
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({ content }),
      new HumanMessage("Review foo()"),
      new SystemMessage({ content }),
    ]);

    expect(payload).toEqual({
      system: [{ type: "text", text: "Be concise." }],
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: [{ type: "text", text: "Be concise." }] },
      ],
    });
  });

  test("emits a placement the provider forbids as written", () => {
    // A system message immediately followed by a user turn is a 400 from the
    // provider. The converter neither throws nor relocates it: it sends what
    // the caller wrote and lets the provider be the one to object.
    const convert = () =>
      _convertMessagesToAnthropicPayload([
        new HumanMessage("Review foo()"),
        new SystemMessage("Be concise."),
        new HumanMessage("Review bar()"),
      ]);

    expect(convert).not.toThrow();
    expect(convert()).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: "Be concise." },
        { role: "user", content: "Review bar()" },
      ],
    });
  });

  test("does not crash on a system message with no content", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({ content: undefined as unknown as string }),
      new HumanMessage("Review foo()"),
    ]);

    expect(payload).toEqual({
      messages: [{ role: "user", content: "Review foo()" }],
    });
    expect(payload.system).toBeUndefined();
  });

  test("omits system content that narrows to nothing", () => {
    // The provider rejects a system turn with empty content, and the dropped
    // blocks have already been warned about.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unrecognized = { type: "document", title: "Style guide" };
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({ content: [unrecognized] }),
      new HumanMessage("Review foo()"),
      new SystemMessage({ content: [unrecognized] }),
      new AIMessage("Looks good."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "assistant", content: "Looks good." },
      ],
    });
    expect(payload.system).toBeUndefined();
    warn.mockRestore();
  });

  test("convertPromptToAnthropic follows the same rule", () => {
    const messages = [
      new SystemMessage("You are a code reviewer."),
      new HumanMessage("Review foo()"),
      new SystemMessage("Include type annotations."),
    ];

    const { system, messages: converted } = convertPromptToAnthropic(
      new ChatPromptValue(messages)
    );

    expect({ system, messages: converted }).toEqual(
      _convertMessagesToAnthropicPayload(messages)
    );
    expect(converted).toEqual([
      { role: "user", content: "Review foo()" },
      { role: "system", content: "Include type annotations." },
    ]);
  });
});

describe("tool-change blocks", () => {
  const toolRemoval = {
    type: "tool_removal",
    tool: { type: "tool_reference", name: "get_weather" },
  };
  const toolAddition = {
    type: "tool_addition",
    tool: { type: "tool_reference", name: "get_forecast" },
  };
  const inlineToolAddition = {
    type: "tool_addition",
    tool: {
      type: "tool_definition",
      definition: {
        name: "db_query",
        description:
          "Run a read-only SQL query against the analytics database.",
        input_schema: {
          type: "object",
          properties: { sql: { type: "string" } },
          required: ["sql"],
        },
      },
    },
  };

  test("does not mutate the input messages", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = [
      { type: "text", text: "Tools changed.", id: "lc-1" },
      { type: "non_standard", value: toolRemoval },
      { type: "document", title: "Style guide" },
    ];
    const messages = [
      new SystemMessage({ content: structuredClone(content) }),
      new HumanMessage("Review foo()"),
      new SystemMessage({ content: structuredClone(content) }),
    ];

    _convertMessagesToAnthropicPayload(messages);

    expect(messages[0].content).toEqual(content);
    expect(messages[2].content).toEqual(content);
    warn.mockRestore();
  });

  describe.each([
    ["tool_removal", toolRemoval],
    ["tool_addition", toolAddition],
    ["tool_addition with an inline definition", inlineToolAddition],
  ])("%s", (_name, block) => {
    const text = { type: "text" as const, text: "Tools changed." };
    const spellings = {
      bare: () => new SystemMessage({ content: [text, block] }),
      wrapped: () =>
        new SystemMessage({
          content: [text, { type: "non_standard", value: block }],
        }),
      contentBlocks: () =>
        new SystemMessage({
          contentBlocks: [text, { type: "non_standard", value: block }],
        }),
    };

    test.each(Object.entries(spellings))(
      "forwards a %s block in the hoisted leading run to the top-level system field",
      (_spelling, makeMessage) => {
        // Anthropic rejects tool-change blocks outside an in-place system
        // turn. The converter neither throws nor drops them: it sends what the
        // caller wrote and lets the provider be the one to object.
        const payload = _convertMessagesToAnthropicPayload([
          new SystemMessage("You are a code reviewer."),
          makeMessage(),
          new HumanMessage("Review foo()"),
        ]);

        expect(payload).toEqual({
          system: [
            { type: "text", text: "You are a code reviewer." },
            text,
            block,
          ],
          messages: [{ role: "user", content: "Review foo()" }],
        });
      }
    );

    test.each(Object.entries(spellings))(
      "sends a %s block in place, verbatim, beside text",
      (_spelling, makeMessage) => {
        const payload = _convertMessagesToAnthropicPayload([
          new HumanMessage("Review foo()"),
          makeMessage(),
        ]);

        expect(payload).toEqual({
          messages: [
            { role: "user", content: "Review foo()" },
            { role: "system", content: [text, block] },
          ],
        });
      }
    );
  });
});

describe("non-system content is unaffected by system narrowing", () => {
  test("sends a native image block on a human message", () => {
    const image = {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo" },
    };
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage({ content: [image] }),
    ]);

    expect(payload.messages).toEqual([{ role: "user", content: [image] }]);
  });

  test("drops an unrecognized block on a human message without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage({
        content: [
          { type: "text", text: "Review foo()" },
          { type: "document_ref", id: "doc_1" },
        ],
      }),
    ]);

    expect(payload.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Review foo()" }] },
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("replays a wrapped block on an Anthropic v1 AI message", () => {
    const block = {
      type: "future_search_tool_result",
      tool_use_id: "srvtoolu_1",
      content: [],
    };
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Search"),
      new AIMessage({
        contentBlocks: [{ type: "non_standard", value: block }],
        response_metadata: { model_provider: "anthropic" },
      }),
    ]);

    expect(payload.messages).toEqual([
      { role: "user", content: "Search" },
      { role: "assistant", content: [block] },
    ]);
  });
});
