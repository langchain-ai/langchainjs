import { LlamaModel, LlamaContext, LlamaChatSession, EmptyChatPromptWrapper } from "node-llama-cpp";
import { SimpleChatModel, BaseChatModelParams } from "./base.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { BaseMessage } from "../schema/index.js";

export type ModelType =
  | "llama"
  | "chatML"
  | "falcon"
  | "general";
/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface LlamaCppInputs extends BaseChatModelParams {
  /** Prompt processing batch size. */
  batchSize?: number;
  /** Text context size. */
  contextSize?: number;
  /** Embedding mode only. */
  embedding?: boolean;
  /** Use fp16 for KV cache. */
  f16Kv?: boolean;
  /** Number of layers to store in VRAM. */
  gpuLayers?: number;
  /** The llama_eval() call computes all logits, not just the last one. */
  logitsAll?: boolean;
  /** If true, reduce VRAM usage at the cost of performance. */
  lowVram?: boolean;
  /** Path to the model on the filesystem. */
  modelPath: string;
  /** If null, a random seed will be used. */
  seed?: null | number;
  /** The randomness of the responses, e.g. 0.1 deterministic, 1.5 creative, 0.8 balanced, 0 disables. */
  temperature?: number;
  /** Consider the n most likely tokens, where n is 1 to vocabulary size, 0 disables (uses full vocabulary). Note: only applies when `temperature` > 0. */
  topK?: number;
  /** Selects the smallest token set whose probability exceeds P, where P is between 0 - 1, 1 disables. Note: only applies when `temperature` > 0. */
  topP?: number;
  /** Force system to keep model in RAM. */
  useMlock?: boolean;
  /** Use mmap if possible. */
  useMmap?: boolean;
  /** Only load the vocabulary, no weights. */
  vocabOnly?: boolean;
  /** Model type describes the specific model and can be `llama`, `chatML`, `falcon` or `general`. This affects how the messages are tagged. The default is `llama`. */
  modelType?: ModelType;
}

export interface LlamaCppCallOptions extends BaseLanguageModelCallOptions {
  /** The maximum number of tokens the response should contain. */
  maxTokens?: number;
  /** A function called when matching the provided token array */
  onToken?: (tokens: number[]) => void;
}

/**
 *  To use this model you need to have the `node-llama-cpp` module installed.
 *  This can be installed using `npm install -S node-llama-cpp` and the minimum
 *  version supported in version 2.0.0.
 *  This also requires that have a locally built version of Llama2 installed.
 */
export class ChatLlamaCpp extends SimpleChatModel<LlamaCppCallOptions> {
  declare CallOptions: LlamaCppCallOptions;

  static inputs: LlamaCppInputs;

  batchSize?: number;

  contextSize?: number;

  embedding?: boolean;

  f16Kv?: boolean;

  gpuLayers?: number;

  logitsAll?: boolean;

  lowVram?: boolean;

  seed?: null | number;

  useMlock?: boolean;

  useMmap?: boolean;

  vocabOnly?: boolean;

  modelType?: ModelType = "llama";

  modelPath: string;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession;

  static lc_name() {
    return "LlamaCpp";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.batchSize = inputs.batchSize;
    this.contextSize = inputs.contextSize;
    this.embedding = inputs.embedding;
    this.f16Kv = inputs.f16Kv;
    this.gpuLayers = inputs.gpuLayers;
    this.logitsAll = inputs.logitsAll;
    this.lowVram = inputs.lowVram;
    this.modelPath = inputs.modelPath;
    this.seed = inputs.seed;
    this.useMlock = inputs.useMlock;
    this.useMmap = inputs.useMmap;
    this.vocabOnly = inputs.vocabOnly;
    this.modelType = inputs.modelType ?? this.modelType;
    this._model = new LlamaModel(inputs);
    this._context = new LlamaContext({ model: this._model });
    this._session = new LlamaChatSession({
        context: this._context,
        promptWrapper: new EmptyChatPromptWrapper()
    });
  }

  _llmType() {
    return "llama2_cpp";
  }

  invocationParams() {
    return {
      batchSize: this.batchSize,
      contextSize: this.contextSize,
      embedding: this.embedding,
      f16Kv: this.f16Kv,
      gpuLayers: this.gpuLayers,
      logitsAll: this.logitsAll,
      lowVram: this.lowVram,
      modelPath: this.modelPath,
      seed: this.seed,
      useMlock: this.useMlock,
      useMmap: this.useMmap,
      vocabOnly: this.vocabOnly,
    };
  }

  /** @ignore */
  _combineLLMOutput() {
    return {};
  }

  /**
  * Stream output in chunks.
  * @param input
  * @param options
  * @returns A readable stream that is also an iterable.
  */
 async stream(
   input: RunInput,
   options?: Partial<CallOptions>
 ): Promise<IterableReadableStream<RunOutput>> {
   return IterableReadableStream.fromAsyncGenerator(
     this._streamIterator(input, options)
   );
 }


  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    // @ts-expect-error - TS6133: 'runManager' is declared but its value is never read.
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {

    // Check if we need a new session with system prompt
    // Check for system prompt in messages
    // Extract all system prompts and add the last set as local and stored value

    // Check if we need to add chat history
    // If the last item in the array is human message that is the prompt
    // Any prior messages add as conversationHistory

    // Now create the sesssion test if there is local system OR history?
    // If there is only history is there stored system?

    // Creat the session with appropriate Wrappers

    // Run the prompt
    
    // Let's see if we need to instanciate the session
    if (messages.findIndex(msg => msg._getType() === "system") !== -1) {
        const sysMessages = messages.filter(
          (message) => message._getType() === "system"
        );

        this._session = new LlamaChatSession({
          context: this._context,
          systemPrompt: sysMessages[0].content,
          promptWrapper: new EmptyChatPromptWrapper(),
        });
    }

    // Build a prompt string
    const prompt = this._convertMessagesToPrompt(messages);

    try {
      const completion = await this._session.prompt(prompt, options);
      return completion;
    } catch (e) {
      throw new Error("Error getting prompt completion.");
    }
  }


  // This builds a simple string from the prompts
  protected _convertMessagesToPrompt(messages: BaseMessage[]): string {
      let result = [];
      /*for (const message of messages) {
        if (message._getType() === "human") {
          result.push(message.content);
        } else if (message._getType() === "ai") {
            result.push(message.content);
        }
    }*/

      for (const message of messages) {
          if (message._getType() === "human") {
              switch (this.modelType) {
                  case "chatML":
                      result.push("<|im_start|>user\n" + message.content +"<|im_end|>");
                      break;
                  case "falcon":
                      result.push("User: " + message.content);
                      break;
                  case "general":
                      result.push("### Human:\n" + message.content);
                      break;
                  default:
                      result.push("<s>[INST] " + message.content + " [/INST]");
                      break;
              }
          } else if (message._getType() === "ai") {
              switch (this.modelType) {
                  case "chatML":
                      result.push("<|im_start|>assistant\n" + message.content + "<|im_end|>");
                      break;
                  case "falcon":
                      result.push("Assistant: " + message.content);
                      break;
                  case "general":
                      result.push("### Assistant:\n" + message.content);
                      break;
                  default:
                      result.push(" " + message.content + " </s>");
                      break;
              }
          }
        }

      if (this.modelType === "llama") {
          console.log(result.join(""));
          return result.join("");
      } else {
          console.log(result.join("\n"));
          return result.join("\n");
      }

  }
}
