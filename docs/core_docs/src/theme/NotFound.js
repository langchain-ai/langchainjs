/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-nested-ternary */
import React from "react";
import { translate } from "@docusaurus/Translate";
import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";

import { useLocation } from "react-router-dom";

function LegacyBadge() {
  return <span className="badge badge--secondary">LEGACY</span>;
}

const suggestedLinks = {
  "/docs/additional_resources/tutorials/expression_language_cheatsheet/": {
    canonical: "/docs/how_to/lcel_cheatsheet/",
    alternative: [
      "/v0.1/docs/additional_resources/tutorials/expression_language_cheatsheet/",
    ],
  },
  "/docs/ecosystem/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/"],
  },
  "/docs/ecosystem/integrations/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/integrations/"],
  },
  "/docs/ecosystem/integrations/databerry/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/integrations/databerry/"],
  },
  "/docs/ecosystem/integrations/helicone/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/integrations/helicone/"],
  },
  "/docs/ecosystem/integrations/lunary/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/integrations/lunary/"],
  },
  "/docs/ecosystem/integrations/makersuite/": {
    canonical: "/docs/integrations/platforms/",
    alternative: ["/v0.1/docs/ecosystem/integrations/makersuite/"],
  },
  "/docs/ecosystem/integrations/unstructured/": {
    canonical: "/docs/integrations/document_loaders/file_loaders/unstructured/",
    alternative: ["/v0.1/docs/ecosystem/integrations/unstructured/"],
  },
  "/docs/ecosystem/langserve/": {
    canonical:
      "https://api.js.langchain.com/classes/_langchain_core.runnables_remote.RemoteRunnable.html",
    alternative: ["/v0.1/docs/ecosystem/langserve/"],
  },
  "/docs/expression_language/": {
    canonical: "/docs/how_to/#langchain-expression-language-lcel",
    alternative: ["/v0.1/docs/expression_language/"],
  },
  "/docs/expression_language/cookbook/": {
    canonical: "/docs/how_to/#langchain-expression-language-lcel",
    alternative: ["/v0.1/docs/expression_language/cookbook/"],
  },
  "/docs/expression_language/cookbook/adding_memory/": {
    canonical: "/docs/how_to/message_history",
    alternative: ["/v0.1/docs/expression_language/cookbook/adding_memory/"],
  },
  "/docs/expression_language/cookbook/agents/": {
    canonical: "/docs/how_to/agent_executor",
    alternative: ["/v0.1/docs/expression_language/cookbook/agents/"],
  },
  "/docs/expression_language/cookbook/multiple_chains/": {
    canonical: "/docs/how_to/parallel",
    alternative: ["/v0.1/docs/expression_language/cookbook/multiple_chains/"],
  },
  "/docs/expression_language/cookbook/prompt_llm_parser/": {
    canonical: "/docs/tutorials/llm_chain",
    alternative: ["/v0.1/docs/expression_language/cookbook/prompt_llm_parser/"],
  },
  "/docs/expression_language/cookbook/retrieval/": {
    canonical: "/docs/tutorials/rag",
    alternative: ["/v0.1/docs/expression_language/cookbook/retrieval/"],
  },
  "/docs/expression_language/cookbook/sql_db/": {
    canonical: "/docs/tutorials/sql_qa",
    alternative: ["/v0.1/docs/expression_language/cookbook/sql_db/"],
  },
  "/docs/expression_language/cookbook/tools/": {
    canonical: "/docs/how_to/tool_calling/",
    alternative: ["/v0.1/docs/expression_language/cookbook/tools/"],
  },
  "/docs/expression_language/get_started/": {
    canonical: "/docs/how_to/sequence",
    alternative: ["/v0.1/docs/expression_language/get_started/"],
  },
  "/docs/expression_language/how_to/map/": {
    canonical: "/docs/how_to/cancel_execution/",
    alternative: ["/v0.1/docs/expression_language/how_to/map/"],
  },
  "/docs/expression_language/how_to/message_history/": {
    canonical: "/docs/how_to/message_history",
    alternative: ["/v0.1/docs/expression_language/how_to/message_history/"],
  },
  "/docs/expression_language/how_to/routing/": {
    canonical: "/docs/how_to/routing",
    alternative: ["/v0.1/docs/expression_language/how_to/routing/"],
  },
  "/docs/expression_language/how_to/with_history/": {
    canonical: "/docs/how_to/message_history",
    alternative: ["/v0.1/docs/expression_language/how_to/with_history/"],
  },
  "/docs/expression_language/interface/": {
    canonical: "/docs/how_to/lcel_cheatsheet",
    alternative: ["/v0.1/docs/expression_language/interface/"],
  },
  "/docs/expression_language/streaming/": {
    canonical: "/docs/how_to/streaming",
    alternative: ["/v0.1/docs/expression_language/streaming/"],
  },
  "/docs/expression_language/why/": {
    canonical: "/docs/concepts/#langchain-expression-language",
    alternative: ["/v0.1/docs/expression_language/why/"],
  },
  "/docs/get_started/": {
    canonical: "/docs/introduction/",
    alternative: ["/v0.1/docs/get_started/"],
  },
  "/docs/get_started/installation/": {
    canonical: "/docs/tutorials/",
    alternative: ["/v0.1/docs/get_started/installation/"],
  },
  "/docs/get_started/introduction/": {
    canonical: "/docs/tutorials/",
    alternative: ["/v0.1/docs/get_started/introduction/"],
  },
  "/docs/get_started/quickstart/": {
    canonical: "/docs/tutorials/",
    alternative: ["/v0.1/docs/get_started/quickstart/"],
  },
  "/docs/guides/": {
    canonical: "/docs/how_to/",
    alternative: ["/v0.1/docs/guides/"],
  },
  "/docs/guides/debugging/": {
    canonical: "/docs/how_to/debugging",
    alternative: ["/v0.1/docs/guides/debugging/"],
  },
  "/docs/guides/deployment/": {
    canonical: "https://langchain-ai.github.io/langgraph/cloud/",
    alternative: ["/v0.1/docs/guides/deployment/"],
  },
  "/docs/guides/deployment/nextjs/": {
    canonical: "https://github.com/langchain-ai/langchain-nextjs-template",
    alternative: ["/v0.1/docs/guides/deployment/nextjs/"],
  },
  "/docs/guides/deployment/sveltekit/": {
    canonical: "https://github.com/langchain-ai/langchain-nextjs-template",
    alternative: ["/v0.1/docs/guides/deployment/sveltekit/"],
  },
  "/docs/guides/evaluation/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/"],
  },
  "/docs/guides/evaluation/comparison/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/comparison/"],
  },
  "/docs/guides/evaluation/comparison/pairwise_embedding_distance/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: [
      "/v0.1/docs/guides/evaluation/comparison/pairwise_embedding_distance/",
    ],
  },
  "/docs/guides/evaluation/comparison/pairwise_string/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/comparison/pairwise_string/"],
  },
  "/docs/guides/evaluation/examples/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/examples/"],
  },
  "/docs/guides/evaluation/examples/comparisons/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/examples/comparisons/"],
  },
  "/docs/guides/evaluation/string/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/string/"],
  },
  "/docs/guides/evaluation/string/criteria/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/string/criteria/"],
  },
  "/docs/guides/evaluation/string/embedding_distance/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/string/embedding_distance/"],
  },
  "/docs/guides/evaluation/trajectory/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/trajectory/"],
  },
  "/docs/guides/evaluation/trajectory/trajectory_eval/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/evaluation/trajectory/trajectory_eval/"],
  },
  "/docs/guides/extending_langchain/": {
    canonical: "/docs/how_to/#custom",
    alternative: ["/v0.1/docs/guides/extending_langchain/"],
  },
  "/docs/guides/fallbacks/": {
    canonical: "/docs/how_to/fallbacks",
    alternative: ["/v0.1/docs/guides/fallbacks/"],
  },
  "/docs/guides/langsmith_evaluation/": {
    canonical:
      "https://docs.smith.langchain.com/tutorials/Developers/evaluation",
    alternative: ["/v0.1/docs/guides/langsmith_evaluation/"],
  },
  "/docs/guides/migrating/": {
    canonical: "https://js.langchain.com/v0.1/docs/guides/migrating/",
    alternative: ["/v0.1/docs/guides/migrating/"],
  },
  "/docs/integrations/chat_memory/": {
    canonical: "/docs/integrations/memory",
    alternative: ["/v0.1/docs/integrations/chat_memory/"],
  },
  "/docs/integrations/chat_memory/astradb/": {
    canonical: "/docs/integrations/memory/astradb",
    alternative: ["/v0.1/docs/integrations/chat_memory/astradb/"],
  },
  "/docs/integrations/chat_memory/cassandra/": {
    canonical: "/docs/integrations/memory/cassandra",
    alternative: ["/v0.1/docs/integrations/chat_memory/cassandra/"],
  },
  "/docs/integrations/chat_memory/cloudflare_d1/": {
    canonical: "/docs/integrations/memory/cloudflare_d1",
    alternative: ["/v0.1/docs/integrations/chat_memory/cloudflare_d1/"],
  },
  "/docs/integrations/chat_memory/convex/": {
    canonical: "/docs/integrations/memory/convex",
    alternative: ["/v0.1/docs/integrations/chat_memory/convex/"],
  },
  "/docs/integrations/chat_memory/dynamodb/": {
    canonical: "/docs/integrations/memory/dynamodb",
    alternative: ["/v0.1/docs/integrations/chat_memory/dynamodb/"],
  },
  "/docs/integrations/chat_memory/firestore/": {
    canonical: "/docs/integrations/memory/firestore",
    alternative: ["/v0.1/docs/integrations/chat_memory/firestore/"],
  },
  "/docs/integrations/chat_memory/ipfs_datastore/": {
    canonical: "/docs/integrations/memory/ipfs_datastore",
    alternative: ["/v0.1/docs/integrations/chat_memory/ipfs_datastore/"],
  },
  "/docs/integrations/chat_memory/momento/": {
    canonical: "/docs/integrations/memory/momento",
    alternative: ["/v0.1/docs/integrations/chat_memory/momento/"],
  },
  "/docs/integrations/chat_memory/mongodb/": {
    canonical: "/docs/integrations/memory/mongodb",
    alternative: ["/v0.1/docs/integrations/chat_memory/mongodb/"],
  },
  "/docs/integrations/chat_memory/motorhead_memory/": {
    canonical: "/docs/integrations/memory/motorhead_memory",
    alternative: ["/v0.1/docs/integrations/chat_memory/motorhead_memory/"],
  },
  "/docs/integrations/chat_memory/planetscale/": {
    canonical: "/docs/integrations/memory/planetscale",
    alternative: ["/v0.1/docs/integrations/chat_memory/planetscale/"],
  },
  "/docs/integrations/chat_memory/postgres/": {
    canonical: "/docs/integrations/memory/postgres",
    alternative: ["/v0.1/docs/integrations/chat_memory/postgres/"],
  },
  "/docs/integrations/chat_memory/redis/": {
    canonical: "/docs/integrations/memory/redis",
    alternative: ["/v0.1/docs/integrations/chat_memory/redis/"],
  },
  "/docs/integrations/chat_memory/upstash_redis/": {
    canonical: "/docs/integrations/memory/upstash_redis",
    alternative: ["/v0.1/docs/integrations/chat_memory/upstash_redis/"],
  },
  "/docs/integrations/chat_memory/xata/": {
    canonical: "/docs/integrations/memory/xata",
    alternative: ["/v0.1/docs/integrations/chat_memory/xata/"],
  },
  "/docs/integrations/chat_memory/zep_memory/": {
    canonical: "/docs/integrations/memory/zep_memory",
    alternative: ["/v0.1/docs/integrations/chat_memory/zep_memory/"],
  },
  "/docs/integrations/document_compressors/": {
    canonical: "/docs/integrations/document_transformers",
    alternative: ["/v0.1/docs/integrations/document_compressors/"],
  },
  "/docs/integrations/llms/togetherai/": {
    canonical: "/docs/integrations/llms/together",
    alternative: ["/v0.1/docs/integrations/llms/togetherai/"],
  },
  "/docs/integrations/llms/fake/": {
    canonical:
      "https://api.js.langchain.com/classes/_langchain_core.utils_testing.FakeLLM.html",
    alternative: ["/v0.1/docs/integrations/llms/fake/"],
  },
  "/docs/integrations/retrievers/vectorstore/": {
    canonical: "/docs/how_to/vectorstore_retriever",
    alternative: ["/v0.1/docs/integrations/retrievers/vectorstore/"],
  },
  "/docs/integrations/vectorstores/azure_cosmosdb/": {
    canonical: "/docs/integrations/vectorstores/azure_cosmosdb_mongodb",
    alternative: ["/v0.1/docs/integrations/vectorstores/azure_cosmosdb/"],
  },
  "/docs/langgraph/": {
    canonical: "https://langchain-ai.github.io/langgraphjs/",
    alternative: ["/v0.1/docs/langgraph/"],
  },
  "/docs/modules/": {
    canonical: "/docs/concepts/",
    alternative: ["/v0.1/docs/modules/"],
  },
  "/docs/modules/agents": {
    canonical: "/docs/concepts/agents/",
    alternative: ["/v0.1/docs/modules/agents/"],
  },
  "/docs/modules/agents/concepts/": {
    canonical: "/docs/concepts/agents/",
    alternative: ["/v0.1/docs/modules/agents/concepts/"],
  },
  "/docs/modules/agents/agent_types/": {
    canonical: "/docs/how_to/migrate_agent/",
    alternative: ["/v0.1/docs/modules/agents/agent_types/"],
  },
  "/docs/modules/agents/how_to/agent_structured/": {
    canonical: "/docs/how_to/migrate_agent/",
    alternative: ["/v0.1/docs/modules/agents/how_to/agent_structured/"],
  },
  "/docs/modules/agents/how_to/max_iterations/": {
    canonical: "/docs/how_to/migrate_agent/",
    alternative: ["/v0.1/docs/modules/agents/how_to/max_iterations/"],
  },
  "/docs/modules/agents/how_to/streaming/": {
    canonical: "/docs/how_to/migrate_agent/",
    alternative: ["/v0.1/docs/modules/agents/how_to/streaming/"],
  },
  "/docs/modules/agents/quick_start/": {
    canonical: "https://langchain-ai.github.io/langgraphjs//",
    alternative: ["/v0.1//docs/modules/agents/quick_start/"],
  },
  "/docs/modules/agents/agent_types/chat_conversation_agent/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: [
      "/v0.1/docs/modules/agents/agent_types/chat_conversation_agent/",
    ],
  },
  "/docs/modules/agents/agent_types/openai_assistant/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/openai_assistant/"],
  },
  "/docs/modules/agents/agent_types/openai_functions_agent/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: [
      "/v0.1/docs/modules/agents/agent_types/openai_functions_agent/",
    ],
  },
  "/docs/modules/agents/agent_types/openai_tools_agent/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/openai_tools_agent/"],
  },
  "/docs/modules/agents/agent_types/plan_and_execute/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/plan_and_execute/"],
  },
  "/docs/modules/agents/agent_types/react/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/react/"],
  },
  "/docs/modules/agents/agent_types/structured_chat/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/structured_chat/"],
  },
  "/docs/modules/agents/agent_types/tool_calling/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/tool_calling/"],
  },
  "/docs/modules/agents/agent_types/xml_legacy/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/xml_legacy/"],
  },
  "/docs/modules/agents/agent_types/xml/": {
    canonical: "/docs/how_to/migrate_agent",
    alternative: ["/v0.1/docs/modules/agents/agent_types/xml/"],
  },
  "/docs/modules/agents/how_to/callbacks/": {
    canonical: "/docs/how_to/#callbacks",
    alternative: ["/v0.1/docs/modules/agents/how_to/callbacks/"],
  },
  "/docs/modules/agents/how_to/cancelling_requests/": {
    canonical: "/docs/how_to/cancel_execution",
    alternative: ["/v0.1/docs/modules/agents/how_to/cancelling_requests/"],
  },
  "/docs/modules/agents/how_to/custom_agent/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/",
    alternative: ["/v0.1/docs/modules/agents/how_to/custom_agent/"],
  },
  "/docs/modules/agents/how_to/custom_llm_agent/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/",
    alternative: ["/v0.1/docs/modules/agents/how_to/custom_llm_agent/"],
  },
  "/docs/modules/agents/how_to/custom_llm_chat_agent/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/",
    alternative: ["/v0.1/docs/modules/agents/how_to/custom_llm_chat_agent/"],
  },
  "/docs/modules/agents/how_to/custom_mrkl_agent/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/",
    alternative: ["/v0.1/docs/modules/agents/how_to/custom_mrkl_agent/"],
  },
  "/docs/modules/agents/how_to/handle_parsing_errors/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling-errors/",
    alternative: ["/v0.1/docs/modules/agents/how_to/handle_parsing_errors/"],
  },
  "/docs/modules/agents/how_to/intermediate_steps/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/how-tos/stream-values/",
    alternative: ["/v0.1/docs/modules/agents/how_to/intermediate_steps/"],
  },
  "/docs/modules/agents/how_to/logging_and_tracing/": {
    canonical:
      "https://docs.smith.langchain.com/how_to_guides/tracing/trace_with_langgraph",
    alternative: ["/v0.1/docs/modules/agents/how_to/logging_and_tracing/"],
  },
  "/docs/modules/agents/how_to/timeouts/": {
    canonical: "/docs/how_to/cancel_execution/",
    alternative: ["/v0.1/docs/modules/agents/how_to/timeouts/"],
  },
  "/docs/modules/agents/tools/": {
    canonical:
      "https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/",
    alternative: ["/v0.1/docs/modules/agents/tools/"],
  },
  "/docs/modules/agents/tools/dynamic/": {
    canonical: "/docs/how_to/custom_tools/",
    alternative: ["/v0.1/docs/modules/agents/tools/dynamic/"],
  },
  "/docs/modules/agents/tools/how_to/agents_with_vectorstores/": {
    canonical: "/docs/how_to/custom_tools",
    alternative: [
      "/v0.1/docs/modules/agents/tools/how_to/agents_with_vectorstores/",
    ],
  },
  "/docs/modules/agents/tools/toolkits/": {
    canonical: "/docs/how_to/tools_builtin",
    alternative: ["/v0.1/docs/modules/agents/tools/toolkits/"],
  },
  "/docs/modules/callbacks/how_to/background_callbacks/": {
    canonical: "/docs/how_to/callbacks_backgrounding",
    alternative: ["/v0.1/docs/modules/callbacks/how_to/background_callbacks/"],
  },
  "/docs/modules/callbacks/how_to/create_handlers/": {
    canonical: "/docs/how_to/custom_callbacks",
    alternative: ["/v0.1/docs/modules/callbacks/how_to/create_handlers/"],
  },
  "/docs/modules/callbacks/how_to/creating_subclasses/": {
    canonical: "/docs/how_to/custom_callbacks",
    alternative: ["/v0.1/docs/modules/callbacks/how_to/creating_subclasses/"],
  },
  "/docs/modules/callbacks/how_to/tags/": {
    canonical: "/docs/how_to/#callbacks",
    alternative: ["/v0.1/docs/modules/callbacks/how_to/tags/"],
  },
  "/docs/modules/callbacks/how_to/with_listeners/": {
    canonical: "/docs/how_to/#callbacks",
    alternative: ["/v0.1/docs/modules/callbacks/how_to/with_listeners/"],
  },
  "/docs/modules/chains/": {
    canonical: "/docs/how_to/sequence",
    alternative: ["/v0.1/docs/modules/chains/"],
  },
  "/docs/modules/chains/additional/analyze_document/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/additional/analyze_document/",
    alternative: ["/v0.1/docs/modules/chains/additional/analyze_document/"],
  },
  "/docs/modules/chains/additional/constitutional_chain/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/additional/constitutional_chain/",
    alternative: ["/v0.1/docs/modules/chains/additional/constitutional_chain/"],
  },
  "/docs/modules/chains/additional/cypher_chain/": {
    canonical: "/docs/tutorials/graph",
    alternative: ["/v0.1/docs/modules/chains/additional/cypher_chain/"],
  },
  "/docs/modules/chains/additional/moderation/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/additional/moderation/",
    alternative: ["/v0.1/docs/modules/chains/additional/moderation/"],
  },
  "/docs/modules/chains/additional/multi_prompt_router/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/additional/multi_prompt_router/",
    alternative: ["/v0.1/docs/modules/chains/additional/multi_prompt_router/"],
  },
  "/docs/modules/chains/additional/multi_retrieval_qa_router/": {
    canonical: "/docs/how_to/multiple_queries",
    alternative: [
      "/v0.1/docs/modules/chains/additional/multi_retrieval_qa_router/",
    ],
  },
  "/docs/modules/chains/additional/openai_functions/": {
    canonical: "/docs/how_to/tool_calling",
    alternative: ["/v0.1/docs/modules/chains/additional/openai_functions/"],
  },
  "/docs/modules/chains/additional/openai_functions/extraction/": {
    canonical: "/docs/tutorials/extraction",
    alternative: [
      "/v0.1/docs/modules/chains/additional/openai_functions/extraction/",
    ],
  },
  "/docs/modules/chains/additional/openai_functions/openapi/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/additional/openai_functions/openapi/",
    alternative: [
      "/v0.1/docs/modules/chains/additional/openai_functions/openapi/",
    ],
  },
  "/docs/modules/chains/additional/openai_functions/tagging/": {
    canonical: "/docs/tutorials/extraction",
    alternative: [
      "/v0.1/docs/modules/chains/additional/openai_functions/tagging/",
    ],
  },
  "/docs/modules/chains/document/": {
    canonical:
      "https://api.js.langchain.com/functions/langchain.chains_combine_documents.createStuffDocumentsChain.html",
    alternative: ["/v0.1/docs/modules/chains/document/"],
  },
  "/docs/modules/chains/document/map_reduce/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/document/map_reduce/",
    alternative: ["/v0.1/docs/modules/chains/document/map_reduce/"],
  },
  "/docs/modules/chains/document/refine/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/document/refine/",
    alternative: ["/v0.1/docs/modules/chains/document/refine/"],
  },
  "/docs/modules/chains/document/stuff/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/chains/document/stuff/",
    alternative: ["/v0.1/docs/modules/chains/document/stuff/"],
  },
  "/docs/modules/chains/foundational/llm_chain/": {
    canonical: "/docs/tutorials/llm_chain",
    alternative: ["/v0.1/docs/modules/chains/foundational/llm_chain/"],
  },
  "/docs/modules/chains/how_to/debugging/": {
    canonical: "/docs/how_to/debugging",
    alternative: ["/v0.1/docs/modules/chains/how_to/debugging/"],
  },
  "/docs/modules/chains/how_to/memory/": {
    canonical: "/docs/how_to/qa_chat_history_how_to",
    alternative: ["/v0.1/docs/modules/chains/how_to/memory/"],
  },
  "/docs/modules/chains/popular/api/": {
    canonical: "https://js.langchain.com/v0.1/docs/modules/chains/popular/api/",
    alternative: ["/v0.1/docs/modules/chains/popular/api/"],
  },
  "/docs/modules/chains/popular/chat_vector_db_legacy/": {
    canonical: "/docs/tutorials/rag",
    alternative: ["/v0.1/docs/modules/chains/popular/chat_vector_db_legacy/"],
  },
  "/docs/modules/chains/popular/chat_vector_db/": {
    canonical: "/docs/tutorials/rag",
    alternative: ["/v0.1/docs/modules/chains/popular/chat_vector_db/"],
  },
  "/docs/modules/chains/popular/sqlite_legacy/": {
    canonical: "/docs/tutorials/sql_qa",
    alternative: ["/v0.1/docs/modules/chains/popular/sqlite_legacy/"],
  },
  "/docs/modules/chains/popular/sqlite/": {
    canonical: "/docs/tutorials/sql_qa",
    alternative: ["/v0.1/docs/modules/chains/popular/sqlite/"],
  },
  "/docs/modules/chains/popular/structured_output/": {
    canonical: "/docs/how_to/structured_output",
    alternative: ["/v0.1/docs/modules/chains/popular/structured_output/"],
  },
  "/docs/modules/chains/popular/summarize/": {
    canonical: "/docs/tutorials/summarization",
    alternative: ["/v0.1/docs/modules/chains/popular/summarize/"],
  },
  "/docs/modules/chains/popular/vector_db_qa_legacy/": {
    canonical: "/docs/tutorials/rag",
    alternative: ["/v0.1/docs/modules/chains/popular/vector_db_qa_legacy/"],
  },
  "/docs/modules/chains/popular/vector_db_qa/": {
    canonical: "/docs/tutorials/rag",
    alternative: ["/v0.1/docs/modules/chains/popular/vector_db_qa/"],
  },
  "/docs/modules/data_connection/": {
    canonical: "/docs/concepts/rag",
    alternative: ["/v0.1/docs/modules/data_connection/"],
  },
  "/docs/modules/data_connection/document_loaders/": {
    canonical: "/docs/concepts/document_loaders",
    alternative: ["/v0.1/docs/modules/data_connection/document_loaders/"],
  },
  "/docs/modules/data_connection/document_loaders/csv/": {
    canonical: "/docs/integrations/document_loaders/file_loaders/csv/",
    alternative: ["/v0.1/docs/modules/data_connection/document_loaders/csv/"],
  },
  "/docs/modules/data_connection/document_loaders/custom/": {
    canonical: "/docs/how_to/document_loader_custom/",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_loaders/custom/",
    ],
  },
  "/docs/modules/data_connection/document_loaders/file_directory/": {
    canonical: "/docs/integrations/document_loaders/file_loaders/directory/",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_loaders/file_directory/",
    ],
  },
  "/docs/modules/data_connection/document_loaders/json/": {
    canonical: "/docs/integrations/document_loaders/file_loaders/json/",
    alternative: ["/v0.1/docs/modules/data_connection/document_loaders/json/"],
  },
  "/docs/modules/data_connection/document_loaders/pdf/": {
    canonical: "/docs/integrations/document_loaders/file_loaders/pdf/",
    alternative: ["/v0.1/docs/modules/data_connection/document_loaders/pdf/"],
  },
  "/docs/modules/data_connection/document_transformers/": {
    canonical: "/docs/concepts/text_splitters/",
    alternative: ["/v0.1/docs/modules/data_connection/document_transformers/"],
  },
  "/docs/modules/data_connection/document_transformers/character_text_splitter/":
    {
      canonical: "/docs/how_to/character_text_splitter/",
      alternative: [
        "/v0.1/docs/modules/data_connection/document_transformers/character_text_splitter/",
      ],
    },
  "/docs/modules/data_connection/document_transformers/code_splitter/": {
    canonical: "/docs/how_to/code_splitter/",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_transformers/code_splitter/",
    ],
  },
  "/docs/modules/data_connection/document_transformers/recursive_text_splitter/":
    {
      canonical: "/docs/how_to/recursive_text_splitter/",
      alternative: [
        "/v0.1/docs/modules/data_connection/document_transformers/recursive_text_splitter/",
      ],
    },
  "/docs/modules/data_connection/document_loaders/creating_documents/": {
    canonical: "/docs/concepts#document",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_loaders/creating_documents/",
    ],
  },
  "/docs/modules/data_connection/document_transformers/contextual_chunk_headers/":
    {
      canonical:
        "/docs/how_to/parent_document_retriever/#with-contextual-chunk-headers",
      alternative: [
        "/v0.1/docs/modules/data_connection/document_transformers/contextual_chunk_headers/",
      ],
    },
  "/docs/modules/data_connection/document_transformers/custom_text_splitter/": {
    canonical: "/docs/how_to/#text-splitters",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_transformers/custom_text_splitter/",
    ],
  },
  "/docs/modules/data_connection/document_transformers/token_splitter/": {
    canonical: "/docs/how_to/split_by_token",
    alternative: [
      "/v0.1/docs/modules/data_connection/document_transformers/token_splitter/",
    ],
  },
  "/docs/modules/data_connection/experimental/graph_databases/neo4j/": {
    canonical: "/docs/tutorials/graph",
    alternative: [
      "/v0.1/docs/modules/data_connection/experimental/graph_databases/neo4j/",
    ],
  },
  "/docs/modules/data_connection/experimental/multimodal_embeddings/google_vertex_ai/":
    {
      canonical:
        "https://js.langchain.com/v0.1/docs/modules/data_connection/experimental/multimodal_embeddings/google_vertex_ai/",
      alternative: [
        "/v0.1/docs/modules/data_connection/experimental/multimodal_embeddings/google_vertex_ai/",
      ],
    },
  "/docs/modules/data_connection/retrievers/custom/": {
    canonical: "/docs/how_to/custom_retriever",
    alternative: ["/v0.1/docs/modules/data_connection/retrievers/custom/"],
  },
  "/docs/modules/data_connection/retrievers/matryoshka_retriever/": {
    canonical: "/docs/how_to/reduce_retrieval_latency",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/matryoshka_retriever/",
    ],
  },
  "/docs/modules/data_connection/retrievers/multi-query-retriever/": {
    canonical: "/docs/how_to/multiple_queries",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/multi-query-retriever/",
    ],
  },
  "/docs/modules/data_connection/retrievers/multi-vector-retriever/": {
    canonical: "/docs/how_to/multi_vector",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/multi-vector-retriever/",
    ],
  },
  "/docs/modules/data_connection/retrievers/parent-document-retriever/": {
    canonical: "/docs/how_to/parent_document_retriever",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/parent-document-retriever/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/chroma-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/chroma",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/chroma-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/hnswlib-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/hnswlib",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/hnswlib-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/memory-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/memory",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/memory-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/pinecone-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/pinecone",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/pinecone-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/qdrant-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/qdrant",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/qdrant-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/supabase-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/supabase",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/supabase-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/vectara-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/vectara",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/vectara-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/self_query/weaviate-self-query/": {
    canonical: "/docs/integrations/retrievers/self_query/weaviate",
    alternative: [
      "/v0.1/docs/modules/data_connection/retrievers/self_query/weaviate-self-query/",
    ],
  },
  "/docs/modules/data_connection/retrievers/similarity-score-threshold-retriever/":
    {
      canonical:
        "https://api.js.langchain.com/classes/langchain.retrievers_score_threshold.ScoreThresholdRetriever.html",
      alternative: [
        "/v0.1/docs/modules/data_connection/retrievers/similarity-score-threshold-retriever/",
      ],
    },
  "/docs/modules/data_connection/text_embedding/api_errors/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/data_connection/text_embedding/api_errors/",
    alternative: [
      "/v0.1/docs/modules/data_connection/text_embedding/api_errors/",
    ],
  },
  "/docs/modules/data_connection/text_embedding/caching_embeddings/": {
    canonical: "/docs/how_to/caching_embeddings",
    alternative: [
      "/v0.1/docs/modules/data_connection/text_embedding/caching_embeddings/",
    ],
  },
  "/docs/modules/data_connection/text_embedding/rate_limits/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/data_connection/text_embedding/rate_limits/",
    alternative: [
      "/v0.1/docs/modules/data_connection/text_embedding/rate_limits/",
    ],
  },
  "/docs/modules/data_connection/text_embedding/timeouts/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/data_connection/text_embedding/timeouts/",
    alternative: [
      "/v0.1/docs/modules/data_connection/text_embedding/timeouts/",
    ],
  },
  "/docs/modules/data_connection/vectorstores/custom/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/data_connection/vectorstores/custom/",
    alternative: ["/v0.1/docs/modules/data_connection/vectorstores/custom/"],
  },
  "/docs/modules/experimental/": {
    canonical: "https://js.langchain.com/v0.1/docs/modules/experimental/",
    alternative: ["/v0.1/docs/modules/experimental/"],
  },
  "/docs/modules/experimental/mask/": {
    canonical:
      "https://api.js.langchain.com/modules/langchain.experimental_masking.html",
    alternative: ["/v0.1/docs/modules/experimental/mask/"],
  },
  "/docs/modules/experimental/prompts/custom_formats/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.experimental_prompts_handlebars.HandlebarsPromptTemplate.html",
    alternative: ["/v0.1/docs/modules/experimental/prompts/custom_formats/"],
  },
  "/docs/modules/memory/chat_messages/custom/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/modules/memory/chat_messages/custom/",
    alternative: ["/v0.1/docs/modules/memory/chat_messages/custom/"],
  },
  "/docs/modules/memory/types/buffer_memory_chat/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.BufferMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/buffer_memory_chat/"],
  },
  "/docs/modules/memory/types/buffer_window/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.BufferWindowMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/buffer_window/"],
  },
  "/docs/modules/memory/types/entity_summary_memory/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.EntityMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/entity_summary_memory/"],
  },
  "/docs/modules/memory/types/multiple_memory/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.CombinedMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/multiple_memory/"],
  },
  "/docs/modules/memory/types/summary_buffer/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.ConversationSummaryBufferMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/summary_buffer/"],
  },
  "/docs/modules/memory/types/summary/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.ConversationSummaryMemory.html",
    alternative: ["/v0.1/docs/modules/memory/types/summary/"],
  },
  "/docs/modules/memory/types/vectorstore_retriever_memory/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.memory.VectorStoreRetrieverMemory.html",
    alternative: [
      "/v0.1/docs/modules/memory/types/vectorstore_retriever_memory/",
    ],
  },
  "/docs/modules/model_io/chat/caching/": {
    canonical: "/docs/how_to/chat_model_caching",
    alternative: ["/v0.1/docs/modules/model_io/chat/caching/"],
  },
  "/docs/modules/model_io/chat/cancelling_requests/": {
    canonical: "/docs/how_to/cancel_execution",
    alternative: ["/v0.1/docs/modules/model_io/chat/cancelling_requests/"],
  },
  "/docs/modules/model_io/chat/custom_chat/": {
    canonical: "/docs/how_to/custom_chat",
    alternative: ["/v0.1/docs/modules/model_io/chat/custom_chat/"],
  },
  "/docs/modules/model_io/chat/dealing_with_api_errors/": {
    canonical: "/docs/how_to/fallbacks",
    alternative: ["/v0.1/docs/modules/model_io/chat/dealing_with_api_errors/"],
  },
  "/docs/modules/model_io/chat/dealing_with_rate_limits/": {
    canonical: "/docs/how_to/fallbacks",
    alternative: ["/v0.1/docs/modules/model_io/chat/dealing_with_rate_limits/"],
  },
  "/docs/modules/model_io/chat/subscribing_events/": {
    canonical: "/docs/how_to/custom_callbacks",
    alternative: ["/v0.1/docs/modules/model_io/chat/subscribing_events/"],
  },
  "/docs/modules/model_io/chat/timeouts/": {
    canonical: "/docs/how_to/custom_callbacks",
    alternative: ["/v0.1/docs/modules/model_io/chat/timeouts/"],
  },
  "/docs/modules/model_io/llms/cancelling_requests/": {
    canonical: "/docs/how_to/cancel_execution",
    alternative: ["/v0.1/docs/modules/model_io/llms/cancelling_requests/"],
  },
  "/docs/modules/model_io/llms/dealing_with_api_errors/": {
    canonical: "/docs/how_to/fallbacks",
    alternative: ["/v0.1/docs/modules/model_io/llms/dealing_with_api_errors/"],
  },
  "/docs/modules/model_io/llms/dealing_with_rate_limits/": {
    canonical: "/docs/how_to/fallbacks",
    alternative: ["/v0.1/docs/modules/model_io/llms/dealing_with_rate_limits/"],
  },
  "/docs/modules/model_io/llms/subscribing_events/": {
    canonical: "/docs/how_to/custom_callbacks",
    alternative: ["/v0.1/docs/modules/model_io/llms/subscribing_events/"],
  },
  "/docs/modules/model_io/llms/timeouts/": {
    canonical: "/docs/how_to/cancel_execution",
    alternative: ["/v0.1/docs/modules/model_io/llms/timeouts/"],
  },
  "/docs/modules/model_io/output_parsers/types/bytes/": {
    canonical:
      "https://api.js.langchain.com/modules/_langchain_core.output_parsers.html",
    alternative: ["/v0.1/docs/modules/model_io/output_parsers/types/bytes/"],
  },
  "/docs/modules/model_io/output_parsers/types/combining_output_parser/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.output_parsers.CombiningOutputParser.html",
    alternative: [
      "/v0.1/docs/modules/model_io/output_parsers/types/combining_output_parser/",
    ],
  },
  "/docs/modules/model_io/output_parsers/types/csv/": {
    canonical:
      "https://api.js.langchain.com/classes/_langchain_core.output_parsers.CommaSeparatedListOutputParser.html",
    alternative: ["/v0.1/docs/modules/model_io/output_parsers/types/csv/"],
  },
  "/docs/modules/model_io/output_parsers/types/custom_list_parser/": {
    canonical:
      "https://api.js.langchain.com/classes/_langchain_core.output_parsers.CustomListOutputParser.html",
    alternative: [
      "/v0.1/docs/modules/model_io/output_parsers/types/custom_list_parser/",
    ],
  },
  "/docs/modules/model_io/output_parsers/types/http_response/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.output_parsers.HttpResponseOutputParser.html",
    alternative: [
      "/v0.1/docs/modules/model_io/output_parsers/types/http_response/",
    ],
  },
  "/docs/modules/model_io/output_parsers/types/json_functions/": {
    canonical:
      "https://api.js.langchain.com/classes/langchain.output_parsers.JsonOutputFunctionsParser.html",
    alternative: [
      "/v0.1/docs/modules/model_io/output_parsers/types/json_functions/",
    ],
  },
  "/docs/modules/model_io/output_parsers/types/structured/": {
    canonical: "/docs/how_to/structured_output/",
    alternative: [
      "/v0.1/docs/modules/model_io/output_parsers/types/structured/",
    ],
  },
  "/docs/modules/model_io/output_parsers/types/string/": {
    canonical:
      "https://api.js.langchain.com/classes/_langchain_core.output_parsers.StringOutputParser.html",
    alternative: ["/v0.1/docs/modules/model_io/output_parsers/types/string/"],
  },
  "/docs/modules/model_io/prompts/example_selector_types/": {
    canonical: "/docs/how_to/#example-selectors",
    alternative: [
      "/v0.1/docs/modules/model_io/prompts/example_selector_types/",
    ],
  },
  "/docs/modules/model_io/prompts/example_selector_types/length_based/": {
    canonical: "/docs/how_to/example_selectors_length_based",
    alternative: [
      "/v0.1/docs/modules/model_io/prompts/example_selector_types/length_based/",
    ],
  },
  "/docs/modules/model_io/prompts/example_selector_types/similarity/": {
    canonical: "/docs/how_to/example_selectors_similarity",
    alternative: [
      "/v0.1/docs/modules/model_io/prompts/example_selector_types/similarity/",
    ],
  },
  "/docs/modules/model_io/prompts/few_shot/": {
    canonical: "/docs/how_to/few_shot_examples",
    alternative: ["/v0.1/docs/modules/model_io/prompts/few_shot/"],
  },
  "/docs/modules/model_io/prompts/pipeline/": {
    canonical: "/docs/how_to/prompts_composition",
    alternative: ["/v0.1/docs/modules/model_io/prompts/pipeline/"],
  },
  "/docs/production/deployment/": {
    canonical: "https://langchain-ai.github.io/langgraph/cloud/",
    alternative: ["/v0.1/docs/production/deployment/"],
  },
  "/docs/production/tracing/": {
    canonical:
      "https://docs.smith.langchain.com/how_to_guides/tracing/trace_with_langchain",
    alternative: ["/v0.1/docs/production/tracing/"],
  },
  "/docs/use_cases/agent_simulations/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/agent_simulations/",
    alternative: ["/v0.1/docs/use_cases/agent_simulations/"],
  },
  "/docs/use_cases/agent_simulations/generative_agents/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/agent_simulations/generative_agents/",
    alternative: ["/v0.1/docs/use_cases/agent_simulations/generative_agents/"],
  },
  "/docs/use_cases/agent_simulations/violation_of_expectations_chain/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/agent_simulations/violation_of_expectations_chain/",
    alternative: [
      "/v0.1/docs/use_cases/agent_simulations/violation_of_expectations_chain/",
    ],
  },
  "/docs/use_cases/api/": {
    canonical: "https://js.langchain.com/v0.1/docs/use_cases/api/",
    alternative: ["/v0.1/docs/use_cases/api/"],
  },
  "/docs/use_cases/autonomous_agents/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/autonomous_agents/",
    alternative: ["/v0.1/docs/use_cases/autonomous_agents/"],
  },
  "/docs/use_cases/autonomous_agents/auto_gpt/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/autonomous_agents/auto_gpt/",
    alternative: ["/v0.1/docs/use_cases/autonomous_agents/auto_gpt/"],
  },
  "/docs/use_cases/autonomous_agents/baby_agi/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/autonomous_agents/baby_agi/",
    alternative: ["/v0.1/docs/use_cases/autonomous_agents/baby_agi/"],
  },
  "/docs/use_cases/autonomous_agents/sales_gpt/": {
    canonical:
      "https://js.langchain.com/v0.1/docs/use_cases/autonomous_agents/sales_gpt/",
    alternative: ["/v0.1/docs/use_cases/autonomous_agents/sales_gpt/"],
  },
  "/docs/use_cases/graph/construction/": {
    canonical: "/docs/tutorials/graph",
    alternative: ["/v0.1/docs/use_cases/graph/construction/"],
  },
  "/docs/use_cases/media/": {
    canonical: "/docs/how_to/multimodal_prompts",
    alternative: ["/v0.1/docs/use_cases/media/"],
  },
  "/docs/use_cases/query_analysis/how_to/constructing_filters/": {
    canonical: "/docs/tutorials/query_analysis",
    alternative: [
      "/v0.1/docs/use_cases/query_analysis/how_to/constructing_filters/",
    ],
  },
  "/docs/use_cases/tabular/": {
    canonical: "/docs/tutorials/sql_qa",
    alternative: ["/v0.1/docs/use_cases/tabular/"],
  },
};

