export { SerpAPI } from "./serpapi";
export { Calculator } from "./calculator";

export interface Tool {
  call: (arg: string) => Promise<string>;
  name: string;
  description: string;
  returnDirect?: boolean;
}
