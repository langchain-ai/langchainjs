import { BaseServiceParams } from "assemblyai";
import { Optional } from "./type-utils.js";

export type * from "assemblyai";

export type AssemblyAIOptions = Optional<BaseServiceParams, "apiKey">;
