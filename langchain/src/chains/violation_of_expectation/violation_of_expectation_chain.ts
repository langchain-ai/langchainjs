import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { JsonOutputFunctionsParser } from "../../output_parsers/openai_functions.js";
import {
  BaseMessage,
  ChainValues,
  HumanMessage,
  isBaseMessage,
} from "../../schema/index.js";
import { StringOutputParser } from "../../schema/output_parser.js";
import { BaseRetriever } from "../../schema/retriever.js";
import { BaseChain, ChainInputs } from "../base.js";
import {
  MessageChunkResult,
  PREDICTION_VIOLATIONS_FUNCTION,
  PREDICT_NEXT_USER_MESSAGE_FUNCTION,
  PredictNextUserMessageResponse,
} from "./types.js";
import {
  GENERATE_FACTS_PROMPT,
  GENERATE_REVISED_PREDICTION_PROMPT,
  PREDICTION_VIOLATIONS_PROMPT,
  PREDICT_NEXT_USER_MESSAGE_PROMPT,
} from "./violation_of_expectation_prompt.js";

export interface ViolationOfExpectationChainInput extends ChainInputs {
  /**
   * The retriever to use for retrieving stored
   * thoughts and insights.
   */
  retriever: BaseRetriever;
  /**
   * The LLM to use
   */
  llm: ChatOpenAI;
}

