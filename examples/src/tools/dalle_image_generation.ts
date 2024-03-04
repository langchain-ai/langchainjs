import { DalleApiWrapper, DalleApiWrapperParams } from '@langchain/community/tools/dalle_api_wrapper';

const params: DalleApiWrapperParams = {
    prompt: "a painting of a cat",
    n: 1,
};

const tool = new DalleApiWrapper(params);

const imageArray = await tool.call("a painting of a cat");

console.log(imageArray);
