export abstract class Tool {
  abstract call(arg: string): Promise<string>;

  abstract name: string;

  abstract description: string;

  returnDirect = false;
}