export class ViolationOfExpectationChain
  extends BaseChain
  implements ViolationOfExpectationChainInput
{
  static lc_name() {
    return "ViolationOfExpectationChain";
  }

  _chainType(): string {
    return "violation_of_expectation_chain";
  }

  chatHistoryKey = "chat_history";

  thoughtsKey = "thoughts";

  get inputKeys() {
    return [this.chatHistoryKey];
  }

  get outputKeys() {
    return [this.thoughtsKey];
  }

  retriever: BaseRetriever;

  llm: ChatOpenAI;

  jsonOutputParser: JsonOutputFunctionsParser;

  stringOutputParser: StringOutputParser;

  constructor(fields: ViolationOfExpectationChainInput) {
    super(fields);
    this.retriever = fields.retriever;
    this.llm = fields.llm;
    this.jsonOutputParser = new JsonOutputFunctionsParser();
    this.stringOutputParser = new StringOutputParser();
  }

  getChatHistoryString(chatHistory: BaseMessage[]): string {
    return chatHistory
      .map((chatMessage) => {
        if (chatMessage._getType() === "human") {
          return `Human: ${chatMessage.content}`;
        } else if (chatMessage._getType() === "ai") {
          return `AI: ${chatMessage.content}`;
        } else {
          return `${chatMessage.content}`;
        }
      })
      .join("\n");
  }

  getMessageChunks(chatHistory: BaseMessage[]): MessageChunkResult[] {
    const newArray: MessageChunkResult[] = [];
    const tempArray: BaseMessage[] = [];

    chatHistory.forEach((item, index) => {
      tempArray.push(item);
      if (item._getType() === "ai") {
        let userResponse: BaseMessage | undefined = chatHistory[index + 1];
        if (!userResponse || userResponse._getType() !== "human") {
          userResponse = undefined;
        }

        newArray.push({
          chunkedMessages: tempArray,
          userResponse: userResponse
            ? new HumanMessage(userResponse)
            : undefined,
        });
      }
    });

    return newArray;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    if (!(this.chatHistoryKey in values)) {
      throw new Error(`Chat history key ${this.chatHistoryKey} not found`);
    }

    const chatHistory: unknown[] = values[this.chatHistoryKey];

    const isEveryMessageBaseMessage = chatHistory.every((message) =>
      isBaseMessage(message)
    );
    if (!isEveryMessageBaseMessage) {
      throw new Error("Chat history must be an array of BaseMessages");
    }

    const messageChunks = this.getMessageChunks(chatHistory as BaseMessage[]);

    // Generate the initial prediction for every user message.
    const userPredictions = await Promise.all(
      messageChunks.map(async (chatHistoryChunk) => ({
        userPredictions: await this.predictNextUserMessage(
          chatHistoryChunk.chunkedMessages
        ),
        userResponse: chatHistoryChunk.userResponse,
        runManager,
      }))
    );

    // Generate insights, and prediction violations for every user message.
    // This call also regenerates the prediction based on the violations.
    const predictionViolations = await Promise.all(
      userPredictions.map((prediction) =>
        this.getPredictionViolations({
          userPredictions: prediction.userPredictions,
          userResponse: prediction.userResponse,
          runManager,
        })
      )
    );

    // Generate a fact/insight about the user for every set of messages.
    const insights = await Promise.all(
      predictionViolations.map((violation) =>
        this.generateFacts({
          userResponse: violation.userResponse,
          predictions: {
            revisedPrediction: violation.revisedPrediction,
            explainedPredictionErrors: violation.explainedPredictionErrors,
          },
        })
      )
    );

    return insights;
  }

  private async predictNextUserMessage(
    chatHistory: BaseMessage[],
    runManager?: CallbackManagerForChainRun
  ): Promise<PredictNextUserMessageResponse> {
    const messageString = this.getChatHistoryString(chatHistory);

    const llmWithFunctions = this.llm.bind({
      functions: [PREDICT_NEXT_USER_MESSAGE_FUNCTION],
      function_call: { name: PREDICT_NEXT_USER_MESSAGE_FUNCTION.name },
    });

    const chain = PREDICT_NEXT_USER_MESSAGE_PROMPT.pipe(llmWithFunctions).pipe(
      this.jsonOutputParser
    );

    const res = await chain.invoke(
      {
        chat_history: messageString,
      },
      runManager?.getChild("prediction")
    );

    if (
      "userState" in res &&
      "predictedUserMessage" in res &&
      "insights" in res
    ) {
      return res as PredictNextUserMessageResponse;
    }

    throw new Error(`Invalid response from LLM: ${JSON.stringify(res)}`);
  }

  private async retrieveRelevantInsights(
    insights: Array<string>
  ): Promise<Array<string>> {
    const relevantInsightsDocuments = (
      await Promise.all(
        insights.map(async (insight) => {
          const relevantInsight = await this.retriever.getRelevantDocuments(
            insight
          );
          return relevantInsight;
        })
      )
    ).flat();

    const relevantInsightsContent = relevantInsightsDocuments.map(
      (document) => document.pageContent
    );

    return relevantInsightsContent;
  }

  private async getPredictionViolations({
    userPredictions,
    userResponse,
    runManager,
  }: {
    userPredictions: PredictNextUserMessageResponse;
    userResponse?: BaseMessage;
    runManager?: CallbackManagerForChainRun;
  }) {
    const llmWithFunctions = this.llm.bind({
      functions: [PREDICTION_VIOLATIONS_FUNCTION],
      function_call: { name: PREDICTION_VIOLATIONS_FUNCTION.name },
    });

    const chain = PREDICTION_VIOLATIONS_PROMPT.pipe(llmWithFunctions).pipe(
      this.jsonOutputParser
    );

    const res = (await chain.invoke(
      {
        predicted_output: userPredictions.predictedUserMessage,
        actual_output: userResponse?.content ?? "",
        user_insights: userPredictions.insights.join("\n"),
      },
      runManager?.getChild("prediction_violations")
    )) as Awaited<{
      violationExplanation: string;
      explainedPredictionErrors: Array<string>;
      accuratePrediction: boolean;
    }>;

    // Generate a revised prediction based on violations.
    const revisedPrediction = await this.generateRevisedPrediction({
      originalPrediction: userPredictions.predictedUserMessage,
      explainedPredictionErrors: res.explainedPredictionErrors,
      userInsights: userPredictions.insights,
      runManager,
    });

    return {
      userResponse,
      revisedPrediction,
      explainedPredictionErrors: res.explainedPredictionErrors,
    };
  }

  private async generateRevisedPrediction({
    originalPrediction,
    explainedPredictionErrors,
    userInsights,
    runManager,
  }: {
    originalPrediction: string;
    explainedPredictionErrors: Array<string>;
    userInsights: Array<string>;
    runManager?: CallbackManagerForChainRun;
  }): Promise<string> {
    const revisedPredictionChain = GENERATE_REVISED_PREDICTION_PROMPT.pipe(
      this.llm
    ).pipe(this.stringOutputParser);

    const revisedPredictionRes = await revisedPredictionChain.invoke(
      {
        prediction: originalPrediction,
        explained_prediction_errors: explainedPredictionErrors.join("\n"),
        user_insights: userInsights.join("\n"),
      },
      runManager?.getChild("prediction_revision")
    );

    return revisedPredictionRes;
  }

  private async generateFacts({
    userResponse,
    predictions,
    runManager,
  }: {
    userResponse?: BaseMessage;
    /**
     * Optional if the prediction was accurate.
     */
    predictions: {
      revisedPrediction: string;
      explainedPredictionErrors: Array<string>;
    };
    runManager?: CallbackManagerForChainRun;
  }) {
    const chain = GENERATE_FACTS_PROMPT.pipe(this.llm).pipe(
      this.stringOutputParser
    );

    const res = await chain.invoke(
      {
        prediction_violations: predictions.explainedPredictionErrors.join("\n"),
        prediction: predictions.revisedPrediction,
        user_message: userResponse?.content ?? "",
      },
      runManager?.getChild("generate_facts")
    );

    return res;
  }
}
