import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { ChainValues } from "@langchain/core/utils/types";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { CallbackManagerForChainRun } from "@langchain/core/callbacks/manager";
import { LLMChain, BaseChain, ChainInputs } from "langchain/chains";
import { Neo4jGraph } from "../../graphs/neo4j_graph.js";
import { CYPHER_GENERATION_PROMPT, CYPHER_QA_PROMPT } from "./prompts.js";

export const INTERMEDIATE_STEPS_KEY = "intermediateSteps";

export interface GraphCypherQAChainInput extends ChainInputs {
  graph: Neo4jGraph;
  cypherGenerationChain: LLMChain;
  qaChain: LLMChain;
  inputKey?: string;
  outputKey?: string;
  topK?: number;
  returnIntermediateSteps?: boolean;
  returnDirect?: boolean;
}

export interface FromLLMInput {
  graph: Neo4jGraph;
  llm?: BaseLanguageModelInterface;
  cypherLLM?: BaseLanguageModelInterface;
  qaLLM?: BaseLanguageModelInterface;
  qaPrompt?: BasePromptTemplate;
  cypherPrompt?: BasePromptTemplate;
  returnIntermediateSteps?: boolean;
  returnDirect?: boolean;
}

/**
 * Chain for question-answering against a graph by generating Cypher statements.
 *
 * @example
 * ```typescript
 * const chain = new GraphCypherQAChain({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
 *   graph: new Neo4jGraph(),
 * });
 * const res = await chain.invoke("Who played in Pulp Fiction?");
 * ```
 *
 * @security
 * This chain will execute Cypher statements against the provided database.
 * Make sure that the database connection uses credentials
 * that are narrowly-scoped to only include necessary permissions.
 * Failure to do so may result in data corruption or loss, since the calling code
 * may attempt commands that would result in deletion, mutation of data
 * if appropriately prompted or reading sensitive data if such data is present in the database.
 * The best way to guard against such negative outcomes is to (as appropriate) limit the
 * permissions granted to the credentials used with this tool.
 *
 * See https://js.langchain.com/docs/security for more information.
 */
export class GraphCypherQAChain extends BaseChain {
  private graph: Neo4jGraph;

  private cypherGenerationChain: LLMChain;

  private qaChain: LLMChain;

  private inputKey = "query";

  private outputKey = "result";

  private topK = 10;

  private returnDirect = false;

  private returnIntermediateSteps = false;

  constructor(props: GraphCypherQAChainInput) {
    super(props);
    const {
      graph,
      cypherGenerationChain,
      qaChain,
      inputKey,
      outputKey,
      topK,
      returnIntermediateSteps,
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
    if (returnIntermediateSteps) {
      this.returnIntermediateSteps = returnIntermediateSteps;
    }
    if (returnDirect) {
      this.returnDirect = returnDirect;
    }
  }

  _chainType() {
    return "graph_cypher_chain" as const;
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  static fromLLM(props: FromLLMInput): GraphCypherQAChain {
    const {
      graph,
      qaPrompt = CYPHER_QA_PROMPT,
      cypherPrompt = CYPHER_GENERATION_PROMPT,
      llm,
      cypherLLM,
      qaLLM,
      returnIntermediateSteps = false,
      returnDirect = false,
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
      llm: (qaLLM || llm) as BaseLanguageModelInterface,
      prompt: qaPrompt,
    });

    const cypherGenerationChain = new LLMChain({
      llm: (cypherLLM || llm) as BaseLanguageModelInterface,
      prompt: cypherPrompt,
    });

    return new GraphCypherQAChain({
      cypherGenerationChain,
      qaChain,
      graph,
      returnIntermediateSteps,
      returnDirect,
    });
  }

  private extractCypher(text: string): string {
    const pattern = /```(.*?)```/s;
    const matches = text.match(pattern);
    return matches ? matches[1] : text;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const callbacks = runManager?.getChild();
    const question = values[this.inputKey];

    const intermediateSteps = [];

    const generatedCypher = await this.cypherGenerationChain.call(
      { question, schema: this.graph.getSchema() },
      callbacks
    );

    const extractedCypher = this.extractCypher(generatedCypher.text);

    await runManager?.handleText(`Generated Cypher:\n`);
    await runManager?.handleText(`${extractedCypher} green\n`);

    intermediateSteps.push({ query: extractedCypher });

    let chainResult: ChainValues;
    const context = await this.graph.query(extractedCypher, {
      topK: this.topK,
    });

    if (this.returnDirect) {
      chainResult = { [this.outputKey]: context };
    } else {
      await runManager?.handleText("Full Context:\n");
      await runManager?.handleText(`${context} green\n`);

      intermediateSteps.push({ context });

      const result = await this.qaChain.call(
        { question, context: JSON.stringify(context) },
        callbacks
      );

      chainResult = {
        [this.outputKey]: result[this.qaChain.outputKey],
      };
    }

    if (this.returnIntermediateSteps) {
      chainResult[INTERMEDIATE_STEPS_KEY] = intermediateSteps;
    }

    return chainResult;
  }
}
