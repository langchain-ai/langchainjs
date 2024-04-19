import { glob } from 'glob';

function updateDocsLastUpdated(pathToDocs: string) {
  const allIpynbFiles = glob.sync(`${pathToDocs}/**/*.ipynb`);
  // Iterate over all, get the last modified date, and ensure the date in docs matches this.
}