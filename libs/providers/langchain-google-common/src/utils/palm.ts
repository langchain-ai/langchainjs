export interface GoogleVertexAIBasePrediction {
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}

export interface GoogleVertexAILLMPredictions<
  PredictionType extends GoogleVertexAIBasePrediction,
> {
  predictions: PredictionType[];
}
