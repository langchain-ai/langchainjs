import { DalleApiWrapper, DalleApiWrapperParams } from '@langchain/community/tools/dalle_api_wrapper';

const params: DalleApiWrapperParams = {
    prompt: "a painting of a cat",
    n: 1,
    response_format: "json",
};

const tool = new DalleApiWrapper();

const imageArray = await tool.call(params);

console.log(imageArray);
