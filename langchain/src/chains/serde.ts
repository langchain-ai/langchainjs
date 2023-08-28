import type { SerializedLLM } from "../llms/base.js";
import type { SerializedBasePromptTemplate } from "../prompts/serde.js";

/**
 * Represents the serialized form of an LLMChain. It includes properties
 * such as `_type`, `llm`, and `prompt`.
 */
export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  prompt?: SerializedBasePromptTemplate;
};

/**
 * Represents the serialized form of a SequentialChain. It includes
 * properties such as `_type`, `input_variables`, `output_variables`, and
 * `chains`.
 */
export type SerializedSequentialChain = {
  _type: "sequential_chain";
  input_variables: string[];
  output_variables: string[];
  chains: SerializedBaseChain[];
};

/**
 * Represents the serialized form of a SimpleSequentialChain. It includes
 * properties such as `_type` and `chains`.
 */
export type SerializedSimpleSequentialChain = {
  _type: "simple_sequential_chain";
  chains: Array<SerializedBaseChain>;
};

/**
 * Represents the serialized form of a VectorDBQAChain. It includes
 * properties such as `_type`, `k`, and `combine_documents_chain`.
 */
export type SerializedVectorDBQAChain = {
  _type: "vector_db_qa";
  k: number;
  combine_documents_chain: SerializedBaseChain;
};

/**
 * Represents the serialized form of an APIChain. It includes properties
 * such as `_type`, `api_request_chain`, `api_answer_chain`, and
 * `api_docs`.
 */
export type SerializedAPIChain = {
  _type: "api_chain";
  api_request_chain: SerializedLLMChain;
  api_answer_chain: SerializedLLMChain;
  api_docs: string;
};

/**
 * Represents the serialized form of a StuffDocumentsChain. It includes
 * properties such as `_type` and `llm_chain`.
 */
export type SerializedStuffDocumentsChain = {
  _type: "stuff_documents_chain";
  llm_chain?: SerializedLLMChain;
};

/**
 * Represents the serialized form of a ChatVectorDBQAChain. It includes
 * properties such as `_type`, `k`, `combine_documents_chain`, and
 * `question_generator`.
 */
export type SerializedChatVectorDBQAChain = {
  _type: "chat-vector-db";
  k: number;
  combine_documents_chain: SerializedBaseChain;
  question_generator: SerializedLLMChain;
};

/**
 * Represents the serialized form of a MapReduceDocumentsChain. It
 * includes properties such as `_type`, `llm_chain`, and
 * `combine_document_chain`.
 */
export type SerializedMapReduceDocumentsChain = {
  _type: "map_reduce_documents_chain";
  llm_chain?: SerializedLLMChain;
  combine_document_chain?: SerializedStuffDocumentsChain;
};

/**
 * Represents the serialized form of a RefineDocumentsChain. It includes
 * properties such as `_type`, `llm_chain`, and `refine_llm_chain`.
 */
export type SerializedRefineDocumentsChain = {
  _type: "refine_documents_chain";
  llm_chain?: SerializedLLMChain;
  refine_llm_chain?: SerializedLLMChain;
};

/**
 * Represents the serialized form of an AnalyzeDocumentChain. It includes
 * properties such as `_type` and `combine_document_chain`.
 */
export type SerializedAnalyzeDocumentChain = {
  _type: "analyze_document_chain";
  combine_document_chain?: SerializedBaseChain;
};

/**
 * Represents the serialized form of a ConstitutionalPrinciple. It
 * includes properties such as `_type`, `critiqueRequest`,
 * `revisionRequest`, and `name`.
 */
export type SerializedConstitutionalPrinciple = {
  _type: "constitutional_principle";
  critiqueRequest: string;
  revisionRequest: string;
  name: string;
};

/**
 * Represents the serialized form of a ConstitutionalChain. It includes
 * properties such as `_type`, `chain`, `critiqueChain`, `revisionChain`,
 * and `ConstitutionalPrinciple`.
 */
export type SerializedConstitutionalChain = {
  _type: "constitutional_chain";
  chain?: SerializedLLMChain;
  critiqueChain?: SerializedBaseChain;
  revisionChain?: SerializedBaseChain;
  ConstitutionalPrinciple?: SerializedConstitutionalPrinciple[];
};

/**
 * Represents the serialized form of a BaseChain. It can be one of the
 * above serialized chain types.
 */
export type SerializedBaseChain =
  | SerializedLLMChain
  | SerializedSequentialChain
  | SerializedSimpleSequentialChain
  | SerializedVectorDBQAChain
  | SerializedAPIChain
  | SerializedStuffDocumentsChain
  | SerializedChatVectorDBQAChain
  | SerializedMapReduceDocumentsChain
  | SerializedAnalyzeDocumentChain
  | SerializedRefineDocumentsChain
  | SerializedConstitutionalChain;
