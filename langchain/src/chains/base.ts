import {
  type LoadValues,
  type ChainInputs,
  BaseChain as CoreBaseChain,
} from "@langchain/core/legacy/chains";
import { SerializedBaseChain } from "./serde.js";

export type { LoadValues, ChainInputs };

export abstract class BaseChain extends CoreBaseChain {
  /**
   * Return a json-like object representing this chain.
   */
  serialize(): SerializedBaseChain {
    throw new Error("Method not implemented.");
  }

  /**
   * Load a chain from a json-like object describing it.
   */
  static async deserialize(
    data: SerializedBaseChain,
    values: LoadValues = {}
  ): Promise<BaseChain> {
    switch (data._type) {
      case "llm_chain": {
        const { LLMChain } = await import("./llm_chain.js");
        return LLMChain.deserialize(data);
      }
      case "sequential_chain": {
        const { SequentialChain } = await import("./sequential_chain.js");
        return SequentialChain.deserialize(data);
      }
      case "simple_sequential_chain": {
        const { SimpleSequentialChain } = await import("./sequential_chain.js");
        return SimpleSequentialChain.deserialize(data);
      }
      case "stuff_documents_chain": {
        const { StuffDocumentsChain } = await import("./combine_docs_chain.js");
        return StuffDocumentsChain.deserialize(data);
      }
      case "map_reduce_documents_chain": {
        const { MapReduceDocumentsChain } = await import(
          "./combine_docs_chain.js"
        );
        return MapReduceDocumentsChain.deserialize(data);
      }
      case "refine_documents_chain": {
        const { RefineDocumentsChain } = await import(
          "./combine_docs_chain.js"
        );
        return RefineDocumentsChain.deserialize(data);
      }
      case "vector_db_qa": {
        const { VectorDBQAChain } = await import("./vector_db_qa.js");
        return VectorDBQAChain.deserialize(data, values);
      }
      case "api_chain": {
        const { APIChain } = await import("./api/api_chain.js");
        return APIChain.deserialize(data);
      }
      default:
        throw new Error(
          `Invalid prompt type in config: ${
            (data as SerializedBaseChain)._type
          }`
        );
    }
  }
}
