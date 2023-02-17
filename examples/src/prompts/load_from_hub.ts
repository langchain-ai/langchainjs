import { loadPrompt } from "langchain/prompt";

export const run = async () => {
    const prompt = await loadPrompt("lc://prompts/hello-world/prompt.yaml");
    const res = prompt.format({});
    console.log({ res });
};