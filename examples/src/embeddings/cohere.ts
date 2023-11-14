import { CohereEmbeddings } from "langchain/embeddings/cohere";

const cohere = new CohereEmbeddings({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.COHERE_API_KEY
  batchSize: 48, // Default value if omitted is 48. Max value is 96
  modelName: "embed-english-v3.0", // Default value if omitted is "small".
  inputType: "classification", // Optional parameter unless using a v3 model.
});

const texts = [
  "I love Cohere!",
  "I hate Cohere!",
  "I feel neutral about Cohere.",
];

const embeddings = await cohere.embedDocuments(texts);
console.log(embeddings);
/**
 * [
  [
     -0.007194519,  -0.009376526,    -0.10015869,   -0.06750488,
     -0.011001587,  -0.034454346,   -0.074523926,    0.03756714,
    ... 943 more items
  ],
  [
     -0.009613037, -0.022705078,   -0.07318115,  -0.02255249,  -0.019729614,
      0.009689331,  -0.024749756,   -0.06665039,  -0.02128601,  -0.010520935,
    ... 943 more items
  ],
  [
      0.009689331,  -0.024749756,   -0.06665039,  -0.02128601,  -0.010520935,
     -0.007194519,  -0.009376526,    -0.10015869,   -0.06750488, -0.02128601,
    ... 943 more items
  ]
]
 */
