import type { SerializedLLM } from "../llms/base.js";
import type { SerializedBasePromptTemplate } from "../prompts/serde.js";
import type { SerializedSqlDatabase } from "../util/sql_utils.js";

export type SerializedLLMChain = {
  _type: "llm_chain";
  llm?: SerializedLLM;
  llm_path?: string;
  prompt?: SerializedBasePromptTemplate;
  prompt_path?: string;
};

export type SerializedSqlDatabaseChain = {
  sql_database: SerializedSqlDatabase;
  _type: "sql_database_chain";
  llm: SerializedLLM;
  sql_database_chain_path?: string;
};

export type SerializedVectorDBQAChain = {
  _type: "vector_db_qa";
  k: number;
  combine_documents_chain: SerializedBaseChain;
  combine_documents_chain_path?: string;
};

export type SerializedStuffDocumentsChain = {
  _type: "stuff_documents_chain";
  llm_chain?: SerializedLLMChain;
  llm_chain_path?: string;
};

export type SerializedChatVectorDBQAChain = {
  _type: "chat-vector-db";
  k: number;
  combine_documents_chain: SerializedBaseChain;
  combine_documents_chain_path?: string;
  question_generator: SerializedLLMChain;
};

export type SerializedMapReduceDocumentsChain = {
  _type: "map_reduce_documents_chain";
  llm_chain?: SerializedLLMChain;
  llm_chain_path?: string;
  combine_document_chain?: SerializedBaseChain;
  combine_document_chain_path?: string;
};

export type SerializedAnalyzeDocumentChain = {
  _type: "analyze_document_chain";
  combine_document_chain?: SerializedBaseChain;
  combine_document_chain_path?: string;
};

export type SerializedBaseChain =
  | SerializedLLMChain
  | SerializedVectorDBQAChain
  | SerializedStuffDocumentsChain
  | SerializedSqlDatabaseChain
  | SerializedChatVectorDBQAChain
  | SerializedMapReduceDocumentsChain
  | SerializedAnalyzeDocumentChain;
