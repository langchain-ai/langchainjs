import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import {
  piiMiddleware,
  PIIDetectionError,
  detectEmail,
  detectCreditCard,
  detectIP,
  detectMacAddress,
  detectUrl,
  type PIIMatch,
} from "../pii.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";

describe("Email Detection", () => {
  it("should detect valid email", () => {
    const content = "Contact me at john.doe@example.com for more info.";
    const matches = detectEmail(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("john.doe@example.com");
    expect(matches[0].start).toBe(14);
    expect(matches[0].end).toBe(34);
  });

  it("should detect multiple emails", () => {
    const content = "Email alice@test.com or bob@company.org";
    const matches = detectEmail(content);

    expect(matches.length).toBe(2);
    expect(matches[0].text).toBe("alice@test.com");
    expect(matches[1].text).toBe("bob@company.org");
  });

  it("should not detect invalid email formats", () => {
    const content = "Invalid emails: @test.com, user@, user@domain";
    const matches = detectEmail(content);

    // Should not match invalid formats
    expect(matches.length).toBe(0);
  });

  it("should not detect when no email present", () => {
    const content = "This text has no email addresses.";
    const matches = detectEmail(content);

    expect(matches.length).toBe(0);
  });
});

describe("Credit Card Detection", () => {
  it("should detect valid credit card", () => {
    // Valid Visa test number
    const content = "Card: 4532015112830366";
    const matches = detectCreditCard(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toContain("4532015112830366");
  });

  it("should detect credit card with spaces", () => {
    // Valid Mastercard test number
    const spacedContent = "Card: 5425 2334 3010 9903";
    const matches = detectCreditCard(spacedContent);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toContain("5425");
  });

  it("should detect credit card with dashes", () => {
    const content = "Card: 4532-0151-1283-0366";
    const matches = detectCreditCard(content);

    expect(matches.length).toBe(1);
  });

  it("should not detect invalid Luhn checksum", () => {
    // Invalid Luhn checksum
    const content = "Card: 1234567890123456";
    const matches = detectCreditCard(content);

    expect(matches.length).toBe(0);
  });

  it("should not detect when no credit card present", () => {
    const content = "No cards here.";
    const matches = detectCreditCard(content);

    expect(matches.length).toBe(0);
  });

  it("detects multiple credit cards", () => {
    const content = "Card: 4532015112830366, Card: 5425233430109903";
    const matches = detectCreditCard(content);

    expect(matches.length).toBe(2);
    expect(matches[0].text).toContain("4532015112830366");
    expect(matches[1].text).toContain("5425233430109903");
  });
});

describe("IP Detection", () => {
  it("should detect valid IPv4", () => {
    const content = "Server IP: 192.168.1.1";
    const matches = detectIP(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("192.168.1.1");
  });

  it("should detect multiple IPs", () => {
    const content = "Connect to 10.0.0.1 or 8.8.8.8";
    const matches = detectIP(content);

    expect(matches.length).toBe(2);
    expect(matches[0].text).toBe("10.0.0.1");
    expect(matches[1].text).toBe("8.8.8.8");
  });

  it("should not detect invalid IP (out of range octets)", () => {
    const content = "Not an IP: 999.999.999.999";
    const matches = detectIP(content);

    expect(matches.length).toBe(0);
  });

  it("should not detect when no IP present", () => {
    const content = "No IP addresses here.";
    const matches = detectIP(content);

    expect(matches.length).toBe(0);
  });
});

describe("MAC Address Detection", () => {
  it("should detect MAC with colons", () => {
    const content = "MAC: 00:1A:2B:3C:4D:5E";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("00:1A:2B:3C:4D:5E");
  });

  it("should detect MAC with dashes", () => {
    const content = "MAC: 00-1A-2B-3C-4D-5E";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("00-1A-2B-3C-4D-5E");
  });

  it("should detect lowercase MAC", () => {
    const content = "MAC: aa:bb:cc:dd:ee:ff";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("aa:bb:cc:dd:ee:ff");
  });

  it("should not detect when no MAC present", () => {
    const content = "No MAC address here.";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(0);
  });

  it("should not detect partial MAC", () => {
    const content = "Partial: 00:1A:2B:3C";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(0);
  });

  it("detects multiple MAC addresses", () => {
    const content = "MAC: 00:1A:2B:3C:4D:5E, MAC: 00-1A-2B-3C-4D-5F";
    const matches = detectMacAddress(content);

    expect(matches.length).toBe(2);
    expect(matches[0].text).toBe("00:1A:2B:3C:4D:5E");
    expect(matches[1].text).toBe("00-1A-2B-3C-4D-5F");
  });
});

describe("URL Detection", () => {
  it("should detect http URL", () => {
    const content = "Visit http://example.com for details.";
    const matches = detectUrl(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("http://example.com");
  });

  it("should detect https URL", () => {
    const content = "Visit https://secure.example.com/path";
    const matches = detectUrl(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("https://secure.example.com/path");
  });

  it("should detect www URL", () => {
    const content = "Check www.example.com";
    const matches = detectUrl(content);

    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe("www.example.com");
  });

  it("should detect multiple URLs", () => {
    const content = "Visit http://test.com and https://example.org";
    const matches = detectUrl(content);

    expect(matches.length).toBe(2);
    expect(matches[0].text).toBe("http://test.com");
    expect(matches[1].text).toBe("https://example.org");
  });

  it("should not detect when no URL present", () => {
    const content = "No URLs here.";
    const matches = detectUrl(content);

    expect(matches.length).toBe(0);
  });
});

describe("Redact Strategy", () => {
  it("should redact email", async () => {
    const middleware = piiMiddleware("email", { strategy: "redact" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email me at test@example.com")],
    });

    // Check that email was redacted in messages
    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );

    expect(humanMessage).toBeDefined();
    expect(String(humanMessage?.content)).toContain("[REDACTED_EMAIL]");
    expect(String(humanMessage?.content)).not.toContain("test@example.com");
  });

  it("should redact multiple PII", async () => {
    const middleware = piiMiddleware("email", { strategy: "redact" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Contact alice@test.com or bob@test.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);
    const redactedCount = (content.match(/\[REDACTED_EMAIL\]/g) || []).length;
    expect(redactedCount).toBe(2);
    expect(content).not.toContain("alice@test.com");
    expect(content).not.toContain("bob@test.com");
  });
});

describe("Mask Strategy", () => {
  it("should mask email", async () => {
    const middleware = piiMiddleware("email", { strategy: "mask" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: user@example.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );

    const content = String(humanMessage?.content);
    expect(content).toContain("u***@example.com");
    expect(content).not.toContain("user@example.com");
  });

  it("should mask credit card", async () => {
    const middleware = piiMiddleware("credit_card", { strategy: "mask" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Card: 4532015112830366")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);
    expect(content).toContain("0366"); // Last 4 digits visible
    expect(content).not.toContain("4532015112830366");
  });

  it("should mask IP", async () => {
    const middleware = piiMiddleware("ip", { strategy: "mask" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("IP: 192.168.1.100")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);
    expect(content).toContain("*********.100"); // Last octet visible
    expect(content).not.toContain("192.168.1.100");
  });
});

describe("Hash Strategy", () => {
  it("should hash email", async () => {
    const middleware = piiMiddleware("email", { strategy: "hash" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);
    expect(content).toContain("<email_hash:");
    expect(content).toContain(">");
    expect(content).not.toContain("test@example.com");
  });

  it("should produce deterministic hash", async () => {
    const middleware = piiMiddleware("email", { strategy: "hash" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result1 = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const result2 = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const humanMessage1 = result1.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const humanMessage2 = result2.messages.find((m) =>
      HumanMessage.isInstance(m)
    );

    expect(String(humanMessage1?.content)).toBe(String(humanMessage2?.content));
  });
});

describe("Block Strategy", () => {
  it("should raise exception when PII detected", async () => {
    const middleware = piiMiddleware("email", { strategy: "block" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Email: test@example.com")],
      })
    ).rejects.toThrow(PIIDetectionError);
  });

  it("should raise exception with multiple matches", async () => {
    const middleware = piiMiddleware("email", { strategy: "block" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    try {
      await agent.invoke({
        messages: [new HumanMessage("Emails: alice@test.com and bob@test.com")],
      });
      expect.fail("Should have thrown PIIDetectionError");
    } catch (error) {
      expect(error).toBeInstanceOf(PIIDetectionError);
      const piiError = error as PIIDetectionError;
      expect(piiError.piiType).toBe("email");
      expect(piiError.matches.length).toBe(2);
    }
  });
});

describe("PII Middleware Integration", () => {
  it("should only process input when applyToInput is true and applyToOutput is false", async () => {
    const middleware = piiMiddleware("email", {
      strategy: "redact",
      applyToInput: true,
      applyToOutput: false,
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("My email is ai@example.com")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Should process HumanMessage
    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    expect(String(humanMessage?.content)).toContain("[REDACTED_EMAIL]");

    // Should not process AIMessage (applyToOutput is false)
    const aiMessage = result.messages.find((m) => AIMessage.isInstance(m));
    expect(String(aiMessage?.content)).toContain("ai@example.com");
  });

  it("should only process output when applyToInput is false and applyToOutput is true", async () => {
    const middleware = piiMiddleware("email", {
      strategy: "redact",
      applyToInput: false,
      applyToOutput: true,
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("My email is ai@example.com")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Should not process HumanMessage
    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    expect(String(humanMessage?.content)).toContain("test@example.com");

    // Should process AIMessage
    const aiMessage = result.messages.find((m) => AIMessage.isInstance(m));
    expect(String(aiMessage?.content)).toContain("[REDACTED_EMAIL]");
    expect(String(aiMessage?.content)).not.toContain("ai@example.com");
  });

  it("should process both input and output when both are enabled", async () => {
    const middleware = piiMiddleware("email", {
      strategy: "redact",
      applyToInput: true,
      applyToOutput: true,
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("My email is ai@example.com")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    expect(String(humanMessage?.content)).toContain("[REDACTED_EMAIL]");

    const aiMessage = result.messages.find((m) => AIMessage.isInstance(m));
    expect(String(aiMessage?.content)).toContain("[REDACTED_EMAIL]");
  });

  it("should return no changes when no PII detected", async () => {
    const middleware = piiMiddleware("email", { strategy: "redact" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("No PII here")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("No PII here")],
    });

    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("should handle empty messages gracefully", async () => {
    const middleware = piiMiddleware("email", { strategy: "redact" });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [],
    });

    expect(result.messages).toBeDefined();
  });

  it("should process tool results when applyToToolResults is true", async () => {
    const middleware = piiMiddleware("email", {
      strategy: "redact",
      applyToInput: false,
      applyToToolResults: true,
    });

    const searchTool = tool(() => "Found: john@example.com", {
      name: "search",
      description: "Search for information",
    });

    const toolCall = {
      id: "call_123",
      name: "search",
      args: {},
      type: "tool_call" as const,
    };

    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [toolCall],
        }),
        new AIMessage("Response"),
      ],
    });

    const agent = createAgent({
      model,
      tools: [searchTool],
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Search for John")],
    });

    // Check that the tool message was redacted
    const toolMessage = result.messages.find((m) => ToolMessage.isInstance(m));
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.content).toContain("[REDACTED_EMAIL]");
    expect(toolMessage?.content).not.toContain("john@example.com");
  });

  it("should apply mask strategy to tool results", async () => {
    const middleware = piiMiddleware("ip", {
      strategy: "mask",
      applyToInput: false,
      applyToToolResults: true,
    });

    const getIpTool = tool(() => "Server IP: 192.168.1.100", {
      name: "get_ip",
      description: "Get server IP address",
    });

    const toolCall = {
      id: "call_456",
      name: "get_ip",
      args: {},
      type: "tool_call" as const,
    };

    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [toolCall],
        }),
        new AIMessage("Response"),
      ],
    });

    const agent = createAgent({
      model,
      tools: [getIpTool],
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Get server IP")],
    });

    const toolMessage = result.messages.find((m) => ToolMessage.isInstance(m));
    expect(ToolMessage.isInstance(toolMessage)).toBe(true);
    expect(toolMessage?.content).toContain(".100");
    expect(toolMessage?.content).not.toContain("192.168.1.100");
  });

  it("should block PII in tool results when strategy is block", async () => {
    const middleware = piiMiddleware("email", {
      strategy: "block",
      applyToInput: false,
      applyToToolResults: true,
    });

    const searchTool = tool(() => "User email: sensitive@example.com", {
      name: "search",
      description: "Search for user information",
    });

    const toolCall = {
      id: "call_789",
      name: "search",
      args: {},
      type: "tool_call" as const,
    };

    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [toolCall],
        }),
        new AIMessage("Response"),
      ],
    });

    const agent = createAgent({
      model,
      tools: [searchTool],
      middleware: [middleware],
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("Search for user")],
      })
    ).rejects.toThrow(PIIDetectionError);
  });

  it("should work with createAgent", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Thanks for sharing!")],
    });

    const agent = createAgent({
      model,
      middleware: [piiMiddleware("email", { strategy: "redact" })],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com")],
    });

    // Check that email was redacted in the stored messages
    const messages = result.messages;
    const hasRedactedEmail = messages.some((msg) =>
      String(msg.content).includes("[REDACTED_EMAIL]")
    );
    expect(hasRedactedEmail).toBe(true);
  });
});

