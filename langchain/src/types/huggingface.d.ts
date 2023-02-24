declare module "huggingface" {
  // Copied from 'huggingface/dist/index.d.ts' package as the package is missing
  // exports.types key in package.json
  declare class HuggingFace {
    private readonly apiKey;
    private readonly defaultOptions;
    constructor(apiKey: string, defaultOptions?: Options);
    /**
     * Tries to fill in a hole with a missing word (token to be precise). That’s the base task for BERT models.
     */
    fillMask(args: FillMaskArgs, options?: Options): Promise<FillMaskReturn>;
    /**
     * This task is well known to summarize longer text into shorter text. Be careful, some models have a maximum length of input. That means that the summary cannot handle full books for instance. Be careful when choosing your model.
     */
    summarization(
      args: SummarizationArgs,
      options?: Options
    ): Promise<SummarizationReturn>;
    /**
     * Want to have a nice know-it-all bot that can answer any question?. Recommended model: deepset/roberta-base-squad2
     */
    questionAnswer(
      args: QuestionAnswerArgs,
      options?: Options
    ): Promise<QuestionAnswerReturn>;
    /**
     * Don’t know SQL? Don’t want to dive into a large spreadsheet? Ask questions in plain english! Recommended model: google/tapas-base-finetuned-wtq.
     */
    tableQuestionAnswer(
      args: TableQuestionAnswerArgs,
      options?: Options
    ): Promise<TableQuestionAnswerReturn>;
    /**
     * Usually used for sentiment-analysis this will output the likelihood of classes of an input. Recommended model: distilbert-base-uncased-finetuned-sst-2-english
     */
    textClassification(
      args: TextClassificationArgs,
      options?: Options
    ): Promise<TextClassificationReturn>;
    /**
     * Use to continue text from a prompt. This is a very generic task. Recommended model: gpt2 (it’s a simple model, but fun to play with).
     */
    textGeneration(
      args: TextGenerationArgs,
      options?: Options
    ): Promise<TextGenerationReturn>;
    /**
     * Usually used for sentence parsing, either grammatical, or Named Entity Recognition (NER) to understand keywords contained within text. Recommended model: dbmdz/bert-large-cased-finetuned-conll03-english
     */
    tokenClassification(
      args: TokenClassificationArgs,
      options?: Options
    ): Promise<TokenClassificationReturn>;
    /**
     * This task is well known to translate text from one language to another. Recommended model: Helsinki-NLP/opus-mt-ru-en.
     */
    translation(
      args: TranslationArgs,
      options?: Options
    ): Promise<TranslationReturn>;
    /**
     * This task is super useful to try out classification with zero code, you simply pass a sentence/paragraph and the possible labels for that sentence, and you get a result. Recommended model: facebook/bart-large-mnli.
     */
    zeroShotClassification(
      args: ZeroShotClassificationArgs,
      options?: Options
    ): Promise<ZeroShotClassificationReturn>;
    /**
     * This task corresponds to any chatbot like structure. Models tend to have shorter max_length, so please check with caution when using a given model if you need long range dependency or not. Recommended model: microsoft/DialoGPT-large.
     *
     */
    conversational(
      args: ConversationalArgs,
      options?: Options
    ): Promise<ConversationalReturn>;
    /**
     * This task reads some text and outputs raw float values, that are usually consumed as part of a semantic database/semantic search.
     */
    featureExtraction(
      args: FeatureExtractionArgs,
      options?: Options
    ): Promise<FeatureExtractionReturn>;
    /**
     * This task reads some audio input and outputs the said words within the audio files.
     * Recommended model (english language): facebook/wav2vec2-large-960h-lv60-self
     */
    automaticSpeechRecognition(
      args: AutomaticSpeechRecognitionArgs,
      options?: Options
    ): Promise<AutomaticSpeechRecognitionReturn>;
    /**
     * This task reads some audio input and outputs the likelihood of classes.
     * Recommended model:  superb/hubert-large-superb-er
     */
    audioClassification(
      args: AudioClassificationArgs,
      options?: Options
    ): Promise<AudioClassificationReturn>;
    /**
     * This task reads some image input and outputs the likelihood of classes.
     * Recommended model: google/vit-base-patch16-224
     */
    imageClassification(
      args: ImageClassificationArgs,
      options?: Options
    ): Promise<ImageClassificationReturn>;
    /**
     * This task reads some image input and outputs the likelihood of classes & bounding boxes of detected objects.
     * Recommended model: facebook/detr-resnet-50
     */
    objectDetection(
      args: ObjectDetectionArgs,
      options?: Options
    ): Promise<ObjectDetectionReturn>;
    /**
     * This task reads some image input and outputs the likelihood of classes & bounding boxes of detected objects.
     * Recommended model: facebook/detr-resnet-50-panoptic
     */
    imageSegmentation(
      args: ImageSegmentationArgs,
      options?: Options
    ): Promise<ImageSegmentationReturn>;
    request(
      args: Args & {
        data?: any;
      },
      options?: Options & {
        binary?: boolean;
      }
    ): Promise<any>;
    private static toArray;
  }

  export default HuggingFace;
}
