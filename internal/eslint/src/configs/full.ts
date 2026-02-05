import base from "./base.js";
import node from "./node.js";
import type { ConfigArray } from "typescript-eslint";

// Full LangChain ESLint configuration combining all configs
const config: ConfigArray = [...base, ...node];

export default config;
