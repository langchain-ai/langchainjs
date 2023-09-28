import { loadSummarizationChain } from "langchain/chains";
import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { SearchApiLoader } from "langchain/document_loaders/web/searchapi";
import { PromptTemplate } from "langchain/prompts";
import { TokenTextSplitter } from "langchain/text_splitter";

const loader = new SearchApiLoader({
  engine: "youtube_transcripts",
  video_id: "WTOm65IZneg",
});

const docs = await loader.load();

const splitter = new TokenTextSplitter({
  chunkSize: 10000,
  chunkOverlap: 250,
});

const docsSummary = await splitter.splitDocuments(docs);

const llmSummary = new ChatAnthropic({
  modelName: "claude-2",
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

const SUMMARY_PROMPT = PromptTemplate.fromTemplate(summaryTemplate);

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

const SUMMARY_REFINE_PROMPT = PromptTemplate.fromTemplate(
  summaryRefineTemplate
);

const summarizeChain = loadSummarizationChain(llmSummary, {
  type: "refine",
  verbose: true,
  questionPrompt: SUMMARY_PROMPT,
  refinePrompt: SUMMARY_REFINE_PROMPT,
});

const summary = await summarizeChain.run(docsSummary);

console.log(summary);

/*
  Here is a summary of the key points from the podcast transcript:

  - Jimmy helps provide hearing aids and cochlear implants to deaf and hard-of-hearing people who can't afford them. He helps over 1,000 people hear again.

  - Jimmy surprises recipients with $10,000 cash gifts in addition to the hearing aids. He also gifts things like jet skis, basketball game tickets, and trips to concerts.

  - Jimmy travels internationally to provide hearing aids, visiting places like Mexico, Guatemala, Brazil, South Africa, Malawi, and Indonesia. 

  - Jimmy donates $100,000 to organizations around the world that teach sign language.

  - The recipients are very emotional and grateful to be able to hear their loved ones again.

  Here are some example questions and answers about the podcast:

  Q: How many people did Jimmy help regain their hearing?
  A: Jimmy helped over 1,000 people regain their hearing.

  Q: What types of hearing devices did Jimmy provide to the recipients?
  A: Jimmy provided cutting-edge hearing aids and cochlear implants.

  Q: In addition to the hearing devices, what surprise gifts did Jimmy give some recipients?
  A: In addition to hearing devices, Jimmy surprised some recipients with $10,000 cash gifts, jet skis, basketball game tickets, and concert tickets.

  Q: What countries did Jimmy travel to in order to help people?
  A: Jimmy traveled to places like Mexico, Guatemala, Brazil, South Africa, Malawi, and Indonesia.

  Q: How much money did Jimmy donate to organizations that teach sign language?
  A: Jimmy donated $100,000 to sign language organizations around the world.

  Q: How did the recipients react when they were able to hear again?
  A: The recipients were very emotional and grateful, with many crying tears of joy at being able to hear their loved ones again.
*/
