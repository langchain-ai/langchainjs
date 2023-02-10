// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChainValues = Record<string, any>;

export abstract class BaseChain {
  abstract format(values: ChainValues): ChainValues;
}
