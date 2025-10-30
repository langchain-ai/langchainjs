import { defineConfig } from "tsdown";
import { getBuildConfig } from "@langchain/build";

export default defineConfig(getBuildConfig());