export default function NotFound() {
  const location = useLocation();
  const pathname = location.pathname.endsWith("/")
    ? location.pathname
    : `${location.pathname}/`; // Ensure the path matches the keys in suggestedLinks
  const { canonical, alternative } = suggestedLinks[pathname] || {};

  return (
    <>
      <PageMetadata
        title={translate({
          id: "theme.NotFound.title",
          message: "Page Not Found",
        })}
      />
      <Layout>
        <main className="container margin-vert--xl">
          <div className="row">
            <div className="col col--6 col--offset-3">
              <h1 className="hero__title">
                {canonical
                  ? "Page Moved"
                  : alternative
                  ? "Page Removed"
                  : "Page Not Found"}
              </h1>
              {canonical ? (
                <h3>
                  You can find the new location <a href={canonical}>here</a>.
                </h3>
              ) : alternative ? (
                <p>The page you were looking for has been removed.</p>
              ) : (
                <p>We could not find what you were looking for.</p>
              )}
              {alternative && (
                <p>
                  <details>
                    <summary>Alternative pages</summary>
                    <ul>
                      {alternative.map((alt, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={index}>
                          <a href={alt}>{alt}</a>
                          {alt.startsWith("/v0.1/") && (
                            <>
                              {" "}
                              <LegacyBadge />
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                </p>
              )}
              <p>
                Please contact the owner of the site that linked you to the
                original URL and let them know their link{" "}
                {canonical
                  ? "has moved."
                  : alternative
                  ? "has been removed."
                  : "is broken."}
              </p>
            </div>
          </div>
        </main>
      </Layout>
    </>
  );
}
