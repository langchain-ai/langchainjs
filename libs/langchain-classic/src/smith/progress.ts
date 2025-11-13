export class ProgressBar {
  total: number;

  current: number;

  barLength: number;

  format: string;

  constructor(props: { total: number; format?: string; barLength?: number }) {
    const { total, format, barLength } = props;
    this.total = total;
    this.current = 0;
    this.barLength = barLength ?? 40;
    this.format = format || "{bar} {percentage}% | {value}/{total}";
  }

  initialize(): void {
    this.update({ current: 0 });
  }

  update({
    current,
    formatArgs,
  }: {
    current: number;
    formatArgs?: Record<string, string>;
  }): void {
    this.current = current;
    const ratio = this.current / this.total;
    const filledBarLength = Math.round(ratio * this.barLength);
    const emptyBarLength = this.barLength - filledBarLength;

    const filledBar = "▓".repeat(filledBarLength);
    const emptyBar = "░".repeat(emptyBarLength);
    const percentage = (ratio * 100).toFixed(2);

    let formattedString = this.format
      .replace("{bar}", `${filledBar}${emptyBar}`)
      .replace("{percentage}", percentage)
      .replace("{value}", this.current.toString())
      .replace("{total}", this.total.toString());
    if (formatArgs) {
      for (const key in formatArgs) {
        if (Object.prototype.hasOwnProperty.call(formatArgs, key)) {
          formattedString = formattedString.replace(
            `{${key}}`,
            formatArgs[key].toString()
          );
        }
      }
    }

    console.log(formattedString);
  }

  increment({
    formatArgs,
  }: { formatArgs?: Record<string, string> } = {}): void {
    this.update({ current: this.current + 1, formatArgs });
  }

  complete({ formatArgs }: { formatArgs?: Record<string, string> } = {}): void {
    this.update({ current: this.total, formatArgs });
    console.log("\nCompleted");
  }
}
