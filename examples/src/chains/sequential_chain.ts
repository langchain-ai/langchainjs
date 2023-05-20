import { SequentialChain, LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";

// This is an LLMChain to write a synopsis given a title of a play and the era it is set in.
const llm = new OpenAI({ temperature: 0 });
const template = `You are a playwright. Given the title of play and the era it is set in, it is your job to write a synopsis for that title.

Title: {title}
Era: {era}
Playwright: This is a synopsis for the above play:`;
const promptTemplate = new PromptTemplate({
  template,
  inputVariables: ["title", "era"],
});
const synopsisChain = new LLMChain({
  llm,
  prompt: promptTemplate,
  outputKey: "synopsis",
});

// This is an LLMChain to write a review of a play given a synopsis.
const reviewLLM = new OpenAI({ temperature: 0 });
const reviewTemplate = `You are a play critic from the New York Times. Given the synopsis of play, it is your job to write a review for that play.
  
   Play Synopsis:
   {synopsis}
   Review from a New York Times play critic of the above play:`;
const reviewPromptTemplate = new PromptTemplate({
  template: reviewTemplate,
  inputVariables: ["synopsis"],
});
const reviewChain = new LLMChain({
  llm: reviewLLM,
  prompt: reviewPromptTemplate,
  outputKey: "review",
});

const overallChain = new SequentialChain({
  chains: [synopsisChain, reviewChain],
  inputVariables: ["era", "title"],
  // Here we return multiple variables
  outputVariables: ["synopsis", "review"],
  verbose: true,
});
const chainExecutionResult = await overallChain.call({
  title: "Tragedy at sunset on the beach",
  era: "Victorian England",
});
console.log(chainExecutionResult);
/*
    variable chainExecutionResult contains final review and intermediate synopsis (as specified by outputVariables). The data is generated based on the input title and era:

    "{
      "review": "

    Tragedy at Sunset on the Beach is a captivating and heartbreaking story of love and loss. Set in Victorian England, the play follows Emily, a young woman struggling to make ends meet in a small coastal town. Emily's dreams of a better life are dashed when she discovers her employer's scandalous affair, and her plans are further thwarted when she meets a handsome stranger on the beach.

    The play is a powerful exploration of the human condition, as Emily must grapple with the truth and make a difficult decision that will change her life forever. The performances are outstanding, with the actors bringing a depth of emotion to their characters that is both heartbreaking and inspiring.

    Overall, Tragedy at Sunset on the Beach is a beautiful and moving play that will leave audiences in tears. It is a must-see for anyone looking for a powerful and thought-provoking story.",
      "synopsis": "

    Tragedy at Sunset on the Beach is a play set in Victorian England. It tells the story of a young woman, Emily, who is struggling to make ends meet in a small coastal town. She works as a maid for a wealthy family, but her dreams of a better life are dashed when she discovers that her employer is involved in a scandalous affair.

    Emily is determined to make a better life for herself, but her plans are thwarted when she meets a handsome stranger on the beach one evening. The two quickly fall in love, but their happiness is short-lived when Emily discovers that the stranger is actually a member of the wealthy family she works for.

    The play follows Emily as she struggles to come to terms with the truth and make sense of her life. As the sun sets on the beach, Emily must decide whether to stay with the man she loves or to leave him and pursue her dreams. In the end, Emily must make a heartbreaking decision that will change her life forever.",
    }"
*/
