import { BaseLLM } from "./base";
import { parseFileConfig } from "../util";

export const loadLLM = BaseLLM.deserialize;
export const loadLLMFromFile = (file: string) => loadLLM(parseFileConfig(file));
