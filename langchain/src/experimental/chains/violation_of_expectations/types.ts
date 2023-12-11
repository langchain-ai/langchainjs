import { BaseMessage, HumanMessage } from "../../../schema/index.js";

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

export type GetPredictionViolationsResponse = {
  userResponse?: HumanMessage;
  revisedPrediction: string;
  explainedPredictionErrors: Array<string>;
};

export const PREDICT_NEXT_USER_MESSAGE_FUNCTION = {
  name: "predictNextUserMessage",
  description: "Predicts the next user message, along with insights.",
  parameters: {
    type: "object",
    properties: {
      userState: {
        type: "string",
        description: "Concise reasoning about the users internal mental state.",
      },
      predictedUserMessage: {
        type: "string",
        description:
          "Your prediction on how they will respond to the AI's most recent message.",
      },
      insights: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "A concise list of any additional insights that would be useful to improve prediction.",
      },
    },
    required: ["userState", "predictedUserMessage", "insights"],
  },
};

export const PREDICTION_VIOLATIONS_FUNCTION = {
  name: "predictionViolations",
  description:
    "Generates violations, errors and differences between the predicted user response, and the actual response.",
  parameters: {
    type: "object",
    properties: {
      violationExplanation: {
        type: "string",
        description: "How was the predication violated?",
      },
      explainedPredictionErrors: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Explanations of how the prediction was violated and why",
      },
    },
    required: ["violationExplanation", "explainedPredictionErrors"],
  },
};
