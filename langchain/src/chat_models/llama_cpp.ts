import { LlamaModel, LlamaContext, LlamaChatSession, ConversationInteraction, } from "node-llama-cpp";
import { SimpleChatModel, BaseChatModelParams, } from "./base.js";
import { BaseLanguageModelCallOptions, } from "../base_language/index.js";
import { CallbackManagerForLLMRun, } from "../callbacks/manager.js";
import { BaseMessage, } from "../schema/index.js";
import { AIMessageChunk, BaseMessage, ChatGenerationChunk, ChatMessage, } from "../schema/index.js";

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
  /** If true, respond in streaming mode. */
  streaming?: boolean;
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

  streaming?: boolean;

  useMlock?: boolean;

  useMmap?: boolean;

  vocabOnly?: boolean;

  modelPath: string;

  _model: LlamaModel;

  _context: LlamaContext;

  _session: LlamaChatSession | null;

  static lc_name() {
    return "LlamaCpp";
  }

  constructor(inputs: LlamaCppInputs) {
    super(inputs);
    this.batchSize = inputs?.batchSize;
    this.contextSize = inputs?.contextSize;
    this.embedding = inputs?.embedding;
    this.f16Kv = inputs?.f16Kv;
    this.gpuLayers = inputs?.gpuLayers;
    this.logitsAll = inputs?.logitsAll;
    this.lowVram = inputs?.lowVram;
    this.modelPath = inputs.modelPath;
    this.seed = inputs?.seed;
    this.streaming = inputs?.streaming ?? false;
    this.useMlock = inputs?.useMlock;
    this.useMmap = inputs?.useMmap;
    this.vocabOnly = inputs?.vocabOnly;
    this._model = new LlamaModel(inputs);
    this._context = new LlamaContext({ model: this._model });
    this._session = null;
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
      streaming: this.streaming,
      useMlock: this.useMlock,
      useMmap: this.useMmap,
      vocabOnly: this.vocabOnly,
    };
  }

  /** @ignore */
  _combineLLMOutput() {
    return {};
  }

  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    //const stream = await this.caller.call(async () =>
      await this._session.prompt(input, {
          onToken(chunk) {
                //return chunk;
                const decoded_chunk = this._context.decode(chunk);
                return new ChatGenerationChunk({
                  text: decoded_chunk,
                  message: new AIMessageChunk({ content: decoded_chunk }),
                });
                /*await runManager?.handleLLMNewToken(decoded_chunk ?? "");
              } else {
                yield new ChatGenerationChunk({
                  text: "",
                  message: new AIMessageChunk({ content: "" }),
                  generationInfo: {
                    model: chunk.model,
                    total_duration: chunk.total_duration,
                    load_duration: chunk.load_duration,
                    prompt_eval_count: chunk.prompt_eval_count,
                    prompt_eval_duration: chunk.prompt_eval_duration,
                    eval_count: chunk.eval_count,
                    eval_duration: chunk.eval_duration,
                  },
                });
              }*/
          }
      });
    //);
    /*for await (const chunk of stream) {
      if (!chunk.done) {
        yield new ChatGenerationChunk({
          text: chunk.response,
          message: new AIMessageChunk({ content: chunk.response }),
        });
        await runManager?.handleLLMNewToken(chunk.response ?? "");
      } else {
        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({ content: "" }),
          generationInfo: {
            model: chunk.model,
            total_duration: chunk.total_duration,
            load_duration: chunk.load_duration,
            prompt_eval_count: chunk.prompt_eval_count,
            prompt_eval_duration: chunk.prompt_eval_duration,
            eval_count: chunk.eval_count,
            eval_duration: chunk.eval_duration,
          },
        });
      }
    }*/
  }


  /** @ignore */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    // @ts-expect-error - TS6133: 'runManager' is declared but its value is never read.
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const params = this.invocationParams(options);

    let prompt = "";

    if (messages.length > 1) {
      // We need to build a new _session
      prompt = this._buildSession(messages);
    } else if (!this._session) {
      prompt = this._buildSession(messages);
    } else {
      // If we already have a session then we should just have a single prompt
      prompt  = messages[0].content;
    }

    console.log("_call, prompt: " + prompt);
    if (this.streaming) {
      //const completion = await this._session.prompt(prompt, options);
      const chunks = [];
      for await (const chunk of this._streamResponseChunks(
        prompt,
        options,
        runManager
      )) {
        chunks.push(chunk.message.content);
      }
      return chunks.join("");
    } else {
      try {
        const completion = await this._session.prompt(prompt, options);
        return completion;
      } catch (e) {
        throw new Error("Error getting prompt completion.");
      }
    }

  }

  // This constructs a new session if we need to adding in any sys messages or previous chats
  protected _buildSession(messages: BaseMessage[]): string {
    let prompt = ""
    let sysMessage = "";
    let interactions: ConversationInteraction[];
    interactions = []

    // Let's see if we have a system message
    if (messages.findIndex(msg => msg._getType() === "system") !== -1) {
        const sysMessages = messages.filter(
          (message) => message._getType() === "system"
        );

        // Only use the last provided system message
        sysMessage = sysMessages[sysMessages.length-1].content;

        // Now filter out the system messages
        messages = messages.filter(
          (message) => message._getType() !== "system"
        );

    }

    // Lets see if we just have a prompt left or are their previous interactions?
    if (messages.length > 1) {
      // Is the last message a prompt?
      if (messages[messages.length -1]._getType() === "human") {
        prompt = messages[messages.length -1].content;
        interactions = this._convertMessagesToInteractions(messages.slice(0, messages.length-1));
      } else {
        interactions = this._convertMessagesToInteractions(messages);
      }
    } else {
      // If there was only a single message we assume it's a prompt
      prompt = messages[0].content;
    }

    // Now lets construct a session according to what we got
    console.log("_buildSession, conversationHistory: " + JSON.stringify(interactions) + ", systemPrompt: " + sysMessage);
    if (sysMessage !== "" && interactions.length > 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        conversationHistory: interactions,
        systemPrompt: sysMessage,
      });
    } else if (sysMessage !== "" && interactions.length === 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        systemPrompt: sysMessage,
      });
    } else if (sysMessage === "" && interactions.length > 0) {
      this._session = new LlamaChatSession({
        context: this._context,
        conversationHistory: interactions,
      });
    } else {
      this._session = new LlamaChatSession({
        context: this._context,
      });
    }

    return prompt;
  }

  // This builds a an array of interactions
  protected _convertMessagesToInteractions(messages: BaseMessage[]): ConversationInteraction[] {
    let result = [];

    for (let i = 0; i < messages.length; i += 2) {

      if (i + 1 < messages.length) {
        result.push({
          prompt: messages[i].content,
          response: messages[i + 1].content,
        });
      }
    }

    return result;
  }

}
