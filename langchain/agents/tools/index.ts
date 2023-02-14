export { SerpAPI } from "./serpapi";

export interface Tool {
  call: (arg: string) => Promise<string>;
  name: string;
  description: string;
  returnDirect?: boolean;
}
