import dataForge from "data-forge";
import "data-forge-fs";

export const loadCSV = (filePath: string) => {
  const result = dataForge
    .readFileSync(filePath) // Read input file.
    .parseCSV().asJSON(); 
  return (result as any).dataframe.content;
};
const df = loadCSV("/Users/bracesproul/Downloads/titanic.csv");
console.log(df);
/**
{
  index: CountIterable {},
  values: CsvRowsIterable {
    columnNames: [
      'Survived',
      'Pclass',
      'Name',
      'Sex',
      'Age',
      'Siblings/Spouses Aboard',
      'Parents/Children Aboard',
      'Fare'
    ],
    rows: [
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array], [Array], [Array], [Array], [Array], [Array],
      [Array], [Array],
      ... 787 more items
    ]
  },
  pairs: MultiIterable { iterables: [ CountIterable {}, [CsvRowsIterable] ] },
  isBaked: false,
  columnNames: [
    'Survived',
    'Pclass',
    'Name',
    'Sex',
    'Age',
    'Siblings/Spouses Aboard',
    'Parents/Children Aboard',
    'Fare'
  ],
  isCaseSensitive: false
}
 */
