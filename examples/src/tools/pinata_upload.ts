import {PinataUploadFileTool} from "@langchain/community/tools/pinata";

const client = {
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: "chocolate-magnetic-scorpion-427.mypinata.cloud",
}

const getFileUploadTool = new PinataUploadFileTool(client);
const uploadResult = await getFileUploadTool.invoke({
    url: "https://em-content.zobj.net/source/apple/391/astronaut-light-skin-tone_1f9d1-1f3fb-200d-1f680.png", //link to an astronaut emoji png
    name: "Astronaut Emoji",
    keyvalues: {"tag": "emoji"}
});

console.log(uploadResult);