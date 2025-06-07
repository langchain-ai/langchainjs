/**
 * @see https://docs.cohere.com/docs/models
 */
export type CohereChatModelId =
  | 'command-a-03-2025'
  | 'command-r7b-12-2024'
  | 'command-r-plus-04-2024'
  | 'command-r-plus'
  | 'command-r-08-2024'
  | 'command-r-03-2024'
  | 'command-r'
  | 'command'
  | 'command-nightly'
  | 'command-light'
  | 'command-light-nightly'
  | (string & NonNullable<unknown>);

/**
 * @see https://docs.cohere.com/docs/models
 */
export type CohereEmbeddingModelId =
  | 'embed-english-v3.0'
  | 'embed-multilingual-v3.0'
  | 'embed-english-light-v3.0'
  | 'embed-multilingual-light-v3.0'
  | 'embed-english-v2.0'
  | 'embed-english-light-v2.0'
  | 'embed-multilingual-v2.0'
  | (string & NonNullable<unknown>);
