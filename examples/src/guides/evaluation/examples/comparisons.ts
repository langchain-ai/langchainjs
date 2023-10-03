import { loadEvaluator } from "langchain/evaluation";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChainValues } from "langchain/schema";

//  Step 1. Create the Evaluator
// In this example, you will use gpt-4 to select which output is preferred.

const evalChain = await loadEvaluator("pairwise_string");

//  Step 2. Select Dataset

// If you already have real usage data for your LLM, you can use a representative sample. More examples
// provide more reliable results. We will use some example queries someone might have about how to use langchain here.
const dataset = [
  "Can I use LangChain to automatically rate limit or retry failed API calls?",
  "How can I ensure the accuracy and reliability of the travel data with LangChain?",
  "How can I track student progress with LangChain?",
  "langchain how to handle different document formats?",
  // "Can I chain API calls to different services in LangChain?",
  // "How do I handle API errors in my langchain app?",
  // "How do I handle different currency and tax calculations with LangChain?",
  // "How do I extract specific data from the document using langchain tools?",
  // "Can I use LangChain to handle real-time data from these APIs?",
  // "Can I use LangChain to track and manage travel alerts and updates?",
  // "Can I use LangChain to create and grade quizzes from these APIs?",
  // "Can I use LangChain to automate data cleaning and preprocessing for the AI plugins?",
  // "How can I ensure the accuracy and reliability of the financial data with LangChain?",
  // "Can I integrate medical imaging tools with LangChain?",
  // "How do I ensure the privacy and security of the patient data with LangChain?",
  // "How do I handle authentication for APIs in LangChain?",
  // "Can I use LangChain to recommend personalized study materials?",
  // "How do I connect to the arXiv API using LangChain?",
  // "How can I use LangChain to interact with educational APIs?",
  // "langchain how to sort retriever results - relevance or date?",
  // "Can I integrate a recommendation engine with LangChain to suggest products?"
];

// Step 3. Define Models to Compare

// We will be comparing two agents in this case.

const model = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-3.5-turbo-16k-0613",
});
const serpAPI = new SerpAPI(process.env.SERPAPI_API_KEY, {
  location: "Austin,Texas,United States",
  hl: "en",
  gl: "us",
});
serpAPI.description =
  "Useful when you need to answer questions about current events. You should ask targeted questions.";

const tools = [serpAPI];

const conversationAgent = await initializeAgentExecutorWithOptions(
  tools,
  model,
  {
    agentType: "chat-zero-shot-react-description",
  }
);

const functionsAgent = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "openai-functions",
});

// Step 4. Generate Responses

// We will generate outputs for each of the models before evaluating them.

const results = [];
const agents = [functionsAgent, conversationAgent];
const concurrencyLevel = 4; // How many concurrent agents to run. May need to decrease if OpenAI is rate limiting.

// We will only run the first 20 examples of this dataset to speed things up
// This will lead to larger confidence intervals downstream.
const batch = [];
for (const example of dataset) {
  batch.push(
    Promise.all(agents.map((agent) => agent.call({ input: example })))
  );
  if (batch.length >= concurrencyLevel) {
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    batch.length = 0;
  }
}

if (batch.length) {
  const batchResults = await Promise.all(batch);
  results.push(...batchResults);
}

console.log(JSON.stringify(results));

// Step 5. Evaluate Pairs

// Now it's time to evaluate the results. For each agent response, run the evaluation chain to select which output is preferred (or return a tie).

// Randomly select the input order to reduce the likelihood that one model will be preferred just because it is presented first.

const preferences = await predictPreferences(dataset, results);

// Print out the ratio of preferences.

const nameMap: { [key: string]: string } = {
  a: "OpenAI Functions Agent",
  b: "Structured Chat Agent",
};

const counts = counter(preferences);
const prefRatios: { [key: string]: number } = {};

for (const k of Object.keys(counts)) {
  prefRatios[k] = counts[k] / preferences.length;
}

for (const k of Object.keys(prefRatios)) {
  console.log(`${nameMap[k]}: ${(prefRatios[k] * 100).toFixed(2)}%`);
}
/*
OpenAI Functions Agent: 100.00%
 */

// Estimate Confidence Intervals

// The results seem pretty clear, but if you want to have a better sense of how confident we are, that model "A" (the OpenAI Functions Agent) is the preferred model, we can calculate confidence intervals.
// Below, use the Wilson score to estimate the confidence interval.

for (const [which_, name] of Object.entries(nameMap)) {
  const [low, high] = wilsonScoreInterval(preferences, which_);
  console.log(
    `The "${name}" would be preferred between ${(low * 100).toFixed(2)}% and ${(
      high * 100
    ).toFixed(2)}% percent of the time (with 95% confidence).`
  );
}

/*
The "OpenAI Functions Agent" would be preferred between 51.01% and 100.00% percent of the time (with 95% confidence).
The "Structured Chat Agent" would be preferred between 0.00% and 48.99% percent of the time (with 95% confidence).
 */

function counter(arr: string[]): { [key: string]: number } {
  return arr.reduce(
    (countMap: { [key: string]: number }, word: string) => ({
      ...countMap,
      [word]: (countMap[word] || 0) + 1,
    }),
    {}
  );
}

async function predictPreferences(dataset: string[], results: ChainValues[][]) {
  const preferences: string[] = [];

  for (let i = 0; i < dataset.length; i += 1) {
    const input = dataset[i];
    const resA = results[i][0];
    const resB = results[i][1];
    // Flip a coin to reduce persistent position bias
    let a;
    let b;
    let predA;
    let predB;

    if (Math.random() < 0.5) {
      predA = resA;
      predB = resB;
      a = "a";
      b = "b";
    } else {
      predA = resB;
      predB = resA;
      a = "b";
      b = "a";
    }

    const evalRes = await evalChain.evaluateStringPairs({
      input,
      prediction: predA.output || predA.toString(),
      predictionB: predB.output || predB.toString(),
    });

    if (evalRes.value === "A") {
      preferences.push(a);
    } else if (evalRes.value === "B") {
      preferences.push(b);
    } else {
      preferences.push("None"); // No preference
    }
  }
  return preferences;
}

function wilsonScoreInterval(
  preferences: string[],
  which = "a",
  z = 1.96
): [number, number] {
  const totalPreferences = preferences.filter(
    (p) => p === "a" || p === "b"
  ).length;
  const ns = preferences.filter((p) => p === which).length;

  if (totalPreferences === 0) {
    return [0, 0];
  }

  const pHat = ns / totalPreferences;

  const denominator = 1 + z ** 2 / totalPreferences;
  const adjustment =
    (z / denominator) *
    Math.sqrt(
      (pHat * (1 - pHat)) / totalPreferences +
        z ** 2 / (4 * totalPreferences ** 2)
    );
  const center = (pHat + z ** 2 / (2 * totalPreferences)) / denominator;
  const lowerBound = Math.min(Math.max(center - adjustment, 0.0), 1.0);
  const upperBound = Math.min(Math.max(center + adjustment, 0.0), 1.0);

  return [lowerBound, upperBound];
}
