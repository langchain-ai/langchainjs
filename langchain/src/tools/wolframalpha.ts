import axiosMod, { AxiosStatic } from "axios";
import { Tool } from "./base.js";

const axios = (
    "default" in axiosMod ? axiosMod.default : axiosMod
  ) as AxiosStatic;

export class WolframAlphaTool extends Tool {
  appid = "";

  name = "wolframalpha";

  description = `A wrapper around Wolfram Alpha. Useful for when you need to answer questions about Math, Science, Technology, Culture, Society and Everyday Life. Input should be a search query.
`;

  constructor(appid: string) {
    super(...arguments);

    this.appid = appid;
  }

  get lc_namespace() {
    return [...super.lc_namespace, "wolframalpha"];
  }

  static lc_name() {
    return "WolframAlpha";
  }

  async _call(inputs: string): Promise<string> {
    const url = `https://www.wolframalpha.com/api/v1/llm-api`;

    const res = await axios.get(url, {
      params: {
        input: inputs,
        appid: this.appid,
      },
    });

    return res.data;
  }
}
