import { RemoteRunnable } from "@langchain/core/runnables/remote";

const remoteChain = new RemoteRunnable({
  // url: "https://your_hostname.com/path",
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
    data: { input: { chat_history: [], text: null } }
  }
  {
    event: 'on_prompt_start',
    name: 'ChatPromptTemplate',
    run_id: undefined,
    tags: [ 'seq:step:1' ],
    metadata: {},
    data: { input: { chat_history: [], text: null } }
  }
  {
    event: 'on_prompt_end',
    name: 'ChatPromptTemplate',
    run_id: undefined,
    tags: [ 'seq:step:1' ],
    metadata: {},
    data: {
      input: { chat_history: [], text: null },
      output: { messages: [Array] }
    }
  }
  {
    event: 'on_chat_model_start',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: { input: { messages: [Array] } }
  }
  {
    event: 'on_chat_model_stream',
    name: 'ChatOpenAI',
    run_id: undefined,
    tags: [ 'seq:step:2' ],
    metadata: {},
    data: {
      chunk: {
        content: '',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      chunk: {
        content: '',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      chunk: {
        content: 'Arr',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      chunk: {
        content: 'Arr',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      chunk: {
        content: 'r',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      chunk: {
        content: 'r',
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
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
      input: { messages: [Array] },
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
      output: {
        content: "Arrr matey, be ye needin' any help or information from this old salty dog? Speak up, lest ye be walkin' the plank!",
        additional_kwargs: {},
        type: 'AIMessageChunk',
        name: null,
        id: null,
        example: false
      }
    }
  }
*/
