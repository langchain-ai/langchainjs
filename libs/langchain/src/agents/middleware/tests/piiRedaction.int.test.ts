import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { ChatAnthropic } from "@langchain/anthropic";

import { createAgent } from "../../index.js";
import { piiRedactionMiddleware } from "../piiRedaction.js";

const USER_DATA = {
  id: "userId-123",
  name: "John Doe",
  email: "john@example.com",
  ssn: "123-45-6789",
  phone: "123-456-7890",
  address: "123 Main St, Anytown, USA",
  city: "Anytown",
  state: "CA",
  zip: "12345",
  loanEligible: true,
};

/**
 * Prebuilt PII detection rules for common sensitive information
 */
export const PII_RULES: Record<string, RegExp> = {
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  phone:
    /(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s][0-9]{3}[-.\s][0-9]{4}|(?:\+?1[-.\s]?)?\([0-9]{3}\)\s?[0-9]{3}[-.\s]?[0-9]{4}/g,
  email: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}\b/g,
  creditCard:
    /(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s][0-9]{3}[-.\s][0-9]{4}|(?:\+?1[-.\s]?)?\([0-9]{3}\)\s?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ip: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  driversLicense: /\b[A-Z]{1,2}[0-9]{6,8}\b/g,
  passport: /\b[0-9]{9}\b/g,
  bankAccount: /\b[0-9]{8,17}\b/g,
};

function mockModel(type: "openai" | "anthropic") {
  const fetchResponse = vi
    .fn()
    .mockImplementation((response) => response.clone());
  const fetchMock = vi.fn().mockImplementation((url, options) => {
    return fetch(url, options).then(fetchResponse);
  });

  const model =
    type === "openai"
      ? new ChatOpenAI({
          model: "gpt-4o",
          temperature: 0,
          configuration: {
            fetch: fetchMock,
          },
        })
      : new ChatAnthropic({
          model: "claude-sonnet-4-0",
          temperature: 0,
          clientOptions: {
            fetch: fetchMock,
          },
        });

  return { model, fetchMock, fetchResponse };
}

describe("piiRedactionMiddleware Integration", () => {
  it.each(["openai", "anthropic"])(
    `[%s] should redact PII data from model request bodies`,
    async (type) => {
      const { model, fetchMock, fetchResponse } = mockModel(
        type as "openai" | "anthropic"
      );
      const PII_DATA = [USER_DATA.ssn, USER_DATA.phone, USER_DATA.email];
      const fetchToolMock = vi.fn().mockImplementation(() => {
        return {
          [USER_DATA.id]: USER_DATA,
        };
      });
      const fetchUser = tool(fetchToolMock, {
        name: "fetchUser",
        description: "Fetch a user",
        schema: z.object({
          id: z.string().describe("The ID of the user to fetch"),
        }),
      });

      const emailToolMock = vi.fn().mockImplementation(({ email }) => {
        return `Email sent to ${email}!`;
      });
      const emailUser = tool(emailToolMock, {
        name: "emailUser",
        description: "Email a user",
        schema: z.object({
          email: z.string().describe("The email of the user to email"),
          subject: z.string().describe("The subject of the email"),
          message: z.string().describe("The message of the email"),
        }),
      });

      const agent = createAgent({
        model,
        tools: [fetchUser, emailUser],
        middleware: [piiRedactionMiddleware({ rules: PII_RULES })],
        responseFormat: z.object({
          name: z.string().describe("The name of the user"),
          email: z.string().describe("The email of the user"),
        }),
      });

      const result = await agent.invoke({
        messages: [
          new HumanMessage(
            "Fetch user with id 'userId-123' and send them an email with the subject 'Hello' and the message 'Hello, how are you?'"
          ),
        ],
      });

      /**
       * actual result contains the original PII data
       */
      expect(result.structuredResponse).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });

      /**
       * tool call arguments contain the original PII data
       */
      expect(fetchToolMock).toHaveBeenCalledTimes(1);
      expect(fetchToolMock).toHaveBeenCalledWith(
        { id: "userId-123" },
        expect.any(Object)
      );
      expect(emailToolMock).toHaveBeenCalledTimes(1);
      expect(emailToolMock).toHaveBeenCalledWith(
        {
          email: "john@example.com",
          subject: "Hello",
          message: "Hello, how are you?",
        },
        expect.any(Object)
      );

      /**
       * However, the request bodies do not contain the original PII data
       */
      expect(fetchMock.mock.calls.length).toBe(3);
      const [initialRequest, toolCallRequest, toolResponseRequest] =
        fetchMock.mock.calls.map(([_, options]) => options) as RequestInit[];
      const [
        initialRequestResponse,
        toolCallRequestResponse,
        toolResponseRequestResponse,
      ] = (await Promise.all(
        fetchResponse.mock.calls.map(([res]) => res.text())
      )) as string[];

      /**
       * Ensure PII data is not present in the request or response bodies
       */
      for (const piiData of PII_DATA) {
        expect(initialRequest.body).not.toContain(piiData);
        expect(toolCallRequest.body).not.toContain(piiData);
        expect(toolResponseRequest.body).not.toContain(piiData);
        expect(initialRequestResponse).not.toContain(piiData);
        expect(toolCallRequestResponse).not.toContain(piiData);
        expect(toolResponseRequestResponse).not.toContain(piiData);
      }
    }
  );
});
