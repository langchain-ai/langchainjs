import {
  DallEAPIWrapper,
  DallEAPIWrapperParams,
} from "@langchain/community/tools/dalle_api_wrapper";

const params: DallEAPIWrapperParams = {
  prompt: "a painting of a cat",
  n: 1,
};

const tool = new DallEAPIWrapper(params);

const imageURL = await tool.invoke("a painting of a cat");

console.log(imageURL);
