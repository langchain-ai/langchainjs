import { RemoteRunnable } from "@langchain/core/runnables/remote";

const remoteChain = new RemoteRunnable({
  url: "https://your_hostname.com/path",
});

const logStream = await remoteChain.streamEvents(
  {
    question: "What is a document loader?",
    chat_history: [],
  },
  // LangChain runnable config properties
  {
    // Version is required for streamEvents since it's a beta API
    version: "v1",
    // Optional, chain specific config
    configurable: {
      llm: "openai_gpt_3_5_turbo",
    },
    metadata: {
      conversation_id: "other_metadata",
    },
  },
  // Optional additional streamLog properties for filtering outputs
  {
    // includeNames: [],
    // includeTags: [],
    // includeTypes: [],
    // excludeNames: [],
    // excludeTags: [],
    // excludeTypes: [],
  }
);

for await (const chunk of logStream) {
  console.log(chunk);
}

/*
  {
    event: 'on_chain_start',
    name: '/pirate-speak',
    run_id: undefined,
    tags: [],
    metadata: {},
    data: {
      input: StringPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        value: null
      }
    }
  }
  {
    event: 'on_prompt_start',
    name: 'ChatPromptTemplate',
    run_id: undefined,
    tags: [ 'seq:step:1' ],
    metadata: {},
    data: {
      input: StringPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        value: null
      }
    }
  }
  {
    event: 'on_prompt_end',
    name: 'ChatPromptTemplate',
    run_id: undefined,
    tags: [ 'seq:step:1' ],
    metadata: {},
    data: {
      input: StringPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        value: null
      },
      output: ChatPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        messages: [Array]
      }
    }
  }
  {
    event: 'on_chat_model_start',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      input: ChatPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        messages: [Array]
      }
    }
  }
  {
    event: 'on_chat_model_stream',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: '',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chain_stream',
    name: '/pirate-speak',
    run_id: undefined,
    tags: [],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: '',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chat_model_stream',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: 'Arr',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chain_stream',
    name: '/pirate-speak',
    run_id: undefined,
    tags: [],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: 'Arr',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chat_model_stream',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: 'r',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chain_stream',
    name: '/pirate-speak',
    run_id: undefined,
    tags: [],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: 'r',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  {
    event: 'on_chat_model_stream',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      chunk: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: ' mate',
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
  ...
  {
    event: 'on_chat_model_end',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      input: ChatPromptValue {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        messages: [Array]
      },
      output: { generations: [Array], llm_output: null, run: null }
    }
  }
  {
    event: 'on_chain_end',
    name: '/pirate-speak',
    run_id: undefined,
    tags: [],
    metadata: {},
    data: {
      output: AIMessageChunk {
        lc_serializable: true,
        lc_kwargs: [Object],
        lc_namespace: [Array],
        content: "Arrr matey, why be ye holdin' back on me? Speak up, what be ye wantin' to know?",
        name: undefined,
        additional_kwargs: {},
        response_metadata: {}
      }
    }
  }
*/
