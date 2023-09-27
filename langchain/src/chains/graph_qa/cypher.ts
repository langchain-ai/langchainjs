import { LLMChain } from "../../chains/llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { Neo4jGraph } from "../../graphs/neo4j_graph.js";
import { CYPHER_GENERATION_PROMPT, CYPHER_QA_PROMPT } from "./prompts.js";

export class GraphCypherQAChain {
  private graph: Neo4jGraph;

  private cypherGenerationChain: LLMChain;

  private qaChain: LLMChain;

  private inputKey = "query";

  private outputKey = "result";

  private topK = 10;

  private returnDirect = false;

  // private returnIntermediateSteps = false;

  constructor(props: {
    graph: Neo4jGraph;
    cypherGenerationChain: LLMChain;
    qaChain: LLMChain;
    inputKey?: string;
    outputKey?: string;
    topK?: number;
    returnIntermediateSteps?: boolean;
    returnDirect?: boolean;
  }) {
    const {
      graph,
      cypherGenerationChain,
      qaChain,
      inputKey,
      outputKey,
      topK,
      // returnIntermediateSteps,
      returnDirect,
    } = props;

    this.graph = graph;
    this.cypherGenerationChain = cypherGenerationChain;
    this.qaChain = qaChain;

    if (inputKey) {
      this.inputKey = inputKey;
    }
    if (outputKey) {
      this.outputKey = outputKey;
    }
    if (topK) {
      this.topK = topK;
    }
    // if (returnIntermediateSteps) {
    //   this.returnIntermediateSteps = returnIntermediateSteps;
    // }
    if (returnDirect) {
      this.returnDirect = returnDirect;
    }
  }

  // Getters for input and output keys
  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  // Getter for chain type
  get chainType(): string {
    return "graph_cypher_chain";
  }

  // Static factory method for creating instances from LLM
  static fromLLM(props: {
    graph: Neo4jGraph;
    llm: BaseLanguageModel;
    qaPrompt?: BasePromptTemplate;
    cypherPrompt?: BasePromptTemplate;
    cypherLLM?: BaseLanguageModel | null;
    qaLLM?: BaseLanguageModel | null;
  }): GraphCypherQAChain {
    const {
      graph,
      qaPrompt = CYPHER_QA_PROMPT,
      cypherPrompt = CYPHER_GENERATION_PROMPT,
      llm,
      cypherLLM = null,
      qaLLM = null,
    } = props;

    if (!cypherLLM && !llm) {
      throw new Error(
        "Either 'llm' or 'cypherLLM' parameters must be provided"
      );
    }
    if (!qaLLM && !llm) {
      throw new Error("Either 'llm' or 'qaLLM' parameters must be provided");
    }
    if (cypherLLM && qaLLM && llm) {
      throw new Error(
        "You can specify up to two of 'cypherLLM', 'qaLLM', and 'llm', but not all three simultaneously."
      );
    }

    const qaChain = new LLMChain({
      llm: qaLLM || llm,
      prompt: qaPrompt,
    });
    const cypherGenerationChain = new LLMChain({
      llm: cypherLLM || llm,
      prompt: cypherPrompt,
    });

    return new GraphCypherQAChain({
      cypherGenerationChain,
      qaChain,
      graph,
    });
  }

  // Private method for extracting Cypher code from text
  private extractCypher(text: string): string {
    const pattern = /```(.*?)```/s;
    const matches = text.match(pattern);
    return matches ? matches[1] : text;
  }

  // Main method for executing the chain
  async run(
    inputs: { [key: string]: any },
    runManager: CallbackManagerForChainRun | null = null
  ): Promise<{ [key: string]: any }> {
    const _runManager = runManager;

    if (!_runManager) {
      throw new Error("'runManager' must be provided");
    }

    const callbacks = _runManager.getChild();
    const question = inputs[this.inputKey];

    const intermediateSteps = [];

    let generatedCypher = await this.cypherGenerationChain.run(
      { question, schema: this.graph.getSchema() },
      callbacks
    );
    console.log("generatedCypher", generatedCypher);
    generatedCypher = this.extractCypher(generatedCypher);

    await _runManager.handleText(`Generated Cypher:\n`);
    await _runManager.handleText(`${generatedCypher} green\n`);

    intermediateSteps.push({ query: generatedCypher });

    const context = await this.graph.query(generatedCypher, this.topK);

    if (this.returnDirect) {
      return { [this.outputKey]: context };
    } else {
      await _runManager.handleText("Full Context:\n");
      await _runManager.handleText(`${context.toString()} green\n`);

      intermediateSteps.push({ context });

      const result = await this.qaChain.call({ question, context }, callbacks);

      return { [this.outputKey]: result[this.qaChain.outputKey] };
    }
  }
}
