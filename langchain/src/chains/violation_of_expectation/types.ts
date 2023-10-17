import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { AIMessage, BaseMessage, HumanMessage } from "../../schema/index.js";

/**
 * Contains the chunk of messages, along with the
 * users response, which is the next message after the chunk.
 */
export type MessageChunkResult = {
  chunkedMessages: BaseMessage[];
  /**
   * User response can be undefined if the last message in
   * the chat history was from the AI.
   */
  userResponse?: HumanMessage;
};

export type PredictNextUserMessageResponse = {
  userState: string;
  predictedUserMessage: string;
  insights: Array<string>;
};

export const PREDICT_NEXT_USER_MESSAGE_ZOD_SCHEMA = z.object({
  userState: z
    .string()
    .describe("Reasoning about the users internal mental state"),
  predictedUserMessage: z
    .string()
    .describe("Likely possibility for the next user response"),
  insights: z
    .string()
    .array()
    .describe(
      "A list of any additional data, relevant to the conversation that would be useful to improve prediction"
    ),
});

export const PREDICT_NEXT_USER_MESSAGE_FUNCTION = {
  name: "predictNextUserMessage",
  description: "Predicts the next user message, along with insights.",
  parameters: zodToJsonSchema(PREDICT_NEXT_USER_MESSAGE_ZOD_SCHEMA),
};

export const PREDICTION_VIOLATIONS_ZOD_SCHEMA = z.object({
  violationExplanation: z
    .string()
    .optional()
    .describe("How was the predication violated?"),
  explainedPredictionErrors: z
    .string()
    .optional()
    .array()
    .describe("Explanations of how the prediction was violated and why"),
  accuratePrediction: z
    .boolean()
    .describe("Whether or not there was a violation."),
});

export const PREDICTION_VIOLATIONS_FUNCTION = {
  name: "predictionViolations",
  description:
    "Generates violations, errors and differences between the predicted user response, and the actual response, if any.",
  parameters: zodToJsonSchema(PREDICTION_VIOLATIONS_ZOD_SCHEMA),
};

export const dummyMessages = [
  new HumanMessage(
    "Hey, have you read the entry I wrote about college choices in my journal?"
  ),
  new AIMessage(
    "Ah, the infamous journal of yours. Yeah, you left it open on the page. MIT, huh?"
  ),
  new HumanMessage(
    "Yeah, but it's not just the prestige. I wrote about the bio-engineering program there, it's groundbreaking. Plus, the campus is near the Charles River."
  ),
  new AIMessage("Haha, the river! Planning to join the rowing team?"),
  new HumanMessage(
    "Nah, I was actually looking at their Rocket Team. Imagine, designing real rockets!"
  ),
  new AIMessage(
    "Well, space is the final frontier. I, on the other hand, wrote about Stanford in my journal. The whole Silicon Valley ecosystem is exciting."
  ),
  new HumanMessage(
    "True. Your love for entrepreneurship would fit well there. And it’s near Palo Alto, so your startup dreams could actually take off."
  ),
  new AIMessage(
    "Yeah, but it’s also because the campus has those Rodin sculptures. Art amidst tech, you know?"
  ),
  new HumanMessage(
    "Haha, I bet you also love that it's a bike-friendly campus. You and your vintage Schwinn."
  ),
  new AIMessage("Guilty as charged. So, East Coast or West Coast next year?"),
  // new HumanMessage("Let’s see whose journal predicts the future better."),
];
