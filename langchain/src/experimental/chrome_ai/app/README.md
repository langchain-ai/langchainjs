# ChatChromeAI

This is a simple application designed to run in the browser that uses the webGPU and Gemini Nano.
Gemini Nano is a LLM which Google Chrome has embedded in the browser. As of 06/26/2024 it is still in beta. To request access or find more information, please visit [this link](https://developer.chrome.com/docs/ai/built-in).

## Getting Started

To run this application, you'll first need to build the locally dependencies. From the root of the `langchain-ai/langchainjs` repo, run the following command:

```bash
yarn build --filter=langchain --filter=@langchain/openai
```

Once the dependencies are built, navigate into this directory (`langchain/src/experimental/chrome_ai/app`) and run the following command:

```bash
yarn install # install the dependencies

yarn start # start the application
```

Then, open your browser and navigate to [`http://127.0.0.1:8080/src/chrome_ai.html`](http://127.0.0.1:8080/src/chrome_ai.html).
