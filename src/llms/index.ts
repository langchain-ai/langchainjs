import { BaseCache, InMemoryCache } from "../cache";

const getCallbackManager = (): LLMCallbackManager => ({
  handleStart: (...args) => {
    console.log(args);
  },
  handleEnd: (...args) => {
    console.log(args);
  },
  handleError: (...args) => {
    console.log(args);
  },
});

const getVerbosity = () => true;

export type LLMCallbackManager = {
  handleStart: (
    llm: { name: string },
    prompts: string[],
    verbose?: boolean
  ) => void;
  handleError: (err: string, verbose?: boolean) => void;
  handleEnd: (output: LLMResult, verbose?: boolean) => void;
};

const cache: BaseCache = new InMemoryCache();

export type Generation = {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
};

export type LLMResult = {
  generations: Generation[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
};

export abstract class BaseLLM {
  name: string;

  cache?: boolean;

  callbackManager: LLMCallbackManager;

  verbose?: boolean = false;

  constructor(callbackManager?: LLMCallbackManager, verbose?: boolean) {
    this.callbackManager = callbackManager ?? getCallbackManager();
    this.verbose = verbose ?? getVerbosity();
  }

  abstract _generate(prompts: string[], stop?: string[]): Promise<LLMResult>;

  async _generateUncached(
    prompts: string[],
    stop?: string[]
  ): Promise<LLMResult> {
    this.callbackManager.handleStart(
      { name: this.name },
      prompts,
      this.verbose
    );
    let output;
    try {
      output = await this._generate(prompts, stop);
    } catch (err) {
      this.callbackManager.handleError(`${err}`, this.verbose);
      throw err;
    }

    this.callbackManager.handleEnd(output, this.verbose);
    return output;
  }

  async generate(prompts: string[], stop?: string[]): Promise<LLMResult> {
    if (!Array.isArray(prompts)) {
      throw new Error("Argument 'prompts' is expected to be a string[]");
    }

    if (this.cache === true && cache === null) {
      throw new Error("Requested cache, but no cache found");
    }

    if (cache === null || this.cache === false) {
      return this._generateUncached(prompts, stop);
    }

    const params = this.serialize();
    params.stop = stop;

    const llmStringKey = `${Object.entries(params).sort()}`;
    const missingPromptIndices: number[] = [];
    const generations = prompts.map((prompt, index) => {
      const result = cache.lookup(prompt, llmStringKey);
      if (!result) {
        missingPromptIndices.push(index);
      }
      return result;
    });

    let llmOutput = {};
    if (missingPromptIndices.length > 0) {
      const results = await this._generateUncached(
        missingPromptIndices.map((i) => prompts[i]),
        stop
      );
      results.generations.forEach((generation, index) => {
        const promptIndex = missingPromptIndices[index];
        generations[promptIndex] = generation;
        cache.update(prompts[promptIndex], llmStringKey, generation);
      });
      llmOutput = results.llmOutput ?? {};
    }

    return { generations, llmOutput } as LLMResult;
  }

  async call(prompt: string, stop?: string[]) {
    const { generations } = await this.generate([prompt], stop);
    return generations[0][0].text;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _identifyingParams(): Record<string, any> {
    return {};
  }

  abstract _llmType(): string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize(): Record<string, any> {
    return {
      ...this._identifyingParams(),
      _type: this._llmType(),
    };
  }

  // TODO(sean): save to disk, get_num_tokens
}

export abstract class LLM extends BaseLLM {
  abstract _call(prompt: string, stop?: string[]): Promise<string>;

  async _generate(prompts: string[], stop?: string[]): Promise<LLMResult> {
    const generations = [];
    for (let i = 0; i < prompts.length; i += 1) {
      const text = await this._call(prompts[i], stop);
      generations.push([{ text }]);
    }
    return { generations };
  }
}