describe("Custom Detector", () => {
  it("should work with custom regex detector", async () => {
    const middleware = piiMiddleware("api_key", {
      detector: "sk-[a-zA-Z0-9]{32}",
      strategy: "redact",
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Key: sk-abcdefghijklmnopqrstuvwxyz123456")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    expect(String(humanMessage?.content)).toContain("[REDACTED_API_KEY]");
  });

  it("should work with custom callable detector", async () => {
    const detectCustom = (content: string): PIIMatch[] => {
      const matches: PIIMatch[] = [];
      if (content.includes("CONFIDENTIAL")) {
        const idx = content.indexOf("CONFIDENTIAL");
        matches.push({
          text: "CONFIDENTIAL",
          start: idx,
          end: idx + 12,
        });
      }
      return matches;
    };

    const middleware = piiMiddleware("confidential", {
      detector: detectCustom,
      strategy: "redact",
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("This is CONFIDENTIAL information")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    expect(String(humanMessage?.content)).toContain("[REDACTED_CONFIDENTIAL]");
  });

  it("should throw error for unknown builtin type without detector", () => {
    expect(() => {
      piiMiddleware("unknown_type" as "email", { strategy: "redact" });
    }).toThrow("Unknown PII type");
  });

  it("should not throw error for custom type with detector", () => {
    expect(() => {
      piiMiddleware("custom_type", {
        detector: /\d+/g,
        strategy: "redact",
      });
    }).not.toThrow();
  });
});

describe("Multiple Middleware", () => {
  it("should apply multiple PII types sequentially", async () => {
    // First apply email middleware
    const emailMiddleware = piiMiddleware("email", { strategy: "redact" });
    const ipMiddleware = piiMiddleware("ip", { strategy: "mask" });

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });

    // Create agent with both middlewares
    const agent = createAgent({
      model,
      middleware: [emailMiddleware, ipMiddleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com, IP: 192.168.1.1")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);

    // Email should be redacted
    expect(content).toContain("[REDACTED_EMAIL]");
    expect(content).not.toContain("test@example.com");

    // IP should be masked
    expect(content).toContain(".1");
    expect(content).not.toContain("192.168.1.1");
  });

  it("should work with multiple PIIMiddleware instances in createAgent", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response received")],
    });

    // Multiple PIIMiddleware instances should work because each has a unique name
    const agent = createAgent({
      model,
      middleware: [
        piiMiddleware("email", { strategy: "redact" }),
        piiMiddleware("ip", { strategy: "mask" }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("Contact: test@example.com, IP: 192.168.1.100"),
      ],
    });

    const messages = result.messages;
    const content = messages.map((m) => String(m.content)).join(" ");

    // Email should be redacted
    expect(content).not.toContain("test@example.com");

    // IP should be masked
    expect(content).not.toContain("192.168.1.100");
  });

  it("should work with custom detector combining multiple types", async () => {
    // Combine multiple detectors into one
    const detectEmailAndIP = (content: string): PIIMatch[] => {
      return [...detectEmail(content), ...detectIP(content)];
    };

    const middleware = piiMiddleware("email_or_ip", {
      detector: detectEmailAndIP,
      strategy: "redact",
    });
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Email: test@example.com, IP: 10.0.0.1")],
    });

    const humanMessage = result.messages.find((m) =>
      HumanMessage.isInstance(m)
    );
    const content = String(humanMessage?.content);

    expect(content).not.toContain("test@example.com");
    expect(content).not.toContain("10.0.0.1");
  });
});
