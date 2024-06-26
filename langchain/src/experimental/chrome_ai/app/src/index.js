import { ChatChromeAI } from "langchain/experimental/chat_models/chrome_ai";
import { encodingForModel } from "@langchain/core/utils/tiktoken";

const model = new ChatChromeAI({ callbacks: {} });
const destroyButton = document.getElementById("destroyButton");
const inputForm = document.getElementById("inputForm");
const submitButton = inputForm.querySelector("button[type='submit']");

// Initialize the model when the page loads
window.addEventListener("load", async () => {
  try {
    await model.initialize();
    destroyButton.disabled = false;
    submitButton.disabled = false;
  } catch (error) {
    console.error("Failed to initialize model:", error);
    alert("Failed to initialize model. Please try refreshing the page.");
  }
});

destroyButton.addEventListener("click", () => {
  model.destroy();
  destroyButton.disabled = true;
  submitButton.disabled = true;
});

inputForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("inputField").value;
  const humanMessage = ["human", input];

  // Clear previous response
  const responseTextElement = document.getElementById("responseText");
  responseTextElement.textContent = "";

  let fullMsg = "";
  let timeToFirstTokenMs = 0;
  let totalTimeMs = 0;
  try {
    const startTime = performance.now();
    for await (const chunk of await model.stream(humanMessage)) {
      if (timeToFirstTokenMs === 0) {
        timeToFirstTokenMs = performance.now() - startTime;
      }
      fullMsg += chunk.content;
      // Update the response element with the new content
      responseTextElement.textContent = fullMsg;
    }
    totalTimeMs = performance.now() - startTime;
  } catch (error) {
    console.error("An error occurred:", error);
    responseTextElement.textContent = "An error occurred: " + error.message;
  }

  const encoding = await encodingForModel("gpt2");
  const numTokens = encoding.encode(fullMsg).length;

  // Update the stat pills
  console.log(`First Token: ${Math.round(timeToFirstTokenMs)} ms`);
  console.log(`Total Time: ${Math.round(totalTimeMs)} ms`);
  console.log(`Total Tokens: ${numTokens}`);
  document.getElementById(
    "firstTokenTime"
  ).textContent = `First Token: ${Math.round(timeToFirstTokenMs)} ms`;
  document.getElementById("totalTime").textContent = `Total Time: ${Math.round(
    totalTimeMs
  )} ms`;
  document.getElementById(
    "totalTokens"
  ).textContent = `Total Tokens: ${numTokens}`;
});
