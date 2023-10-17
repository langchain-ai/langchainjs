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
    .describe("Concise reasoning about the users internal mental state."),
  predictedUserMessage: z
    .string()
    .describe(
      "Your prediction on how they will respond to the AI's most recent message."
    ),
  insights: z
    .string()
    .array()
    .describe(
      "A concise list of any additional insights that would be useful to improve prediction."
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
    .describe("How was the predication violated?"),
  explainedPredictionErrors: z
    .string()
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
    "I've been thinking about the importance of time with myself to discover my voice. I feel like 1-2 hours is never enough."
  ),
  new AIMessage(
    "The concept of 'adequate time' varies. Have you tried different formats of introspection, such as morning pages or long-form writing, to see if they make the process more efficient?"
  ),
  new HumanMessage(
    "I have tried journaling but never consistently. Sometimes it feels like writing doesn't capture everything."
  ),
  new AIMessage(
    "Writing has its limits. What about other mediums like digital art, or interactive journal apps with dynamic prompts that dig deeper? Even coding a personal project can be a form of self-discovery."
  ),
  new HumanMessage(
    "That's an interesting idea. I've never thought about coding as a form of self-discovery."
  ),
  new AIMessage(
    "Since you're comfortable with code, consider building a tool to log and analyze your emotional state, thoughts, or personal growth metrics. It merges skill with introspection, makes the data quantifiable."
  ),
  new HumanMessage(
    "The idea of quantifying emotions and personal growth is fascinating. But I wonder how much it can really capture the 'dark zone' within us."
  ),
  new AIMessage(
    "Good point. The 'dark zone' isn't fully quantifiable. But a tool could serve as a scaffold to explore those areas. It gives a structured approach to an unstructured problem."
  ),
  new HumanMessage(
    "You might be onto something. A structured approach could help unearth patterns or triggers I hadn't noticed."
  ),
  new AIMessage(
    "Exactly. It's about creating a framework to understand what can't easily be understood. Then you can allocate those 5+ hours more effectively, targeting areas that your data flags."
  ),
];
