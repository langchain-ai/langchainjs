import {
  getBufferString,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";
import {
  BaseConversationSummaryMemory,
  BaseConversationSummaryMemoryInput,
} from "./summary.js";

/**
 * Interface for the input parameters of the
 * ConversationSummaryBufferMemory class.
 */
export interface ConversationSummaryBufferMemoryInput
  extends BaseConversationSummaryMemoryInput {
  maxTokenLimit?: number;
}

/**
 * Class that extends BaseConversationSummaryMemory and implements
 * ConversationSummaryBufferMemoryInput. It manages the conversation
 * history in a LangChain application by maintaining a buffer of chat
 * messages and providing methods to load, save, prune, and clear the
 * memory.
 * @example
 * ```typescript
 * // Initialize the memory with a specific model and token limit
 * const memory = new ConversationSummaryBufferMemory({
 *   llm: new ChatOpenAI({ modelName: "gpt-3.5-turbo-instruct", temperature: 0 }),
 *   maxTokenLimit: 10,
 * });
 *
 * // Save conversation context to memory
 * await memory.saveContext({ input: "hi" }, { output: "whats up" });
 * await memory.saveContext({ input: "not much you" }, { output: "not much" });
 *
 * // Load the conversation history from memory
 * const history = await memory.loadMemoryVariables({});
 * console.log({ history });
 *
 * // Create a chat prompt using the conversation history
 * const chatPrompt = ChatPromptTemplate.fromMessages([
 *   SystemMessagePromptTemplate.fromTemplate(
 *     "The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.",
 *   ),
 *   new MessagesPlaceholder("history"),
 *   HumanMessagePromptTemplate.fromTemplate("{input}"),
 * ]);
 *
 * // Initialize the conversation chain with the model, memory, and prompt
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI({ temperature: 0.9, verbose: true }),
 *   memory: memory,
 *   prompt: chatPrompt,
 * });
 * ```
 */
export class ConversationSummaryBufferMemory
  extends BaseConversationSummaryMemory
  implements ConversationSummaryBufferMemoryInput
{
  movingSummaryBuffer = "";

  maxTokenLimit = 2000;

  constructor(fields: ConversationSummaryBufferMemoryInput) {
    super(fields);

    this.maxTokenLimit = fields?.maxTokenLimit ?? this.maxTokenLimit;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  /**
   * Method that loads the chat messages from the memory and returns them as
   * a string or as a list of messages, depending on the returnMessages
   * property.
   * @param _ InputValues object, not used in this method.
   * @returns Promise that resolves with MemoryVariables object containing the loaded chat messages.
   */
  async loadMemoryVariables(_?: InputValues): Promise<MemoryVariables> {
    let buffer = await this.chatHistory.getMessages();
    if (this.movingSummaryBuffer) {
      buffer = [
        new this.summaryChatMessageClass(this.movingSummaryBuffer),
        ...buffer,
      ];
    }

    let finalBuffer;
    if (this.returnMessages) {
      finalBuffer = buffer;
    } else {
      finalBuffer = getBufferString(buffer, this.humanPrefix, this.aiPrefix);
    }

    return { [this.memoryKey]: finalBuffer };
  }

  /**
   * Method that saves the context of the conversation, including the input
   * and output values, and prunes the memory if it exceeds the maximum
   * token limit.
   * @param inputValues InputValues object containing the input values of the conversation.
   * @param outputValues OutputValues object containing the output values of the conversation.
   * @returns Promise that resolves when the context is saved and the memory is pruned.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    await super.saveContext(inputValues, outputValues);
    await this.prune();
  }

  /**
   * Method that prunes the memory if the total number of tokens in the
   * buffer exceeds the maxTokenLimit. It removes messages from the
   * beginning of the buffer until the total number of tokens is within the
   * limit.
   * @returns Promise that resolves when the memory is pruned.
   */
  async prune() {
    // Prune buffer if it exceeds max token limit
    let buffer = await this.chatHistory.getMessages();
    if (this.movingSummaryBuffer) {
      buffer = [
        new this.summaryChatMessageClass(this.movingSummaryBuffer),
        ...buffer,
      ];
    }

    let currBufferLength = await this.llm.getNumTokens(
      getBufferString(buffer, this.humanPrefix, this.aiPrefix)
    );

    if (currBufferLength > this.maxTokenLimit) {
      const prunedMemory = [];
      while (currBufferLength > this.maxTokenLimit) {
        const poppedMessage = buffer.shift();
        if (poppedMessage) {
          prunedMemory.push(poppedMessage);
          currBufferLength = await this.llm.getNumTokens(
            getBufferString(buffer, this.humanPrefix, this.aiPrefix)
          );
        }
      }
      this.movingSummaryBuffer = await this.predictNewSummary(
        prunedMemory,
        this.movingSummaryBuffer
      );
    }
  }

  /**
   * Method that clears the memory and resets the movingSummaryBuffer.
   * @returns Promise that resolves when the memory is cleared.
   */
  async clear() {
    await super.clear();
    this.movingSummaryBuffer = "";
  }
}
