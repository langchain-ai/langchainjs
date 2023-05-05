import type { SerializedLLM } from "../llms/base.js";
import type { SerializedBasePromptTemplate } from "../prompts/serde.js";
import type { SerializedSqlDatabase } from "../util/sql_utils.js";

export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  prompt?: SerializedBasePromptTemplate;
};

export type SerializedSequentialChain = {
  _type: "sequential_chain";
  input_variables: string[];
  output_variables: string[];
  chains: SerializedBaseChain[];
};

export type SerializedSimpleSequentialChain = {
  _type: "simple_sequential_chain";
  chains: Array<SerializedBaseChain>;
};

export type SerializedSqlDatabaseChain = {
  _type: "sql_database_chain";
  sql_database: SerializedSqlDatabase;
  llm: SerializedLLM;
};

export type SerializedVectorDBQAChain = {
  _type: "vector_db_qa";
  k: number;
  combine_documents_chain: SerializedBaseChain;
};

export type SerializedStuffDocumentsChain = {
  _type: "stuff_documents_chain";
  llm_chain?: SerializedLLMChain;
};

export type SerializedChatVectorDBQAChain = {
  _type: "chat-vector-db";
  k: number;
  combine_documents_chain: SerializedBaseChain;
  question_generator: SerializedLLMChain;
};

export type SerializedMapReduceDocumentsChain = {
  _type: "map_reduce_documents_chain";
  llm_chain?: SerializedLLMChain;
  combine_document_chain?: SerializedBaseChain;
};

export type SerializedRefineDocumentsChain = {
  _type: "refine_documents_chain";
  llm_chain?: SerializedLLMChain;
  refine_llm_chain?: SerializedLLMChain;
};

export type SerializedAnalyzeDocumentChain = {
  _type: "analyze_document_chain";
  combine_document_chain?: SerializedBaseChain;
};

export type SerializedConstitutionalPrinciple = {
  _type: "constitutional_principle";
  critiqueRequest: string;
  revisionRequest: string;
  name: string;
};

export type SerializedConstitutionalChain = {
  _type: "constitutional_chain";
  chain?: SerializedLLMChain;
  critiqueChain?: SerializedBaseChain;
  revisionChain?: SerializedBaseChain;
  ConstitutionalPrinciple?: SerializedConstitutionalPrinciple[];
};

export type SerializedBaseChain =
  | SerializedLLMChain
  | SerializedSequentialChain
  | SerializedSimpleSequentialChain
  | SerializedVectorDBQAChain
  | SerializedStuffDocumentsChain
  | SerializedSqlDatabaseChain
  | SerializedChatVectorDBQAChain
  | SerializedMapReduceDocumentsChain
  | SerializedAnalyzeDocumentChain
  | SerializedRefineDocumentsChain
  | SerializedConstitutionalChain;
