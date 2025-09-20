/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, type MockInstance } from "vitest";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  ChatAnthropic,
  type AnthropicInput,
  // @ts-expect-error - instances is mocked
  instances,
} from "@langchain/anthropic";

import { anthropicPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../index.js";

/**
 * Mock the Anthropic module to return a ChatAnthropicMock instance
 */
vi.mock("@langchain/anthropic", async (origModule) => {
  const { ChatAnthropic } = (await origModule()) as any;
  const instances: ChatAnthropicMock[] = [];
  class ChatAnthropicMock extends ChatAnthropic {
    anthropicResponse: MockInstance;
    anthropicFetchMock: MockInstance;

    constructor(params: AnthropicInput) {
      const anthropicResponse = vi.fn((res) => res.clone());
      const anthropicFetchMock = vi.fn((url, options) =>
        fetch(url, options).then(anthropicResponse)
      );
      super({
        ...params,
        clientOptions: {
          ...params.clientOptions,
          fetch: anthropicFetchMock,
        },
      });

      this.anthropicResponse = anthropicResponse;
      this.anthropicFetchMock = anthropicFetchMock;

      instances.push(this);
    }

    get mocks() {
      return {
        anthropicResponse: this.anthropicResponse,
        anthropicFetchMock: this.anthropicFetchMock,
      };
    }
  }
  return {
    ChatAnthropic: ChatAnthropicMock,
    instances,
  };
});

// Create a simple tool for testing
const simpleTool = tool(
  async (input: { query: string }) => {
    return `Tool response for: ${input.query}`;
  },
  {
    name: "simpleTool",
    schema: z.object({
      query: z.string().describe("The query to process"),
    }),
    description: "A simple tool for testing",
  }
);

const messages = [
  new HumanMessage(`I'm working on a comprehensive educational project about European capitals and their historical significance. I need detailed and accurate information for my research, which will be published in an upcoming textbook for high school students studying world geography and history.

  Before I ask my specific question, let me provide extensive context about the subject matter: France is a Western European country with a rich history spanning over millennia. It has been a major cultural, political, and economic power throughout history. The country has played a pivotal role in the development of Western civilization, from the Renaissance through the Enlightenment to modern times. The nation's influence extends far beyond its borders, shaping global politics, culture, and intellectual thought for centuries.
  
  France is renowned worldwide for its extraordinary contributions to art, science, philosophy, cuisine, fashion, and literature. The country has produced countless influential figures including philosophers like René Descartes, Voltaire, Jean-Jacques Rousseau, and Simone de Beauvoir; scientists like Marie Curie, Louis Pasteur, Blaise Pascal, and Henri Poincaré; writers like Victor Hugo, Marcel Proust, Albert Camus, and Marguerite Duras; and artists like Claude Monet, Auguste Rodin, Edgar Degas, and Henri Matisse. The French Revolution of 1789 had a profound and lasting impact on the development of modern democratic ideals, human rights, and political philosophy across the globe.
  
  The country is administratively divided into several distinct regions, each with its own unique culture, dialect, culinary traditions, and historical significance. From the aromatic lavender fields of Provence to the world-famous vineyards of Bordeaux, from the glamorous beaches of the Côte d'Azur to the majestic peaks of the Alps and Pyrenees, France offers incredible geographical and cultural diversity. The Loire Valley is known for its magnificent châteaux, Brittany for its Celtic heritage, Normandy for its D-Day beaches and apple orchards, and Alsace for its unique Franco-German culture.
  
  France's economy is one of the world's largest, with strong sectors in aerospace, automotive, luxury goods, tourism, and agriculture. The country is famous for its haute cuisine, which UNESCO recognized as an Intangible Cultural Heritage of Humanity. French wines, cheeses, and pastries are celebrated globally. The French language itself has been a lingua franca of diplomacy, culture, and international relations for centuries, and continues to be one of the working languages of many international organizations.
  
  The educational system in France has produced numerous Nobel laureates, Fields Medal winners, and other distinguished scholars. French universities like the Sorbonne have been centers of learning since the Middle Ages. The country's commitment to arts and culture is evident in its numerous world-class museums, including the Louvre, Musée d'Orsay, and Centre Pompidou, as well as its vibrant theater, cinema, and music scenes.
  
  In terms of governance, France is a unitary semi-presidential republic with a strong democratic tradition. The country is a founding member of the European Union and plays a crucial role in European and global politics. It maintains significant cultural and economic ties with francophone countries around the world through organizations like La Francophonie.
  
  Now, for my comprehensive educational project that requires accurate and reliable information about European capitals, I need to know the answer to this fundamental question: What is the capital of France?
  
  Please provide a clear, direct, and authoritative answer, as this information will be used in an educational context for students learning about European geography, and accuracy is of paramount importance for their academic development.`),
  new HumanMessage("What is the capital of France?"),
];

describe("anthropicPromptCachingMiddleware", () => {
  it("should allow middleware to update model, messages and systemMessage", async () => {
    const model = new ChatAnthropic({
      model: "claude-opus-4-20250514",
      temperature: 0.7,
      maxTokens: 500,
      topP: 0.95,
    });

    // Create agent with OpenAI model string and the middleware
    const agent = createAgent({
      model,
      tools: [simpleTool],
      prompt: "You are a geography expert.",
      middleware: [
        anthropicPromptCachingMiddleware({
          ttl: "5m",
          minMessagesToCache: 1,
        }),
      ] as const,
    });

    // Invoke the agent
    const result = await agent.invoke({
      messages,
    });

    const { anthropicFetchMock, anthropicResponse } = (model as any).mocks;

    // Verify that Anthropic was called (not OpenAI)
    expect(anthropicFetchMock).toHaveBeenCalled();

    // Verify the request to Anthropic includes our model settings
    const anthropicCall = anthropicFetchMock.mock.calls[0];
    const requestBody = JSON.parse(anthropicCall[1].body);

    // Check that cache_control was passed through
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages.at(-1).content[0]).toEqual({
      type: "text",
      text: expect.stringContaining("What is the capital of France?"),
      cache_control: {
        type: "ephemeral",
        ttl: "5m",
      },
    });

    // Check that the system message was updated
    expect(requestBody.system).toBe("You are a geography expert.");

    // The response should be about France, not Tokyo weather
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    // Find the AI response message
    const aiResponse = result.messages.find((msg) => AIMessage.isInstance(msg));
    expect(aiResponse).toBeDefined();

    // validate raw response has cache_control set
    const rawResponse = await anthropicResponse.mock.calls[0][0].json();
    // tokens will be already cached when the same test is run again within a short time period
    // so we expect them to be either in the creation or read bucket
    const cachedTokens =
      rawResponse.usage.cache_read_input_tokens ||
      rawResponse.usage.cache_creation_input_tokens;
    expect(cachedTokens).toBeGreaterThan(1200);
    expect(cachedTokens).toBeLessThan(1400);
  });

  it("should work when model is passed in as string", async () => {
    // Create agent with OpenAI model string and the middleware
    const agent = createAgent({
      model: "anthropic:claude-opus-4-20250514",
      tools: [simpleTool],
      prompt: "You are a geography expert.",
      middleware: [
        anthropicPromptCachingMiddleware({
          ttl: "5m",
          minMessagesToCache: 1,
        }),
      ] as const,
    });

    // Invoke the agent
    await agent.invoke({
      messages,
    });

    const { anthropicResponse } = (instances.pop() as any).mocks;

    // validate raw response has cache_control set
    const rawResponse = await anthropicResponse.mock.calls[0][0].json();
    // tokens will be already cached when the same test is run again within a short time period
    // so we expect them to be either in the creation or read bucket
    const cachedTokens =
      rawResponse.usage.cache_read_input_tokens ||
      rawResponse.usage.cache_creation_input_tokens;

    expect(cachedTokens).toBeGreaterThan(1200);
    expect(cachedTokens).toBeLessThan(1400);
  });
});
