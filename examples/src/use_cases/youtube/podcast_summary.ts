import { loadSummarizationChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";
import { PromptTemplate } from "langchain/prompts";
import { TokenTextSplitter } from "langchain/text_splitter";

const loader = new SearchApiLoader({
  engine: "youtube_transcripts",
  video_id: "WTOm65IZneg",
});

const docs = await loader.load();

const textplitterSummary = new TokenTextSplitter({
  chunkSize: 10000,
  chunkOverlap: 250,
});

const docsSummary = await textplitterSummary.splitDocuments(docs);

const llmSummary = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-16k",
  temperature: 0.3,
});

const summaryTemplate = `
You are an expert in summarizing YouTube videos.
Your goal is to create a summary of a podcast.
Below you find the transcript of a podcast:
--------
{text}
--------

The transcript of the podcast will also be used as the basis for a question and answer bot.
Provide some examples questions and answers that could be asked about the podcast. Make these questions very specific.

Total output will be a summary of the video and a list of example questions the user could ask of the video.

SUMMARY AND QUESTIONS:
`;

const PROMPT_SUMMARY = new PromptTemplate({
  template: summaryTemplate,
  inputVariables: ["text"],
});

const summaryRefineTemplate = `
You are an expert in summarizing YouTube videos.
Your goal is to create a summary of a podcast.
We have provided an existing summary up to a certain point: {existing_answer}

Below you find the transcript of a podcast:
--------
{text}
--------

Given the new context, refine the summary and example questions.
The transcript of the podcast will also be used as the basis for a question and answer bot.
Provide some examples questions and answers that could be asked about the podcast. Make
these questions very specific.
If the context isn't useful, return the original summary and questions.
Total output will be a summary of the video and a list of example questions the user could ask of the video.

SUMMARY AND QUESTIONS:
`;

const PROMPT_SUMMARY_REFINE = new PromptTemplate({
  inputVariables: ["existing_answer", "text"],
  template: summaryRefineTemplate,
});

const summarize_chain = loadSummarizationChain(llmSummary, {
  type: "refine",
  verbose: true,
  questionPrompt: PROMPT_SUMMARY,
  refinePrompt: PROMPT_SUMMARY_REFINE,
});

const summary = await summarize_chain.run(docsSummary);

console.log(summary);

/*
  Summary:
  In this podcast, Jimmy, also known as MrBeast, helps 1,000 deaf people hear again by providing them with cutting-edge
  hearing technology. He surprises them with the gift of hearing and also gives them $10,000 each. Throughout the
  podcast, Jimmy helps individuals and families hear their loved ones again, bringing them to tears of joy. He also
  surprises them with additional gifts, such as jet skis and tickets to sporting events and concerts. Jimmy's mission
  extends beyond the United States, as he travels to Mexico and other countries to help deaf individuals there as well.
  He also donates $100,000 to organizations teaching sign language. The podcast showcases the power of connection and
  the impact of giving the gift of hearing.

  Example Questions
    1. How many deaf people did Jimmy help in this podcast
    2. What kind of hearing technology did Jimmy provide
    3. Besides the gift of hearing, what other surprises did Jimmy give to the individuals
    4. Which countries did Jimmy visit to help deaf people
    5. How much money did Jimmy donate to organizations teaching sign language
    6. What was the reaction of the individuals when they were able to hear again
    7. Did Jimmy only help individuals or also families
    8. What other activities did Jimmy surprise the individuals with
    9. How did Jimmy select the individuals he helped
    10. How did Jimmy's mission impact the lives of the deaf individuals?
*/
