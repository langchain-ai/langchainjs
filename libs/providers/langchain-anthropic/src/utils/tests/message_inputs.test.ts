import { describe, expect, test } from "vitest";
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

  test("omits the system key entirely when there is no leading system message", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
    ]);

    expect(payload.messages).toEqual([
      { role: "user", content: "Review foo()" },
    ]);
    expect("system" in payload).toBe(false);
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

  test("collapses consecutive non-leading system messages into one entry", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new HumanMessage("Review foo()"),
      new SystemMessage("Be concise."),
      new SystemMessage("Include type annotations."),
    ]);

    expect(payload).toEqual({
      messages: [
        { role: "user", content: "Review foo()" },
        {
          role: "system",
          content: [
            { type: "text", text: "Be concise." },
            { type: "text", text: "Include type annotations." },
          ],
        },
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

  test("passes non-text system blocks through untouched", () => {
    const documentBlock = {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: "Style guide" },
      title: "Style guide",
    };
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage({ content: [documentBlock] }),
      new HumanMessage("Review foo()"),
      new SystemMessage({ content: [documentBlock] }),
    ]);

    expect(payload).toEqual({
      system: [documentBlock],
      messages: [
        { role: "user", content: "Review foo()" },
        { role: "system", content: [documentBlock] },
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
      system: [],
      messages: [{ role: "user", content: "Review foo()" }],
    });
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
