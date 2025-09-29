import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { createAgent } from "../../index.js";
import { inputGuardrailsMiddleware } from "../inputGuardrails.js";

describe("inputGuardrailsMiddleware Integration", () => {
  it("should integrate with agent and redact PII from user messages", async () => {
    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [inputGuardrailsMiddleware()],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("My SSN is 123-45-6789 and email is john@example.com"),
      ],
    });

    // The human message should be redacted
    const humanMessage = result.messages.find(HumanMessage.isInstance);
    expect(humanMessage?.content).toContain("[REDACTED_SSN]");
    expect(humanMessage?.content).toContain("[REDACTED_EMAIL]");
    expect(humanMessage?.content).not.toContain("123-45-6789");
    expect(humanMessage?.content).not.toContain("john@example.com");

    // The AI should respond appropriately to the redacted input
    const aiMessage = result.messages[result.messages.length - 1];
    expect(aiMessage.content).toBeDefined();
  });

  it("should work with custom PII rules", async () => {
    const customRule = {
      name: "employee_id",
      description: "Employee ID numbers",
      pattern: /EMP-\d{6}/g,
      replacement: "[REDACTED_EMPLOYEE_ID]",
      enabled: true,
    };

    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [
        inputGuardrailsMiddleware({
          rules: [customRule],
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("Employee EMP-123456 needs access to the system"),
      ],
    });

    const humanMessage = result.messages.find(HumanMessage.isInstance);
    expect(humanMessage?.content).toContain("[REDACTED_EMPLOYEE_ID]");
    expect(humanMessage?.content).not.toContain("EMP-123456");
  });

  it("should work with custom detection functions", async () => {
    const customDetector = (text: string) => {
      return text.replace(
        /Project Codename: \w+/g,
        "Project Codename: [REDACTED]"
      );
    };

    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [
        inputGuardrailsMiddleware({
          rules: [], // No regex rules
          customDetectors: [customDetector],
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("Project Codename: Phoenix is highly classified"),
      ],
    });

    const humanMessage = result.messages.find(HumanMessage.isInstance);
    expect(humanMessage?.content).toContain("Project Codename: [REDACTED]");
    expect(humanMessage?.content).not.toContain("Project Codename: Phoenix");
  });

  it("should not modify messages without PII", async () => {
    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [inputGuardrailsMiddleware()],
    });

    const originalMessage =
      "This is a clean message with no sensitive information";
    const result = await agent.invoke({
      messages: [new HumanMessage(originalMessage)],
    });

    // Find the human message in the result (it should be unchanged)
    const humanMessage = result.messages.find(HumanMessage.isInstance);
    expect(humanMessage?.content).toBe(originalMessage);
  });

  it("should preserve message order and types", async () => {
    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [inputGuardrailsMiddleware()],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("First message with SSN 123-45-6789"),
        new HumanMessage("Second clean message"),
        new HumanMessage("Third message with email john@example.com"),
      ],
    });

    // Should have original messages plus AI response
    expect(result.messages.length).toBeGreaterThan(3);

    // Check that PII was redacted in the appropriate messages
    const firstHuman = result.messages[0];
    const secondHuman = result.messages[1];
    const thirdHuman = result.messages[2];

    expect(firstHuman.content).toContain("[REDACTED_SSN]");
    expect(firstHuman.content).not.toContain("123-45-6789");

    expect(secondHuman.content).toBe("Second clean message");

    expect(thirdHuman.content).toContain("[REDACTED_EMAIL]");
    expect(thirdHuman.content).not.toContain("john@example.com");
  });

  it("should allow to use a custom model for PII detection and only process new messages", async () => {
    const fetchResponse = vi
      .fn()
      .mockImplementation((response) => response.clone());
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      return fetch(url, options).then(fetchResponse);
    });

    const model = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0,
      configuration: {
        fetch: fetchMock,
      },
    });

    const agent = createAgent({
      model: "openai:gpt-4o",
      tools: [],
      middleware: [
        inputGuardrailsMiddleware({
          model,
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("First message with SSN 123-45-6789"),
        new HumanMessage("Second clean message"),
        new HumanMessage("Third message with email john@example.com"),
      ],
    });

    // Should have original messages plus AI response
    expect(result.messages.length).toBeGreaterThan(3);

    // Check that PII was redacted in the appropriate messages
    const firstHuman = result.messages[0];
    const secondHuman = result.messages[1];
    const thirdHuman = result.messages[2];

    expect(firstHuman.content).toContain("[REDACTED_SSN]");
    expect(firstHuman.content).not.toContain("123-45-6789");

    expect(secondHuman.content).toBe("Second clean message");

    expect(thirdHuman.content).toContain("[REDACTED_EMAIL]");
    expect(thirdHuman.content).not.toContain("john@example.com");

    expect(fetchMock.mock.calls.length).toBe(3);
  });
});
