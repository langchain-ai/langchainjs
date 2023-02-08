type LLMCallbackManager = {
  handleStart: (
    llm: { name: string },
    prompts: string[],
    verbose?: boolean
  ) => void;
  handleError: (err: string, verbose?: boolean) => void;
  handleEnd: (output: LLMResult, verbose?: boolean) => void;
};

const cache = null;

type Generation = {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
};

type LLMResult = {
  generations: Generation[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
};

export abstract class BaseLLM {
  name: string;

  cache?: boolean;

  callbackManager: LLMCallbackManager;

  verbose?: boolean = false;

  abstract _generate(prompts: string[], stop?: string[]): LLMResult;

  _generateUncached(prompts: string[], stop?: string[]): LLMResult {
    this.callbackManager.handleStart(
      { name: this.name },
      prompts,
      this.verbose
    );
    let output;
    try {
      output = this._generate(prompts, stop);
    } catch (err) {
      this.callbackManager.handleError(`${err}`, this.verbose);
      throw err;
    }

    this.callbackManager.handleEnd(output, this.verbose);
    return output;
  }

  generate(prompts: string[], stop?: string[]): LLMResult {
    if (!Array.isArray(prompts)) {
      throw new Error("Argument 'prompts' is expected to be a string[]");
    }

    if (this.cache === true && cache === null) {
      throw new Error("Requested cache, but no cache found");
    }

    if (cache === null || this.cache === false) {
      return this._generateUncached(prompts, stop);
    }

    throw new Error("unimplemented");
  }

  serialize() {}
}

