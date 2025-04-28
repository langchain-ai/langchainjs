import { HTMLWebBaseLoader } from "@langchain/community/document_loaders/web/html";
import { MozillaReadabilityTransformer } from "@langchain/community/document_transformers/mozilla_readability";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const loader = new HTMLWebBaseLoader(
  "https://news.ycombinator.com/item?id=34817881"
);

const docs = await loader.load();

const splitter = RecursiveCharacterTextSplitter.fromLanguage("html");
const transformer = new MozillaReadabilityTransformer();

const sequence = transformer.pipe(splitter);

const newDocuments = await sequence.invoke(docs);

console.log(newDocuments);

/*
  [
    Document {
      pageContent: 'Hacker News new | past | comments | ask | show | jobs | submit login What Lights\n' +
        'the Universe’s Standard Candles? (quantamagazine.org) 75 points by Amorymeltzer\n' +
        '5 months ago | hide | past | favorite | 6 comments delta_p_delta_x 5 months ago\n' +
        '| next [–] Astrophysical and cosmological simulations are often insightful.\n' +
        "They're also very cross-disciplinary; besides the obvious astrophysics, there's\n" +
        'networking and sysadmin, parallel computing and algorithm theory (so that the\n' +
        'simulation programs are actually fast but still accurate), systems design, and\n' +
        'even a bit of graphic design for the visualisations.Some of my favourite\n' +
        'simulation projects:- IllustrisTNG:',
      metadata: {
        source: 'https://news.ycombinator.com/item?id=34817881',
        loc: [Object]
      }
    },
    Document {
      pageContent: 'that the simulation programs are actually fast but still accurate), systems\n' +
        'design, and even a bit of graphic design for the visualisations.Some of my\n' +
        'favourite simulation projects:- IllustrisTNG: https://www.tng-project.org/-\n' +
        'SWIFT: https://swift.dur.ac.uk/- CO5BOLD:\n' +
        'https://www.astro.uu.se/~bf/co5bold_main.html (which produced these animations\n' +
        'of a red-giant star: https://www.astro.uu.se/~bf/movie/AGBmovie.html)-\n' +
        'AbacusSummit: https://abacussummit.readthedocs.io/en/latest/And I can add the\n' +
        'simulations in the article, too. froeb 5 months ago | parent | next [–]\n' +
        'Supernova simulations are especially interesting too. I have heard them\n' +
        'described as the only time in physics when all 4 of the fundamental forces are\n' +
        'important. The explosion can be quite finicky too. If I remember right, you\n' +
        "can't get supernova to explode",
      metadata: {
        source: 'https://news.ycombinator.com/item?id=34817881',
        loc: [Object]
      }
    },
    Document {
      pageContent: 'heard them described as the only time in physics when all 4 of the fundamental\n' +
        'forces are important. The explosion can be quite finicky too. If I remember\n' +
        "right, you can't get supernova to explode properly in 1D simulations, only in\n" +
        'higher dimensions. This was a mystery until the realization that turbulence is\n' +
        'necessary for supernova to trigger--there is no turbulent flow in 1D. andrewflnr\n' +
        "5 months ago | prev | next [–] Whoa. I didn't know the accretion theory of Ia\n" +
        'supernovae was dead, much less that it had been since 2011. andreareina 5 months\n' +
        'ago | prev | next [–] This seems to be the paper',
      metadata: {
        source: 'https://news.ycombinator.com/item?id=34817881',
        loc: [Object]
      }
    },
    Document {
      pageContent: 'andreareina 5 months ago | prev | next [–] This seems to be the paper\n' +
        'https://academic.oup.com/mnras/article/517/4/5260/6779709 andreareina 5 months\n' +
        "ago | prev [–] Wouldn't double detonation show up as variance in the brightness?\n" +
        'yencabulator 5 months ago | parent [–] Or widening of the peak. If one type Ia\n' +
        'supernova goes 1,2,3,2,1, the sum of two could go 1+0=1 2+1=3 3+2=5 2+3=5 1+2=3\n' +
        '0+1=1 Guidelines | FAQ | Lists |',
      metadata: {
        source: 'https://news.ycombinator.com/item?id=34817881',
        loc: [Object]
      }
    },
    Document {
      pageContent: 'the sum of two could go 1+0=1 2+1=3 3+2=5 2+3=5 1+2=3 0+1=1 Guidelines | FAQ |\n' +
        'Lists | API | Security | Legal | Apply to YC | Contact Search:',
      metadata: {
        source: 'https://news.ycombinator.com/item?id=34817881',
        loc: [Object]
      }
    }
  ]
*/
