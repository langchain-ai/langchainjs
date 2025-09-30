import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";

import { createAgent } from "../../index.js";
import { inputGuardrailsMiddleware } from "../inputGuardrails.js";

describe("inputGuardrailsMiddleware Integration", () => {
  it("should only process new messages", async () => {
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

    const fetchUser = tool(
      vi.fn().mockImplementation(({ id }) => ({
        "userId-123": {
          id,
          name: "John Doe",
          email: "john@example.com",
          ssn: "123-45-6789",
          phone: "123-456-7890",
          address: "123 Main St, Anytown, USA",
          socialSecurityNumber: "123-45-6789",
          city: "Anytown",
          state: "CA",
          zip: "12345",
          loanEligible: true,
        },
      })),
      {
        name: "fetchUser",
        description: "Fetch a user",
        schema: z.object({
          id: z.string().describe("The ID of the user to fetch"),
        }),
      }
    );

    const agent = createAgent({
      model,
      tools: [fetchUser],
      middleware: [inputGuardrailsMiddleware()],
      responseFormat: z.object({
        name: z.string().describe("The name of the user"),
        isEligible: z
          .boolean()
          .describe("Whether the user is eligible for a loan"),
      }),
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          "Fetch user with id 'userId-123' and determine if the user is eligible for a loan"
        ),
      ],
    });

    expect(result.structuredResponse).toEqual({
      name: "John Doe",
      isEligible: true,
    });
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(
      JSON.parse(fetchMock.mock.calls[1][1].body).messages.map(
        (m: { content: string }) => m.content
      )
    ).toMatchInlineSnapshot(`
      [
        "Fetch user with id 'userId-123' and determine if the user is eligible for a loan",
        "",
        "{
        "userId-123": {
          "id": "userId-123",
          "name": "John Doe",
          "email": "[REDACTED_EMAIL]",
          "ssn": "[REDACTED_SSN]",
          "phone": "[REDACTED_PHONE]",
          "address": "123 Main St, Anytown, USA",
          "socialSecurityNumber": "[REDACTED_SSN]",
          "city": "Anytown",
          "state": "CA",
          "zip": "12345",
          "loanEligible": true
        }
      }",
      ]
    `);
  });
});
