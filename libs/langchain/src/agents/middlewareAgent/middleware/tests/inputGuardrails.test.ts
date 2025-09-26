/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  inputGuardrailsMiddleware,
  DEFAULT_PII_RULES,
  type PIIRule,
  type PIIDetectionFunction,
} from "../inputGuardrails.js";
import type { AgentBuiltInState, Runtime } from "../../types.js";

function createMockModel(name = "ChatAnthropic", modelType = "anthropic") {
  // Mock model that replaces "John Doe" with "[REDACTED_NAME]"
  const invokeCallback = vi.fn().mockImplementation((messages: any[]) => {
    // Find the user message (should be the second message after system prompt)
    const userMessage = messages.find(
      (m, index) =>
        (m.role === "user" || m._getType?.() === "human") && index > 0
    );
    const content = userMessage?.content || "";
    const processedContent =
      typeof content === "string"
        ? content.replace("John Doe", "[REDACTED_NAME]")
        : content;
    return Promise.resolve(new AIMessage(processedContent));
  });

  return {
    getName: () => name,
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: modelType,
    _generate: vi.fn(),
    _llmType: () => modelType,
  } as unknown as LanguageModelLike;
}

describe("inputGuardrailsMiddleware", () => {
  let mockState: AgentBuiltInState;
  let mockRuntime: Runtime<any, any>;

  beforeEach(() => {
    mockState = {
      messages: [],
    };
    mockRuntime = {
      context: {},
    } as Runtime<any, any>;
  });

  describe("Default PII Rules", () => {
    it("should redact Social Security Numbers", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("My SSN is 123-45-6789");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("My SSN is [REDACTED_SSN]");
    });

    it("should redact phone numbers", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("Call me at (555) 123-4567");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("Call me at [REDACTED_PHONE]");
    });

    it("should redact email addresses", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("Email me at john@example.com");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("Email me at [REDACTED_EMAIL]");
    });

    it("should redact credit card numbers", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("My card is 4532123456789012");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "My card is [REDACTED_CREDIT_CARD]"
      );
    });

    it("should redact IP addresses", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("Server IP is 192.168.1.1");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("Server IP is [REDACTED_IP]");
    });

    it("should handle multiple PII types in one message", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage(
        "My SSN is 123-45-6789, email is john@example.com, and phone is (555) 123-4567"
      );
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "My SSN is [REDACTED_SSN], email is [REDACTED_EMAIL], and phone is [REDACTED_PHONE]"
      );
    });
  });

  describe("Custom Rules", () => {
    it("should apply custom PII rules", async () => {
      const customRule: PIIRule = {
        name: "employee_id",
        description: "Employee ID numbers",
        pattern: /EMP-\d{6}/g,
        replacement: "[REDACTED_EMPLOYEE_ID]",
        enabled: true,
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [customRule],
      });

      const humanMessage = new HumanMessage("Employee EMP-123456 needs access");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "Employee [REDACTED_EMPLOYEE_ID] needs access"
      );
    });

    it("should respect disabled rules", async () => {
      const disabledRule: PIIRule = {
        name: "ssn",
        description: "Social Security Numbers",
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: "[REDACTED_SSN]",
        enabled: false,
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [disabledRule],
      });

      const humanMessage = new HumanMessage("My SSN is 123-45-6789");
      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      // Should return undefined since no changes were made
      expect(result).toBeUndefined();
    });
  });

  describe("Custom Detection Functions", () => {
    it("should apply custom detection functions", async () => {
      const customDetector: PIIDetectionFunction = (text: string) => {
        return text.replace(
          /Project Codename: \w+/g,
          "Project Codename: [REDACTED]"
        );
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [], // No regex rules
        customDetectors: [customDetector],
      });

      const humanMessage = new HumanMessage(
        "Project Codename: Phoenix is classified"
      );
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "Project Codename: [REDACTED] is classified"
      );
    });

    it("should apply multiple custom detection functions sequentially", async () => {
      const detector1: PIIDetectionFunction = (text: string) => {
        return text.replace(/SECRET-\d+/g, "[REDACTED_SECRET]");
      };

      const detector2: PIIDetectionFunction = (text: string) => {
        return text.replace(/CLASSIFIED-\w+/g, "[REDACTED_CLASSIFIED]");
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [],
        customDetectors: [detector1, detector2],
        parallel: false, // Sequential processing
      });

      const humanMessage = new HumanMessage(
        "Document SECRET-123 and CLASSIFIED-ALPHA"
      );
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "Document [REDACTED_SECRET] and [REDACTED_CLASSIFIED]"
      );
    });

    it("should handle async custom detection functions", async () => {
      const asyncDetector: PIIDetectionFunction = async (text: string) => {
        // Simulate async processing
        await new Promise((resolve) => setTimeout(resolve, 1));
        return text.replace(/ASYNC-\d+/g, "[REDACTED_ASYNC]");
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [],
        customDetectors: [asyncDetector],
      });

      const humanMessage = new HumanMessage("Reference ASYNC-456");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("Reference [REDACTED_ASYNC]");
    });
  });

  describe("AI-Powered Detection", () => {
    it("should use AI model for PII detection", async () => {
      const mockModel = createMockModel();

      const middleware = inputGuardrailsMiddleware({
        rules: [], // No regex rules
        model: mockModel,
      });

      const humanMessage = new HumanMessage("My name is John Doe");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("My name is [REDACTED_NAME]");
    });

    it("should handle AI model errors gracefully", async () => {
      const failingModel = {
        invoke: vi.fn().mockRejectedValue(new Error("AI model failed")),
      } as unknown as LanguageModelLike;

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const middleware = inputGuardrailsMiddleware({
        rules: [],
        model: failingModel,
      });

      const humanMessage = new HumanMessage("Test content");
      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      // Should return undefined since no changes were made (AI failed, no regex rules)
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        "AI PII detection failed, returning original text:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Message Processing", () => {
    it("should only process HumanMessage instances", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("My SSN is 123-45-6789");
      const aiMessage = new AIMessage("I can help with that");

      mockState.messages = [humanMessage, aiMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages!).toHaveLength(2);
      expect(result!.messages![0].content).toBe("My SSN is [REDACTED_SSN]");
      expect(result!.messages![1].content).toBe("I can help with that"); // Unchanged
    });

    it("should skip non-string content", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage({
        type: "image_url",
        image_url: { url: "data:image/jpeg;base64,..." },
      } as any);

      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      // Should return undefined since no string content to process
      expect(result).toBeUndefined();
    });

    it("should preserve message metadata", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage({
        content: "My SSN is 123-45-6789",
        id: "test-id",
        name: "test-user",
        additional_kwargs: { custom: "data" },
      });

      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      const processedMessage = result!.messages![0] as HumanMessage;
      expect(processedMessage.content).toBe("My SSN is [REDACTED_SSN]");
      expect(processedMessage.id).toBe("test-id");
      expect(processedMessage.name).toBe("test-user");
      expect(processedMessage.additional_kwargs).toEqual({ custom: "data" });
    });
  });

  describe("Configuration", () => {
    it("should use context configuration over options", async () => {
      const customRule: PIIRule = {
        name: "test",
        description: "Test rule",
        pattern: /TEST-\d+/g,
        replacement: "[REDACTED_TEST]",
        enabled: true,
      };

      // @ts-expect-error - mockRuntime.context is not typed
      mockRuntime.context = {
        rules: [customRule],
        logDetections: true,
      };

      const middleware = inputGuardrailsMiddleware({
        rules: DEFAULT_PII_RULES, // This should be overridden by context
        logDetections: false, // This should be overridden by context
      });

      const humanMessage = new HumanMessage("Reference TEST-123");
      mockState.messages = [humanMessage];

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe("Reference [REDACTED_TEST]");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Input Guardrails: Detected and redacted PII types: test"
      );

      consoleSpy.mockRestore();
    });

    it("should log detected PII types when enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const middleware = inputGuardrailsMiddleware({
        logDetections: true,
      });

      const humanMessage = new HumanMessage(
        "My SSN is 123-45-6789 and email is john@example.com"
      );
      mockState.messages = [humanMessage];

      await middleware.beforeModel!(mockState, mockRuntime);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Input Guardrails: Detected and redacted PII types:"
        )
      );

      consoleSpy.mockRestore();
    });

    it("should return undefined when no changes are made", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage(
        "This is a clean message with no PII"
      );
      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      expect(result).toBeUndefined();
    });
  });

  describe("Performance", () => {
    it("should handle large messages efficiently", async () => {
      const middleware = inputGuardrailsMiddleware();

      // Create a large message with PII scattered throughout
      const largeContent = Array(1000)
        .fill("Some text here. ")
        .join("")
        .replace(/Some text here\. /g, (match, index) => {
          // Add PII every 100th occurrence
          return index % 100 === 0 ? "My SSN is 123-45-6789. " : match;
        });

      const humanMessage = new HumanMessage(largeContent);
      mockState.messages = [humanMessage];

      const startTime = Date.now();
      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toContain("[REDACTED_SSN]");
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty messages", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("");
      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      expect(result).toBeUndefined();
    });

    it("should handle messages with only whitespace", async () => {
      const middleware = inputGuardrailsMiddleware();
      const humanMessage = new HumanMessage("   \n\t  ");
      mockState.messages = [humanMessage];

      const result = await middleware.beforeModel!(mockState, mockRuntime);

      expect(result).toBeUndefined();
    });

    it("should handle complex PII patterns", async () => {
      // Test with a complex but valid regex pattern
      const complexRule: PIIRule = {
        name: "complex",
        description: "Complex regex pattern",
        pattern:
          /(?:(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
        replacement: "[REDACTED_COMPLEX]",
        enabled: true,
      };

      const middleware = inputGuardrailsMiddleware({
        rules: [complexRule],
      });

      const humanMessage = new HumanMessage("Call me at +1 (555) 123-4567");
      mockState.messages = [humanMessage];

      const result = (await middleware.beforeModel!(
        mockState,
        mockRuntime
      )) as any;

      expect(result).toBeDefined();
      expect(result!.messages![0].content).toBe(
        "Call me at [REDACTED_COMPLEX]"
      );
    });
  });
});
