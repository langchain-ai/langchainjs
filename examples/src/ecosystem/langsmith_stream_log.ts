import { RemoteRunnable } from "@langchain/core/runnables/remote";

const remoteChain = new RemoteRunnable({
  // url: "https://your_hostname.com/path",
  url: "https://chat-langchain-backend.langchain.dev/chat",
});

const logStream = await remoteChain.streamLog(
  {
    question: "What is a document loader?",
  },
  // LangChain runnable config properties, if supported by the chain
  {
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

let currentState;

for await (const chunk of logStream) {
  if (!currentState) {
    currentState = chunk;
  } else {
    currentState = currentState.concat(chunk);
  }
}

console.log(currentState);

/*
  RunLog {
    ops: [
      { op: 'replace', path: '', value: [Object] },
      {
        op: 'add',
        path: '/logs/RunnableParallel<question,chat_history>',
        value: [Object]
      },
      { op: 'add', path: '/logs/Itemgetter:question', value: [Object] },
      { op: 'add', path: '/logs/SerializeHistory', value: [Object] },
      {
        op: 'add',
        path: '/logs/Itemgetter:question/streamed_output/-',
        value: 'What is a document loader?'
      },
      {
        op: 'add',
        path: '/logs/SerializeHistory/streamed_output/-',
        value: []
      },
      {
        op: 'add',
        path: '/logs/RunnableParallel<question,chat_history>/streamed_output/-',
        value: [Object]
      },
      { op: 'add', path: '/logs/RetrieveDocs', value: [Object] },
      { op: 'add', path: '/logs/RunnableSequence', value: [Object] },
      {
        op: 'add',
        path: '/logs/RunnableParallel<question,chat_history>/streamed_output/-',
        value: [Object]
      },
      ... 558 more items
    ],
    state: {
      id: '415ba646-a3e0-4c76-bff6-4f5f34305244',
      streamed_output: [
        '',           'A',        ' document',   ' loader',     ' is',
        ' a',         ' tool',    ' used',       ' to',         ' load',
        ' data',      ' from',    ' a',          ' source',     ' as',
        ' `',         'Document', '`',           "'",           's',
        ',',          ' which',   ' are',        ' pieces',     ' of',
        ' text',      ' with',    ' associated', ' metadata',   '.',
        ' It',        ' can',     ' load',       ' data',       ' from',
        ' various',   ' sources', ',',           ' such',       ' as',
        ' a',         ' simple',  ' `.',         'txt',         '`',
        ' file',      ',',        ' the',        ' text',       ' contents',
        ' of',        ' a',       ' web',        ' page',       ',',
        ' or',        ' a',       ' transcript', ' of',         ' a',
        ' YouTube',   ' video',   '.',           ' Document',   ' loaders',
        ' provide',   ' a',       ' "',          'load',        '"',
        ' method',    ' for',     ' loading',    ' data',       ' as',
        ' documents', ' from',    ' a',          ' configured', ' source',
        ' and',       ' can',     ' optionally', ' implement',  ' a',
        ' "',         'lazy',     ' load',       '"',           ' for',
        ' loading',   ' data',    ' into',       ' memory',     '.',
        ' [',         '1',        ']',           ''
      ],
      final_output: 'A document loader is a tool used to load data from a source as `Document`\'s, which are pieces of text with associated metadata. It can load data from various sources, such as a simple `.txt` file, the text contents of a web page, or a transcript of a YouTube video. Document loaders provide a "load" method for loading data as documents from a configured source and can optionally implement a "lazy load" for loading data into memory. [1]',
      logs: {
        'RunnableParallel<question,chat_history>': [Object],
        'Itemgetter:question': [Object],
        SerializeHistory: [Object],
        RetrieveDocs: [Object],
        RunnableSequence: [Object],
        RunnableLambda: [Object],
        'RunnableLambda:2': [Object],
        FindDocs: [Object],
        HasChatHistoryCheck: [Object],
        GenerateResponse: [Object],
        RetrievalChainWithNoHistory: [Object],
        'Itemgetter:question:2': [Object],
        Retriever: [Object],
        format_docs: [Object],
        ChatPromptTemplate: [Object],
        ChatOpenAI: [Object],
        StrOutputParser: [Object]
      },
      name: '/chat',
      type: 'chain'
    }
  }
*/
