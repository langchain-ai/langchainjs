import { ExaRetriever } from "@langchain/exa";
import Exa from "exa-js";

const retriever = new ExaRetriever({
  // @ts-expect-error Some TS Config's will cause this to give a TypeScript error, even though it works.
  client: new Exa(
    process.env.EXASEARCH_API_KEY // default API key
  ),
});

const retrievedDocs = await retriever.invoke(
  "What did the speaker say about Justice Breyer in the 2022 State of the Union?"
);
console.log(retrievedDocs);

/*
[
  Document {
    pageContent: undefined,
    metadata: {
      title: '2022 State of the Union Address | The White House',
      url: 'https://www.whitehouse.gov/state-of-the-union-2022/',
      publishedDate: '2022-02-25',
      author: null,
      id: 'SW3SLghgYTLQKnqBC-6ftQ',
      score: 0.163949653506279
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: "Read: Justice Stephen Breyer's White House remarks after announcing his retirement | CNN Politics",
      url: 'https://www.cnn.com/2022/01/27/politics/transcript-stephen-breyer-retirement-remarks/index.html',
      publishedDate: '2022-01-27',
      author: 'CNN',
      id: 'rIeqmU1L9sd28wGrqefRPA',
      score: 0.1638609766960144
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: 'Sunday, January 22, 2023 - How Appealing',
      url: 'https://howappealing.abovethelaw.com/2023/01/22/',
      publishedDate: '2023-01-22',
      author: null,
      id: 'aubLpkpZWoQSN-he-hwtRg',
      score: 0.15869899094104767
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: "Noting Past Divisions Retiring Justice Breyer Says It's Up to Future Generations to Make American Experiment Work",
      url: 'https://www.c-span.org/video/?517531-1/noting-past-divisions-retiring-justice-breyer-future-generations-make-american-experiment-work',
      publishedDate: '2022-01-27',
      author: null,
      id: '8pNk76nbao23bryEMD0u5g',
      score: 0.15786601603031158
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: 'Monday, January 24, 2022 - How Appealing',
      url: 'https://howappealing.abovethelaw.com/2022/01/24/',
      publishedDate: '2022-01-24',
      author: null,
      id: 'pt6xlioR4bdm8kSJUQoyPA',
      score: 0.1542145311832428
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: "Full transcript of Biden's State of the Union address",
      url: 'https://www.axios.com/2023/02/08/sotu-2023-biden-transcript?utm_source=twitter&utm_medium=social&utm_campaign=editorial&utm_content=politics',
      publishedDate: '2023-02-08',
      author: 'Axios',
      id: 'Dg5JepEwPwAMjgnSA_Z_NA',
      score: 0.15383175015449524
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: "Read Justice Breyer's remarks on retiring and his hope in the American 'experiment'",
      url: 'https://www.npr.org/2022/01/27/1076162088/read-stephen-breyer-retirement-supreme-court',
      publishedDate: '2022-01-27',
      author: 'NPR Staff',
      id: 'WDKA1biLMREo3BsOs95SIw',
      score: 0.14877735078334808
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: 'Grading My 2021 Predictions',
      url: 'https://astralcodexten.substack.com/p/grading-my-2021-predictions',
      publishedDate: '2022-01-24',
      author: 'Scott Alexander',
      id: 'jPutj4IcqgAiKSs6-eqv3g',
      score: 0.14813132584095
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: '',
      url: 'https://www.supremecourt.gov/oral_arguments/argument_transcripts/2021/21a240_l537.pdf',
      author: null,
      id: 'p97vY-5yvA2kBB9nl-7B3A',
      score: 0.14450226724147797
    }
  },
  Document {
    pageContent: undefined,
    metadata: {
      title: 'Remarks by President Biden at a Political Event | Charleston, SC',
      url: 'https://www.whitehouse.gov/briefing-room/speeches-remarks/2024/01/08/remarks-by-president-biden-at-a-political-event-charleston-sc/',
      publishedDate: '2024-01-08',
      author: 'The White House',
      id: 'ZdPbaacRn8bgwDWv_aA6zg',
      score: 0.14446410536766052
    }
  }
]
*/
