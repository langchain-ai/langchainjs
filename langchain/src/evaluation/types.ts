export enum EvaluatorType {
  /** Question answering evaluator, which grades answers to questions
     directly using an LLM. */
  QA = "qa",

  /** Chain of thought question answering evaluator, which grades
     answers to questions using chain of thought 'reasoning'. */
  COT_QA = "cot_qa",

  /** Question answering evaluator that incorporates 'context' in the response. */
  CONTEXT_QA = "context_qa",

  /** The pairwise string evaluator, which predicts the preferred prediction from
     between two models. */
  PAIRWISE_STRING = "pairwise_string",

  /** The labeled pairwise string evaluator, which predicts the preferred prediction
     from between two models based on a ground truth reference label. */
  LABELED_PAIRWISE_STRING = "labeled_pairwise_string",

  /** The agent trajectory evaluator, which grades the agent's intermediate steps. */
  AGENT_TRAJECTORY = "trajectory",

  /** The criteria evaluator, which evaluates a model based on a
     custom set of criteria without any reference labels. */
  CRITERIA = "criteria",

  /** The labeled criteria evaluator, which evaluates a model based on a
     custom set of criteria, with a reference label. */
  LABELED_CRITERIA = "labeled_criteria",

  /** Compare predictions to a reference answer using string edit distances. */
  STRING_DISTANCE = "string_distance",

  /** Compare predictions based on string edit distances. */
  PAIRWISE_STRING_DISTANCE = "pairwise_string_distance",

  /** Compare a prediction to a reference label using embedding distance. */
  EMBEDDING_DISTANCE = "embedding_distance",

  /** Compare two predictions using embedding distance. */
  PAIRWISE_EMBEDDING_DISTANCE = "pairwise_embedding_distance",
}
