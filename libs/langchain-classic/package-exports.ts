const old = {
  "./load": {
    types: {
      import: "./load.d.ts",
      require: "./load.d.cts",
      default: "./load.d.ts",
    },
    import: "./load.js",
    require: "./load.cjs",
  },
  "./load/serializable": {
    types: {
      import: "./load/serializable.d.ts",
      require: "./load/serializable.d.cts",
      default: "./load/serializable.d.ts",
    },
    import: "./load/serializable.js",
    require: "./load/serializable.cjs",
  },
  "./agents": {
    types: {
      import: "./agents.d.ts",
      require: "./agents.d.cts",
      default: "./agents.d.ts",
    },
    import: "./agents.js",
    require: "./agents.cjs",
  },
  "./agents/load": {
    types: {
      import: "./agents/load.d.ts",
      require: "./agents/load.d.cts",
      default: "./agents/load.d.ts",
    },
    import: "./agents/load.js",
    require: "./agents/load.cjs",
  },
  "./agents/toolkits": {
    types: {
      import: "./agents/toolkits.d.ts",
      require: "./agents/toolkits.d.cts",
      default: "./agents/toolkits.d.ts",
    },
    import: "./agents/toolkits.js",
    require: "./agents/toolkits.cjs",
  },
  "./agents/toolkits/sql": {
    types: {
      import: "./agents/toolkits/sql.d.ts",
      require: "./agents/toolkits/sql.d.cts",
      default: "./agents/toolkits/sql.d.ts",
    },
    import: "./agents/toolkits/sql.js",
    require: "./agents/toolkits/sql.cjs",
  },
  "./agents/format_scratchpad": {
    types: {
      import: "./agents/format_scratchpad.d.ts",
      require: "./agents/format_scratchpad.d.cts",
      default: "./agents/format_scratchpad.d.ts",
    },
    import: "./agents/format_scratchpad.js",
    require: "./agents/format_scratchpad.cjs",
  },
  "./agents/format_scratchpad/openai_tools": {
    types: {
      import: "./agents/format_scratchpad/openai_tools.d.ts",
      require: "./agents/format_scratchpad/openai_tools.d.cts",
      default: "./agents/format_scratchpad/openai_tools.d.ts",
    },
    import: "./agents/format_scratchpad/openai_tools.js",
    require: "./agents/format_scratchpad/openai_tools.cjs",
  },
  "./agents/format_scratchpad/log": {
    types: {
      import: "./agents/format_scratchpad/log.d.ts",
      require: "./agents/format_scratchpad/log.d.cts",
      default: "./agents/format_scratchpad/log.d.ts",
    },
    import: "./agents/format_scratchpad/log.js",
    require: "./agents/format_scratchpad/log.cjs",
  },
  "./agents/format_scratchpad/xml": {
    types: {
      import: "./agents/format_scratchpad/xml.d.ts",
      require: "./agents/format_scratchpad/xml.d.cts",
      default: "./agents/format_scratchpad/xml.d.ts",
    },
    import: "./agents/format_scratchpad/xml.js",
    require: "./agents/format_scratchpad/xml.cjs",
  },
  "./agents/format_scratchpad/log_to_message": {
    types: {
      import: "./agents/format_scratchpad/log_to_message.d.ts",
      require: "./agents/format_scratchpad/log_to_message.d.cts",
      default: "./agents/format_scratchpad/log_to_message.d.ts",
    },
    import: "./agents/format_scratchpad/log_to_message.js",
    require: "./agents/format_scratchpad/log_to_message.cjs",
  },
  "./agents/react/output_parser": {
    types: {
      import: "./agents/react/output_parser.d.ts",
      require: "./agents/react/output_parser.d.cts",
      default: "./agents/react/output_parser.d.ts",
    },
    import: "./agents/react/output_parser.js",
    require: "./agents/react/output_parser.cjs",
  },
  "./agents/xml/output_parser": {
    types: {
      import: "./agents/xml/output_parser.d.ts",
      require: "./agents/xml/output_parser.d.cts",
      default: "./agents/xml/output_parser.d.ts",
    },
    import: "./agents/xml/output_parser.js",
    require: "./agents/xml/output_parser.cjs",
  },
  "./agents/openai/output_parser": {
    types: {
      import: "./agents/openai/output_parser.d.ts",
      require: "./agents/openai/output_parser.d.cts",
      default: "./agents/openai/output_parser.d.ts",
    },
    import: "./agents/openai/output_parser.js",
    require: "./agents/openai/output_parser.cjs",
  },
  "./tools": {
    types: {
      import: "./tools.d.ts",
      require: "./tools.d.cts",
      default: "./tools.d.ts",
    },
    import: "./tools.js",
    require: "./tools.cjs",
  },
  "./tools/chain": {
    types: {
      import: "./tools/chain.d.ts",
      require: "./tools/chain.d.cts",
      default: "./tools/chain.d.ts",
    },
    import: "./tools/chain.js",
    require: "./tools/chain.cjs",
  },
  "./tools/render": {
    types: {
      import: "./tools/render.d.ts",
      require: "./tools/render.d.cts",
      default: "./tools/render.d.ts",
    },
    import: "./tools/render.js",
    require: "./tools/render.cjs",
  },
  "./tools/retriever": {
    types: {
      import: "./tools/retriever.d.ts",
      require: "./tools/retriever.d.cts",
      default: "./tools/retriever.d.ts",
    },
    import: "./tools/retriever.js",
    require: "./tools/retriever.cjs",
  },
  "./tools/sql": {
    types: {
      import: "./tools/sql.d.ts",
      require: "./tools/sql.d.cts",
      default: "./tools/sql.d.ts",
    },
    import: "./tools/sql.js",
    require: "./tools/sql.cjs",
  },
  "./tools/webbrowser": {
    types: {
      import: "./tools/webbrowser.d.ts",
      require: "./tools/webbrowser.d.cts",
      default: "./tools/webbrowser.d.ts",
    },
    import: "./tools/webbrowser.js",
    require: "./tools/webbrowser.cjs",
  },
  "./chains": {
    types: {
      import: "./chains.d.ts",
      require: "./chains.d.cts",
      default: "./chains.d.ts",
    },
    import: "./chains.js",
    require: "./chains.cjs",
  },
  "./chains/combine_documents": {
    types: {
      import: "./chains/combine_documents.d.ts",
      require: "./chains/combine_documents.d.cts",
      default: "./chains/combine_documents.d.ts",
    },
    import: "./chains/combine_documents.js",
    require: "./chains/combine_documents.cjs",
  },
  "./chains/combine_documents/reduce": {
    types: {
      import: "./chains/combine_documents/reduce.d.ts",
      require: "./chains/combine_documents/reduce.d.cts",
      default: "./chains/combine_documents/reduce.d.ts",
    },
    import: "./chains/combine_documents/reduce.js",
    require: "./chains/combine_documents/reduce.cjs",
  },
  "./chains/history_aware_retriever": {
    types: {
      import: "./chains/history_aware_retriever.d.ts",
      require: "./chains/history_aware_retriever.d.cts",
      default: "./chains/history_aware_retriever.d.ts",
    },
    import: "./chains/history_aware_retriever.js",
    require: "./chains/history_aware_retriever.cjs",
  },
  "./chains/load": {
    types: {
      import: "./chains/load.d.ts",
      require: "./chains/load.d.cts",
      default: "./chains/load.d.ts",
    },
    import: "./chains/load.js",
    require: "./chains/load.cjs",
  },
  "./chains/openai_functions": {
    types: {
      import: "./chains/openai_functions.d.ts",
      require: "./chains/openai_functions.d.cts",
      default: "./chains/openai_functions.d.ts",
    },
    import: "./chains/openai_functions.js",
    require: "./chains/openai_functions.cjs",
  },
  "./chains/query_constructor": {
    types: {
      import: "./chains/query_constructor.d.ts",
      require: "./chains/query_constructor.d.cts",
      default: "./chains/query_constructor.d.ts",
    },
    import: "./chains/query_constructor.js",
    require: "./chains/query_constructor.cjs",
  },
  "./chains/query_constructor/ir": {
    types: {
      import: "./chains/query_constructor/ir.d.ts",
      require: "./chains/query_constructor/ir.d.cts",
      default: "./chains/query_constructor/ir.d.ts",
    },
    import: "./chains/query_constructor/ir.js",
    require: "./chains/query_constructor/ir.cjs",
  },
  "./chains/retrieval": {
    types: {
      import: "./chains/retrieval.d.ts",
      require: "./chains/retrieval.d.cts",
      default: "./chains/retrieval.d.ts",
    },
    import: "./chains/retrieval.js",
    require: "./chains/retrieval.cjs",
  },
  "./chains/sql_db": {
    types: {
      import: "./chains/sql_db.d.ts",
      require: "./chains/sql_db.d.cts",
      default: "./chains/sql_db.d.ts",
    },
    import: "./chains/sql_db.js",
    require: "./chains/sql_db.cjs",
  },
  "./chains/graph_qa/cypher": {
    types: {
      import: "./chains/graph_qa/cypher.d.ts",
      require: "./chains/graph_qa/cypher.d.cts",
      default: "./chains/graph_qa/cypher.d.ts",
    },
    import: "./chains/graph_qa/cypher.js",
    require: "./chains/graph_qa/cypher.cjs",
  },
  "./chat_models/universal": {
    types: {
      import: "./chat_models/universal.d.ts",
      require: "./chat_models/universal.d.cts",
      default: "./chat_models/universal.d.ts",
    },
    import: "./chat_models/universal.js",
    require: "./chat_models/universal.cjs",
  },
  "./embeddings/cache_backed": {
    types: {
      import: "./embeddings/cache_backed.d.ts",
      require: "./embeddings/cache_backed.d.cts",
      default: "./embeddings/cache_backed.d.ts",
    },
    import: "./embeddings/cache_backed.js",
    require: "./embeddings/cache_backed.cjs",
  },
  "./embeddings/fake": {
    types: {
      import: "./embeddings/fake.d.ts",
      require: "./embeddings/fake.d.cts",
      default: "./embeddings/fake.d.ts",
    },
    import: "./embeddings/fake.js",
    require: "./embeddings/fake.cjs",
  },
  "./vectorstores/memory": {
    types: {
      import: "./vectorstores/memory.d.ts",
      require: "./vectorstores/memory.d.cts",
      default: "./vectorstores/memory.d.ts",
    },
    import: "./vectorstores/memory.js",
    require: "./vectorstores/memory.cjs",
  },
  "./text_splitter": {
    types: {
      import: "./text_splitter.d.ts",
      require: "./text_splitter.d.cts",
      default: "./text_splitter.d.ts",
    },
    import: "./text_splitter.js",
    require: "./text_splitter.cjs",
  },
  "./memory": {
    types: {
      import: "./memory.d.ts",
      require: "./memory.d.cts",
      default: "./memory.d.ts",
    },
    import: "./memory.js",
    require: "./memory.cjs",
  },
  "./memory/chat_memory": {
    types: {
      import: "./memory/chat_memory.d.ts",
      require: "./memory/chat_memory.d.cts",
      default: "./memory/chat_memory.d.ts",
    },
    import: "./memory/chat_memory.js",
    require: "./memory/chat_memory.cjs",
  },
  "./document": {
    types: {
      import: "./document.d.ts",
      require: "./document.d.cts",
      default: "./document.d.ts",
    },
    import: "./document.js",
    require: "./document.cjs",
  },
  "./document_loaders/base": {
    types: {
      import: "./document_loaders/base.d.ts",
      require: "./document_loaders/base.d.cts",
      default: "./document_loaders/base.d.ts",
    },
    import: "./document_loaders/base.js",
    require: "./document_loaders/base.cjs",
  },
  "./document_loaders/fs/buffer": {
    types: {
      import: "./document_loaders/fs/buffer.d.ts",
      require: "./document_loaders/fs/buffer.d.cts",
      default: "./document_loaders/fs/buffer.d.ts",
    },
    import: "./document_loaders/fs/buffer.js",
    require: "./document_loaders/fs/buffer.cjs",
  },
  "./document_loaders/fs/directory": {
    types: {
      import: "./document_loaders/fs/directory.d.ts",
      require: "./document_loaders/fs/directory.d.cts",
      default: "./document_loaders/fs/directory.d.ts",
    },
    import: "./document_loaders/fs/directory.js",
    require: "./document_loaders/fs/directory.cjs",
  },
  "./document_loaders/fs/json": {
    types: {
      import: "./document_loaders/fs/json.d.ts",
      require: "./document_loaders/fs/json.d.cts",
      default: "./document_loaders/fs/json.d.ts",
    },
    import: "./document_loaders/fs/json.js",
    require: "./document_loaders/fs/json.cjs",
  },
  "./document_loaders/fs/multi_file": {
    types: {
      import: "./document_loaders/fs/multi_file.d.ts",
      require: "./document_loaders/fs/multi_file.d.cts",
      default: "./document_loaders/fs/multi_file.d.ts",
    },
    import: "./document_loaders/fs/multi_file.js",
    require: "./document_loaders/fs/multi_file.cjs",
  },
  "./document_loaders/fs/text": {
    types: {
      import: "./document_loaders/fs/text.d.ts",
      require: "./document_loaders/fs/text.d.cts",
      default: "./document_loaders/fs/text.d.ts",
    },
    import: "./document_loaders/fs/text.js",
    require: "./document_loaders/fs/text.cjs",
  },
  "./document_transformers/openai_functions": {
    types: {
      import: "./document_transformers/openai_functions.d.ts",
      require: "./document_transformers/openai_functions.d.cts",
      default: "./document_transformers/openai_functions.d.ts",
    },
    import: "./document_transformers/openai_functions.js",
    require: "./document_transformers/openai_functions.cjs",
  },
  "./sql_db": {
    types: {
      import: "./sql_db.d.ts",
      require: "./sql_db.d.cts",
      default: "./sql_db.d.ts",
    },
    import: "./sql_db.js",
    require: "./sql_db.cjs",
  },
  "./callbacks": {
    types: {
      import: "./callbacks.d.ts",
      require: "./callbacks.d.cts",
      default: "./callbacks.d.ts",
    },
    import: "./callbacks.js",
    require: "./callbacks.cjs",
  },
  "./output_parsers": {
    types: {
      import: "./output_parsers.d.ts",
      require: "./output_parsers.d.cts",
      default: "./output_parsers.d.ts",
    },
    import: "./output_parsers.js",
    require: "./output_parsers.cjs",
  },
  "./output_parsers/expression": {
    types: {
      import: "./output_parsers/expression.d.ts",
      require: "./output_parsers/expression.d.cts",
      default: "./output_parsers/expression.d.ts",
    },
    import: "./output_parsers/expression.js",
    require: "./output_parsers/expression.cjs",
  },
  "./retrievers/contextual_compression": {
    types: {
      import: "./retrievers/contextual_compression.d.ts",
      require: "./retrievers/contextual_compression.d.cts",
      default: "./retrievers/contextual_compression.d.ts",
    },
    import: "./retrievers/contextual_compression.js",
    require: "./retrievers/contextual_compression.cjs",
  },
  "./retrievers/document_compressors": {
    types: {
      import: "./retrievers/document_compressors.d.ts",
      require: "./retrievers/document_compressors.d.cts",
      default: "./retrievers/document_compressors.d.ts",
    },
    import: "./retrievers/document_compressors.js",
    require: "./retrievers/document_compressors.cjs",
  },
  "./retrievers/ensemble": {
    types: {
      import: "./retrievers/ensemble.d.ts",
      require: "./retrievers/ensemble.d.cts",
      default: "./retrievers/ensemble.d.ts",
    },
    import: "./retrievers/ensemble.js",
    require: "./retrievers/ensemble.cjs",
  },
  "./retrievers/multi_query": {
    types: {
      import: "./retrievers/multi_query.d.ts",
      require: "./retrievers/multi_query.d.cts",
      default: "./retrievers/multi_query.d.ts",
    },
    import: "./retrievers/multi_query.js",
    require: "./retrievers/multi_query.cjs",
  },
  "./retrievers/multi_vector": {
    types: {
      import: "./retrievers/multi_vector.d.ts",
      require: "./retrievers/multi_vector.d.cts",
      default: "./retrievers/multi_vector.d.ts",
    },
    import: "./retrievers/multi_vector.js",
    require: "./retrievers/multi_vector.cjs",
  },
  "./retrievers/parent_document": {
    types: {
      import: "./retrievers/parent_document.d.ts",
      require: "./retrievers/parent_document.d.cts",
      default: "./retrievers/parent_document.d.ts",
    },
    import: "./retrievers/parent_document.js",
    require: "./retrievers/parent_document.cjs",
  },
  "./retrievers/time_weighted": {
    types: {
      import: "./retrievers/time_weighted.d.ts",
      require: "./retrievers/time_weighted.d.cts",
      default: "./retrievers/time_weighted.d.ts",
    },
    import: "./retrievers/time_weighted.js",
    require: "./retrievers/time_weighted.cjs",
  },
  "./retrievers/document_compressors/chain_extract": {
    types: {
      import: "./retrievers/document_compressors/chain_extract.d.ts",
      require: "./retrievers/document_compressors/chain_extract.d.cts",
      default: "./retrievers/document_compressors/chain_extract.d.ts",
    },
    import: "./retrievers/document_compressors/chain_extract.js",
    require: "./retrievers/document_compressors/chain_extract.cjs",
  },
  "./retrievers/document_compressors/embeddings_filter": {
    types: {
      import: "./retrievers/document_compressors/embeddings_filter.d.ts",
      require: "./retrievers/document_compressors/embeddings_filter.d.cts",
      default: "./retrievers/document_compressors/embeddings_filter.d.ts",
    },
    import: "./retrievers/document_compressors/embeddings_filter.js",
    require: "./retrievers/document_compressors/embeddings_filter.cjs",
  },
  "./retrievers/hyde": {
    types: {
      import: "./retrievers/hyde.d.ts",
      require: "./retrievers/hyde.d.cts",
      default: "./retrievers/hyde.d.ts",
    },
    import: "./retrievers/hyde.js",
    require: "./retrievers/hyde.cjs",
  },
  "./retrievers/score_threshold": {
    types: {
      import: "./retrievers/score_threshold.d.ts",
      require: "./retrievers/score_threshold.d.cts",
      default: "./retrievers/score_threshold.d.ts",
    },
    import: "./retrievers/score_threshold.js",
    require: "./retrievers/score_threshold.cjs",
  },
  "./retrievers/self_query": {
    types: {
      import: "./retrievers/self_query.d.ts",
      require: "./retrievers/self_query.d.cts",
      default: "./retrievers/self_query.d.ts",
    },
    import: "./retrievers/self_query.js",
    require: "./retrievers/self_query.cjs",
  },
  "./retrievers/self_query/functional": {
    types: {
      import: "./retrievers/self_query/functional.d.ts",
      require: "./retrievers/self_query/functional.d.cts",
      default: "./retrievers/self_query/functional.d.ts",
    },
    import: "./retrievers/self_query/functional.js",
    require: "./retrievers/self_query/functional.cjs",
  },
  "./retrievers/matryoshka_retriever": {
    types: {
      import: "./retrievers/matryoshka_retriever.d.ts",
      require: "./retrievers/matryoshka_retriever.d.cts",
      default: "./retrievers/matryoshka_retriever.d.ts",
    },
    import: "./retrievers/matryoshka_retriever.js",
    require: "./retrievers/matryoshka_retriever.cjs",
  },
  "./cache/file_system": {
    types: {
      import: "./cache/file_system.d.ts",
      require: "./cache/file_system.d.cts",
      default: "./cache/file_system.d.ts",
    },
    import: "./cache/file_system.js",
    require: "./cache/file_system.cjs",
  },
  "./stores/doc/base": {
    types: {
      import: "./stores/doc/base.d.ts",
      require: "./stores/doc/base.d.cts",
      default: "./stores/doc/base.d.ts",
    },
    import: "./stores/doc/base.js",
    require: "./stores/doc/base.cjs",
  },
  "./stores/doc/in_memory": {
    types: {
      import: "./stores/doc/in_memory.d.ts",
      require: "./stores/doc/in_memory.d.cts",
      default: "./stores/doc/in_memory.d.ts",
    },
    import: "./stores/doc/in_memory.js",
    require: "./stores/doc/in_memory.cjs",
  },
  "./stores/file/in_memory": {
    types: {
      import: "./stores/file/in_memory.d.ts",
      require: "./stores/file/in_memory.d.cts",
      default: "./stores/file/in_memory.d.ts",
    },
    import: "./stores/file/in_memory.js",
    require: "./stores/file/in_memory.cjs",
  },
  "./stores/file/node": {
    types: {
      import: "./stores/file/node.d.ts",
      require: "./stores/file/node.d.cts",
      default: "./stores/file/node.d.ts",
    },
    import: "./stores/file/node.js",
    require: "./stores/file/node.cjs",
  },
  "./stores/message/in_memory": {
    types: {
      import: "./stores/message/in_memory.d.ts",
      require: "./stores/message/in_memory.d.cts",
      default: "./stores/message/in_memory.d.ts",
    },
    import: "./stores/message/in_memory.js",
    require: "./stores/message/in_memory.cjs",
  },
  "./storage/encoder_backed": {
    types: {
      import: "./storage/encoder_backed.d.ts",
      require: "./storage/encoder_backed.d.cts",
      default: "./storage/encoder_backed.d.ts",
    },
    import: "./storage/encoder_backed.js",
    require: "./storage/encoder_backed.cjs",
  },
  "./storage/in_memory": {
    types: {
      import: "./storage/in_memory.d.ts",
      require: "./storage/in_memory.d.cts",
      default: "./storage/in_memory.d.ts",
    },
    import: "./storage/in_memory.js",
    require: "./storage/in_memory.cjs",
  },
  "./storage/file_system": {
    types: {
      import: "./storage/file_system.d.ts",
      require: "./storage/file_system.d.cts",
      default: "./storage/file_system.d.ts",
    },
    import: "./storage/file_system.js",
    require: "./storage/file_system.cjs",
  },
  "./hub": {
    types: {
      import: "./hub.d.ts",
      require: "./hub.d.cts",
      default: "./hub.d.ts",
    },
    import: "./hub.js",
    require: "./hub.cjs",
  },
  "./hub/node": {
    types: {
      import: "./hub/node.d.ts",
      require: "./hub/node.d.cts",
      default: "./hub/node.d.ts",
    },
    import: "./hub/node.js",
    require: "./hub/node.cjs",
  },
  "./util/document": {
    types: {
      import: "./util/document.d.ts",
      require: "./util/document.d.cts",
      default: "./util/document.d.ts",
    },
    import: "./util/document.js",
    require: "./util/document.cjs",
  },
  "./util/math": {
    types: {
      import: "./util/math.d.ts",
      require: "./util/math.d.cts",
      default: "./util/math.d.ts",
    },
    import: "./util/math.js",
    require: "./util/math.cjs",
  },
  "./util/time": {
    types: {
      import: "./util/time.d.ts",
      require: "./util/time.d.cts",
      default: "./util/time.d.ts",
    },
    import: "./util/time.js",
    require: "./util/time.cjs",
  },
  "./experimental/autogpt": {
    types: {
      import: "./experimental/autogpt.d.ts",
      require: "./experimental/autogpt.d.cts",
      default: "./experimental/autogpt.d.ts",
    },
    import: "./experimental/autogpt.js",
    require: "./experimental/autogpt.cjs",
  },
  "./experimental/openai_assistant": {
    types: {
      import: "./experimental/openai_assistant.d.ts",
      require: "./experimental/openai_assistant.d.cts",
      default: "./experimental/openai_assistant.d.ts",
    },
    import: "./experimental/openai_assistant.js",
    require: "./experimental/openai_assistant.cjs",
  },
  "./experimental/openai_files": {
    types: {
      import: "./experimental/openai_files.d.ts",
      require: "./experimental/openai_files.d.cts",
      default: "./experimental/openai_files.d.ts",
    },
    import: "./experimental/openai_files.js",
    require: "./experimental/openai_files.cjs",
  },
  "./experimental/babyagi": {
    types: {
      import: "./experimental/babyagi.d.ts",
      require: "./experimental/babyagi.d.cts",
      default: "./experimental/babyagi.d.ts",
    },
    import: "./experimental/babyagi.js",
    require: "./experimental/babyagi.cjs",
  },
  "./experimental/generative_agents": {
    types: {
      import: "./experimental/generative_agents.d.ts",
      require: "./experimental/generative_agents.d.cts",
      default: "./experimental/generative_agents.d.ts",
    },
    import: "./experimental/generative_agents.js",
    require: "./experimental/generative_agents.cjs",
  },
  "./experimental/plan_and_execute": {
    types: {
      import: "./experimental/plan_and_execute.d.ts",
      require: "./experimental/plan_and_execute.d.cts",
      default: "./experimental/plan_and_execute.d.ts",
    },
    import: "./experimental/plan_and_execute.js",
    require: "./experimental/plan_and_execute.cjs",
  },
  "./experimental/chains/violation_of_expectations": {
    types: {
      import: "./experimental/chains/violation_of_expectations.d.ts",
      require: "./experimental/chains/violation_of_expectations.d.cts",
      default: "./experimental/chains/violation_of_expectations.d.ts",
    },
    import: "./experimental/chains/violation_of_expectations.js",
    require: "./experimental/chains/violation_of_expectations.cjs",
  },
  "./experimental/masking": {
    types: {
      import: "./experimental/masking.d.ts",
      require: "./experimental/masking.d.cts",
      default: "./experimental/masking.d.ts",
    },
    import: "./experimental/masking.js",
    require: "./experimental/masking.cjs",
  },
  "./experimental/prompts/custom_format": {
    types: {
      import: "./experimental/prompts/custom_format.d.ts",
      require: "./experimental/prompts/custom_format.d.cts",
      default: "./experimental/prompts/custom_format.d.ts",
    },
    import: "./experimental/prompts/custom_format.js",
    require: "./experimental/prompts/custom_format.cjs",
  },
  "./experimental/prompts/handlebars": {
    types: {
      import: "./experimental/prompts/handlebars.d.ts",
      require: "./experimental/prompts/handlebars.d.cts",
      default: "./experimental/prompts/handlebars.d.ts",
    },
    import: "./experimental/prompts/handlebars.js",
    require: "./experimental/prompts/handlebars.cjs",
  },
  "./evaluation": {
    types: {
      import: "./evaluation.d.ts",
      require: "./evaluation.d.cts",
      default: "./evaluation.d.ts",
    },
    import: "./evaluation.js",
    require: "./evaluation.cjs",
  },
  "./smith": {
    types: {
      import: "./smith.d.ts",
      require: "./smith.d.cts",
      default: "./smith.d.ts",
    },
    import: "./smith.js",
    require: "./smith.cjs",
  },
  "./runnables/remote": {
    types: {
      import: "./runnables/remote.d.ts",
      require: "./runnables/remote.d.cts",
      default: "./runnables/remote.d.ts",
    },
    import: "./runnables/remote.js",
    require: "./runnables/remote.cjs",
  },
  "./indexes": {
    types: {
      import: "./indexes.d.ts",
      require: "./indexes.d.cts",
      default: "./indexes.d.ts",
    },
    import: "./indexes.js",
    require: "./indexes.cjs",
  },
  "./schema/query_constructor": {
    types: {
      import: "./schema/query_constructor.d.ts",
      require: "./schema/query_constructor.d.cts",
      default: "./schema/query_constructor.d.ts",
    },
    import: "./schema/query_constructor.js",
    require: "./schema/query_constructor.cjs",
  },
  "./schema/prompt_template": {
    types: {
      import: "./schema/prompt_template.d.ts",
      require: "./schema/prompt_template.d.cts",
      default: "./schema/prompt_template.d.ts",
    },
    import: "./schema/prompt_template.js",
    require: "./schema/prompt_template.cjs",
  },
};

console.log(
  JSON.stringify(
  Object.entries(old).reduce((acc, [key, value]) => {
    acc[key] = {
      import: {
        types: value.types.default.replace(/^\.\//, "./dist/"),
        default: value.import.replace(/^\.\//, "./dist/"),
      },
      require: {
        types: value.types.require.replace(/^\.\//, "./dist/"),
        default: value.require.replace(/^\.\//, "./dist/"),
      },
      input: value.import.replace(/^\.\//, "./src/").replace(/\.js$/, ".ts"),
    };
    return acc;
  }, {} as Record<string, any>), null, 2)
);
