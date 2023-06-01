import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TimeWeightedVectorStoreRetriever } from "langchain/retrievers/time_weighted";
import {
  GenerativeAgentMemory,
  GenerativeAgent,
} from "langchain/experimental/generative_agents";

export const Simulation = async () => {
  const userName = "USER";
  const LLM = new OpenAI({
    temperature: 0.9,
    openAIApiKey: process.env.OPENAI_API_KEY,
    maxTokens: 1500,
  });

  const createNewMemoryRetriever = async () => {
    // create a new vector store retriever unique to the agent.
    const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore,
      otherScoreKeys: ["importance"],
      k: 15,
    });
    return retriever;
  };

  // tommie
  const tommiesMemory: GenerativeAgentMemory = new GenerativeAgentMemory(
    LLM,
    false,
    await createNewMemoryRetriever(),
    8
  );

  const tommie: GenerativeAgent = new GenerativeAgent(
    "Tommie",
    25,
    "anxious, likes design, talkative",
    "looking for a job",
    tommiesMemory,
    LLM
  );

  console.log("tommie first summary:", await tommie.getSummary());

  const tommieObservations = [
    "Tommie remembers his dog, Bruno, from when he was a kid",
    "Tommie feels tired from driving so far",
    "Tommie sees the new home",
    "The new neighbors have a cat",
    "The road is noisy at night",
    "Tommie is hungry",
    "Tommie tries to get some rest.",
  ];
  for (const observation of tommieObservations) {
    tommie.getMemory.addMemory(observation);
  }
  console.log("tommie second summary:", await tommie.getSummary(true));

  const interviewAgent = async (
    agent: GenerativeAgent,
    message: string
  ): Promise<string> => {
    // help user interact with the agent
    const newMessage = `${userName} says ${message}`;
    const response = await agent.generateDialogueResponse(newMessage);
    return response[1];
  };

  const observations = [
    "Tommie wakes up to the sound of a noisy construction site outside his window.",
    "Tommie gets out of bed and heads to the kitchen to make himself some coffee.",
    "Tommie realizes he forgot to buy coffee filters and starts rummaging through his moving boxes to find some.",
    "Tommie finally finds the filters and makes himself a cup of coffee.",
    "The coffee tastes bitter, and Tommie regrets not buying a better brand.",
    "Tommie checks his email and sees that he has no job offers yet.",
    "Tommie spends some time updating his resume and cover letter.",
    "Tommie heads out to explore the city and look for job openings.",
    "Tommie sees a sign for a job fair and decides to attend.",
    "The line to get in is long, and Tommie has to wait for an hour.",
    "Tommie meets several potential employers at the job fair but doesn't receive any offers.",
    "Tommie leaves the job fair feeling disappointed.",
    "Tommie stops by a local diner to grab some lunch.",
    "The service is slow, and Tommie has to wait for 30 minutes to get his food.",
    "Tommie overhears a conversation at the next table about a job opening.",
    "Tommie asks the diners about the job opening and gets some information about the company.",
    "Tommie decides to apply for the job and sends his resume and cover letter.",
    "Tommie continues his search for job openings and drops off his resume at several local businesses.",
    "Tommie takes a break from his job search to go for a walk in a nearby park.",
    "A dog approaches and licks Tommie's feet, and he pets it for a few minutes.",
    "Tommie sees a group of people playing frisbee and decides to join in.",
    "Tommie has fun playing frisbee but gets hit in the face with the frisbee and hurts his nose.",
    "Tommie goes back to his apartment to rest for a bit.",
    "A raccoon tore open the trash bag outside his apartment, and the garbage is all over the floor.",
    "Tommie starts to feel frustrated with his job search.",
    "Tommie calls his best friend to vent about his struggles.",
    "Tommie's friend offers some words of encouragement and tells him to keep trying.",
    "Tommie feels slightly better after talking to his friend.",
  ];

  for (let i = 0; i < observations.length; i++) {
    const observation = observations[i];
    const [_, reaction] = await tommie.generateReaction(observation);
    console.log("\x1b[32m", observation, "\x1b[0m", reaction);
    if ((i + 1) % 20 === 0) {
      console.log("*".repeat(40));
      console.log(
        "\x1b[34m",
        `After ${i + 1} observations, Tommie's summary is:\n${tommie.getSummary(
          true
        )}`,
        "\x1b[0m"
      );
      console.log("*".repeat(40));
    }
  }

  // interview after the day
  interviewAgent(tommie, "Tell me about how your day has been going");
  interviewAgent(tommie, "How do you feel about coffee?");
  interviewAgent(tommie, "Tell me about your childhood dog!");

  // eve
  const evesMemory: GenerativeAgentMemory = new GenerativeAgentMemory(
    LLM,
    false,
    await createNewMemoryRetriever(),
    5
  );

  const eve: GenerativeAgent = new GenerativeAgent(
    "Eve",
    34,
    "curious, helpful",
    "N/A",
    evesMemory,
    LLM,
    [
      "Eve started her new job as a career counselor last week and received her first assignment, a client named Tommie.",
    ]
  );

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayFormatted = yesterday.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // pre-convo interviews (added the 'await' keyword)
  await interviewAgent(eve, "How are you feeling about today?");
  await interviewAgent(eve, "What do you know about Tommie?");
  await interviewAgent(
    eve,
    "Tommie is looking to find a job. What are are some things you'd like to ask him?"
  );
  await interviewAgent(
    eve,
    "You'll have to ask him. He may be a bit anxious, so I'd appreciate it if you keep the conversation going and ask as many questions as possible."
  );

  // convo
  const runConversation = async (
    agents: GenerativeAgent[],
    initialObservation: string
  ): Promise<void> => {
    // runs a convo bewt1een two agents
    let observation: string;
    [, observation] = await agents[1].generateReaction(initialObservation);
    console.log(observation);
    let turns = 0;

    while (true) {
      let breakDialogue = false;
      for (const agent of agents) {
        let stayInDialogue: boolean;
        let agentObservation: string;
        [stayInDialogue, agentObservation] =
          await agent.generateDialogueResponse(observation);
        console.log(agentObservation);
        // observation = `${agent.name} said ${reaction}`;
        if (!stayInDialogue) {
          breakDialogue = true;
        }
      }

      if (breakDialogue) {
        break;
      }

      turns++;
    }
  };

  const agents: GenerativeAgent[] = [tommie, eve];
  runConversation(
    agents,
    "Tommie said: Hi, Eve. Thanks for agreeing to meet with me today. I have a bunch of questions and am not sure where to start. Maybe you could first share about your experience?"
  );

  // post-convo interviews
  console.log("third final summary", tommie.getSummary(true));
  const tommieSummary: string = await tommie.getSummary(true);
  // setTommieFinalSummary(await tommie.getSummary(true));

  console.log("eve final summary", eve.getSummary(true));
  const eveSummary: string = await eve.getSummary(true);
  // setEveFinalSummary(await eve.getSummary(true));

  const interviewOne: string = await interviewAgent(
    tommie,
    "How was your conversation with Eve?"
  );
  console.log("interview one", interviewOne);

  // setInterviewOne(await interviewAgent(tommie, "How was your conversation with Eve?"));

  const interviewTwo: string = await interviewAgent(
    eve,
    "How was your conversation with Tommie?"
  );
  console.log("interview two", interviewTwo);
  // setInterviewTwo(await interviewAgent(eve, "How was your conversation with Tommie?"));

  const interviewThree: string = await interviewAgent(
    eve,
    "What do you wish you would have said to Tommie?"
  );
  console.log("interview three", interviewThree);
  // setInterviewThree(await interviewAgent(eve, "What do you wish you would have said to Tommie?"));

  return {
    tommieFinalSummary: tommieSummary,
    eveFinalSummary: eveSummary,
    interviewOne,
    interviewTwo,
    interviewThree,
  };
};

const runSimulation = async () => {
  try {
    await Simulation();
  } catch (error) {
    console.log("error running simulation:", error);
  }
};

runSimulation();
/** 
 * an excerpt of an example output:
 * tommie first summary: Name: Tommie (age: 25)
        Innate traits: anxious, likes design, talkative
        Tommie's core characteristics include being honest and direct in their communication, with a focus on accuracy and authenticity.
tommie first summary: Name: Tommie (age: 25)
        Innate traits: anxious, likes design, talkative
        Tommie is honest, dependable, and values accuracy.
tommie second summary: Name: Tommie (age: 25)
        Innate traits: anxious, likes design, talkative
        Tommie is an honest and straightforward individual who values sincerity and accuracy.
tommie second summary: Name: Tommie (age: 25)
        Innate traits: anxious, likes design, talkative
        Tommie is a straightforward person who values honesty and accuracy, preferring not to embellish or exaggerate.
{
  output: '\n' +
    'Tommie loves making noise.\n' +
    '\n' +
    'Tommie and making noise have a positive relationship. Tommie enjoys making noise and has a lot of fun doing so.'
}
the value of relevantMemoriesStr Tommie loves making noise.

Tommie and making noise have a positive relationship. Tommie enjoys making noise and has a lot of fun doing so.
result in generateReaction REACT: Tommie sighs in frustration.
 Tommie wakes up to the sound of a noisy construction site outside his window.  Tommie REACT: Tommie sighs in frustration.
{
  output: '\n' +
    'Tommie and making noise are not related in any way. Tommie may make noise, but it does not have a significant or relevant connection to who Tommie is.'
}
the value of relevantMemoriesStr Tommie and making noise are not related in any way. Tommie may make noise, but it does not have a significant or relevant connection to who Tommie is.
result in generateReaction REACT: Tommie groans in frustration at the noise outside.
 Tommie wakes up to the sound of a noisy construction site outside his window.  Tommie REACT: Tommie groans in frustration at the noise outside.
{
  output: '\n' +
    'Tommie loves making coffee.\n' +
    '\n' +
    'Tommie has a strong positive relationship with making coffee.'
}
the value of relevantMemoriesStr Tommie loves making coffee.

Tommie has a strong positive relationship with making coffee.
{
  output: '\n' +
    'Tommie is an avid coffee enthusiast and a barista.\n' +
    '\n' +
    'Tommie has a strong relationship with making coffee. As a barista, he is knowledgeable in making a variety of coffee drinks, and is passionate about the art of crafting coffee beverages. He enjoys experimenting with different flavors and techniques to create unique coffee experiences for his customers.'
}
the value of relevantMemoriesStr Tommie is an avid coffee enthusiast and a barista.

Tommie has a strong relationship with making coffee. As a barista, he is knowledgeable in making a variety of coffee drinks, and is passionate about the art of crafting coffee beverages. He enjoys experimenting with different flavors and techniques to create unique coffee experiences for his customers.
result in generateReaction REACT: Tommie nervously fidgets with his hands, reflecting on the current job search.
 Tommie gets out of bed and heads to the kitchen to make himself some coffee.  Tommie REACT: Tommie nervously fidgets with his hands, reflecting on the current job search.
result in generateReaction REACT: Anxious and uncertain about the job hunt, Tommie sighs as he pours coffee.
 Tommie gets out of bed and heads to the kitchen to make himself some coffee.  Tommie REACT: Anxious and uncertain about the job hunt, Tommie sighs as he pours coffee.
{
  output: '\n' +
    'Tommie enjoyed rummaging through the cupboard and finding new items.\n' +
    '\n' +
    'Tommie and rummaging have a recreational relationship; Tommie enjoys rummaging through the cupboard.'
}
the value of relevantMemoriesStr Tommie enjoyed rummaging through the cupboard and finding new items.

Tommie and rummaging have a recreational relationship; Tommie enjoys rummaging through the cupboard.
{
  output: '\n' +
    'Tommie is searching for a new job.\n' +
    '\n' +
    'Tommie and searching have a cause-and-effect relationship: Tommie is searching for a new job because he wants to find a new job.'
}
the value of relevantMemoriesStr Tommie is searching for a new job.

Tommie and searching have a cause-and-effect relationship: Tommie is searching for a new job because he wants to find a new job.
result in generateReaction REACT: Tommie sighs as he looks around for coffee filters.
 Tommie realizes he forgot to buy coffee filters and starts rummaging through his moving boxes to find some.  Tommie REACT: Tommie sighs as he looks around for coffee filters.
result in generateReaction REACT: Tommie curses his forgetfulness and continues searching for the coffee filters.
 Tommie realizes he forgot to buy coffee filters and starts rummaging through his moving boxes to find some.  Tommie REACT: Tommie curses his forgetfulness and continues searching for the coffee filters.
{
  output: '\n' +
    'Tommie is standing in the kitchen watching the coffee maker.\n' +
    '\n' +
    'Tommie and making a cup of coffee have a dependent relationship, since the coffee maker needs Tommie to provide the coffee and other ingredients, press the buttons, and fill the machine so that it can make the coffee.'
}
the value of relevantMemoriesStr Tommie is standing in the kitchen watching the coffee maker.

Tommie and making a cup of coffee have a dependent relationship, since the coffee maker needs Tommie to provide the coffee and other ingredients, press the buttons, and fill the machine so that it can make the coffee.
{
  output: '\n' +
    'Tommie is a barista at a local cafe.\n' +
    '\n' +
    'Tommie has a close relationship with making coffee; she is an expert in crafting specialty coffee beverages and loves to share her knowledge and suggestions with customers.'
}
the value of relevantMemoriesStr Tommie is a barista at a local cafe.

Tommie has a close relationship with making coffee; she is an expert in crafting specialty coffee beverages and loves to share her knowledge and suggestions with customers.
result in generateReaction REACT: Tommie takes a sip of his coffee with a relieved sigh.
 Tommie finally finds the filters and makes himself a cup of coffee.  Tommie REACT: Tommie takes a sip of his coffee with a relieved sigh.
result in generateReaction REACT: Tommie takes a sip of the coffee and sighs in contentment.
 Tommie finally finds the filters and makes himself a cup of coffee.  Tommie REACT: Tommie takes a sip of the coffee and sighs in contentment.
{
  output: '\n' +
    'Tommie was in the store buying coffee.\n' +
    '\n' +
    'Tommie and buying coffee have a transactional relationship; Tommie is purchasing coffee in exchange for money.'
}
the value of relevantMemoriesStr Tommie was in the store buying coffee.

Tommie and buying coffee have a transactional relationship; Tommie is purchasing coffee in exchange for money.
result in generateReaction REACT: Tommie makes a sour face and sighs.
 The coffee tastes bitter, and Tommie regrets not buying a better brand.  Tommie REACT: Tommie makes a sour face and sighs.
{
  output: '\n' +
    'Tommie is a barista at an artisanal cafe.\n' +
    '\n' +
    'Tommie has a passion for tasting coffee.\n' +
    '\n' +
    'The relationship between Tommie and tasting coffee is that Tommie has a passionate interest in it. As a barista, Tommie is able to explore his passion for coffee by trying different types of coffee, experimenting with flavors, and introducing customers to different coffee experiences.'
}
the value of relevantMemoriesStr Tommie is a barista at an artisanal cafe.

Tommie has a passion for tasting coffee.

The relationship between Tommie and tasting coffee is that Tommie has a passionate interest in it. As a barista, Tommie is able to explore his passion for coffee by trying different types of coffee, experimenting with flavors, and introducing customers to different coffee experiences.
result in generateReaction REACT: Tommie frowned as he took a sip of his coffee.
 The coffee tastes bitter, and Tommie regrets not buying a better brand.  Tommie REACT: Tommie frowned as he took a sip of his coffee.
{
  output: '\n' +
    'Tommie is checking his email.\n' +
    '\n' +
    'Tommie and checking email have a transactional relationship; Tommie is the one performing the action of checking the email.'
}
the value of relevantMemoriesStr Tommie is checking his email.

Tommie and checking email have a transactional relationship; Tommie is the one performing the action of checking the email.
result in generateReaction REACT: Tommie feels anxious, frustrated, and discouraged.
 Tommie checks his email and sees that he has no job offers yet.  Tommie REACT: Tommie feels anxious, frustrated, and discouraged.
{
  output: '\n' +
    'Tommie is checking his email.\n' +
    '\n' +
    'Tommie and checking email have a direct relationship, as Tommie is actively engaging in the activity of checking his email.'
}
the value of relevantMemoriesStr Tommie is checking his email.

Tommie and checking email have a direct relationship, as Tommie is actively engaging in the activity of checking his email.
result in generateReaction REACT: Tommie feels discouraged and anxious.
 Tommie checks his email and sees that he has no job offers yet.  Tommie REACT: Tommie feels discouraged and anxious.
{
  output: '\n' +
    'Tommie is a professional document editor and writer.\n' +
    '\n' +
    "Tommie's job is to write and update documents to ensure that they are accurate, up-to-date, and meet the needs of the intended audience. Tommie is responsible for researching topics, creating original content, and revising existing documents."
}
the value of relevantMemoriesStr Tommie is a professional document editor and writer.

Tommie's job is to write and update documents to ensure that they are accurate, up-to-date, and meet the needs of the intended audience. Tommie is responsible for researching topics, creating original content, and revising existing documents.
result in generateReaction REACT: Tommie takes a few deep breaths and reassures himself that preparing his resume and cover letter is a step in the right direction.
 Tommie spends some time updating his resume and cover letter.  Tommie REACT: Tommie takes a few deep breaths and reassures himself that preparing his resume and cover letter is a step in the right direction.
{
  output: '\n' +
    'Tommie is currently trying to update his resume and cover letter to apply for jobs.\n' +
    '\n' +
    "Tommie's relationship with updating his resume and cover letter is that he is actively trying to improve them in order to increase his chances of landing a job. He is making sure that the documents are up-to-date, professional, and accurately reflect his qualifications and experience."
}
the value of relevantMemoriesStr Tommie is currently trying to update his resume and cover letter to apply for jobs.

Tommie's relationship with updating his resume and cover letter is that he is actively trying to improve them in order to increase his chances of landing a job. He is making sure that the documents are up-to-date, professional, and accurately reflect his qualifications and experience.
result in generateReaction REACT: Tommie takes a deep breath and continues working on his resume.
 Tommie spends some time updating his resume and cover letter.  Tommie REACT: Tommie takes a deep breath and continues working on his resume.
{
  output: '\n' +
    'Tommie is a recent college graduate who is exploring the city and looking for job openings.\n' +
    '\n' +
    "Tommie's relationship to exploring the city and looking for job openings is that he is actively engaging in activities to improve his chances of finding a job. He is searching for potential employment opportunities and familiarizing himself with the area."
}
the value of relevantMemoriesStr Tommie is a recent college graduate who is exploring the city and looking for job openings.

Tommie's relationship to exploring the city and looking for job openings is that he is actively engaging in activities to improve his chances of finding a job. He is searching for potential employment opportunities and familiarizing himself with the area.
{
  output: '\n' +
    'Tommie is searching for job openings.\n' +
    '\n' +
    'The relationship between Tommie and looking for job openings is that Tommie is actively searching for available job opportunities.'
}
the value of relevantMemoriesStr Tommie is searching for job openings.

The relationship between Tommie and looking for job openings is that Tommie is actively searching for available job opportunities.
result in generateReaction REACT: Tommie takes a deep breath and carries on.
 Tommie heads out to explore the city and look for job openings.  Tommie REACT: Tommie takes a deep breath and carries on.
result in generateReaction REACT: Tommie anxiously checks out the city, looking for any job opportunities.
 Tommie heads out to explore the city and look for job openings.  Tommie REACT: Tommie anxiously checks out the city, looking for any job opportunities.
{
  output: '\n' +
    'Tommie is trying to decide what to do after college.\n' +
    '\n' +
    "Tommie and deciding have a causal relationship in this context. Tommie's decision is the result of the process of deciding."
}
the value of relevantMemoriesStr Tommie is trying to decide what to do after college.

Tommie and deciding have a causal relationship in this context. Tommie's decision is the result of the process of deciding.
{
  output: '\n' +
    'Tommie is deciding whether to go on vacation.\n' +
    '\n' +
    'Tommie and deciding are directly related. Tommie is the one making the decision about whether or not to go on vacation.'
}
the value of relevantMemoriesStr Tommie is deciding whether to go on vacation.

Tommie and deciding are directly related. Tommie is the one making the decision about whether or not to go on vacation.
result in generateReaction REACT: Tommie perked up with excitement and determination.
 Tommie sees a sign for a job fair and decides to attend.  Tommie REACT: Tommie perked up with excitement and determination.
result in generateReaction REACT: Tommie takes a deep breath and prepares to attend the fair.
 Tommie sees a sign for a job fair and decides to attend.  Tommie REACT: Tommie takes a deep breath and prepares to attend the fair.
{
  output: '\n' +
    'Tommie was waiting for something to happen.\n' +
    '\n' +
    'Tommie and waiting are related in that Tommie is in a state of waiting for something to happen.'
}
the value of relevantMemoriesStr Tommie was waiting for something to happen.

Tommie and waiting are related in that Tommie is in a state of waiting for something to happen.
{
  output: '\n' +
    'Tommie was waiting in line at the store.\n' +
    '\n' +
    'Tommie and waiting in line have a causal relationship: Tommie was waiting in line because there was something at the store he wanted or needed.'
}
the value of relevantMemoriesStr Tommie was waiting in line at the store.

Tommie and waiting in line have a causal relationship: Tommie was waiting in line because there was something at the store he wanted or needed.
result in generateReaction REACT: Tommie stands in line patiently, feeling anxious.
 The line to get in is long, and Tommie has to wait for an hour.  Tommie REACT: Tommie stands in line patiently, feeling anxious.
result in generateReaction REACT: Tommie is anxious as they wait to get in.
 The line to get in is long, and Tommie has to wait for an hour.  Tommie REACT: Tommie is anxious as they wait to get in.
{
  output: '\n' +
    'Tommie is looking for a job.\n' +
    '\n' +
    "Tommie's relationship to attending a job fair is that it is a potential avenue for him to find job opportunities. By attending a job fair, Tommie could meet employers and learn about potential roles he could be interested in applying for."
}
the value of relevantMemoriesStr Tommie is looking for a job.

Tommie's relationship to attending a job fair is that it is a potential avenue for him to find job opportunities. By attending a job fair, Tommie could meet employers and learn about potential roles he could be interested in applying for.
{
  output: '\n' +
    'Tommie is looking for a job and has heard about a job fair in the area.\n' +
    '\n' +
    "Tommie's relationship to attending a job fair is that it is an opportunity for him to find a job. He is attending the job fair in order to explore different job opportunities and meet potential employers."
}
the value of relevantMemoriesStr Tommie is looking for a job and has heard about a job fair in the area.

Tommie's relationship to attending a job fair is that it is an opportunity for him to find a job. He is attending the job fair in order to explore different job opportunities and meet potential employers.
result in generateReaction REACT: Tommie frowns in disappointment.
 Tommie meets several potential employers at the job fair but doesn't receive any offers.  Tommie REACT: Tommie frowns in disappointment.
result in generateReaction REACT: Tommie is disappointed but remains hopeful for the future.
 Tommie meets several potential employers at the job fair but doesn't receive any offers.  Tommie REACT: Tommie is disappointed but remains hopeful for the future.
{
  output: '\n' +
    'Tommie is considering leaving his job.\n' +
    '\n' +
    'Tommie and leaving are related in that he is considering it as an option.'
}
the value of relevantMemoriesStr Tommie is considering leaving his job.

Tommie and leaving are related in that he is considering it as an option.
result in generateReaction REACT: Tommie sighs, feeling disheartened.
 Tommie leaves the job fair feeling disappointed.  Tommie REACT: Tommie sighs, feeling disheartened.
{
  output: '\n' +
    'Tommie was feeling discouraged after visiting the job fair. He was overwhelmed by the number of people there and felt like he had not made any progress in terms of getting a job.\n' +
    '\n' +
    'Tommie and leaving the job fair are related in that Tommie left the job fair feeling discouraged and overwhelmed.'
}
the value of relevantMemoriesStr Tommie was feeling discouraged after visiting the job fair. He was overwhelmed by the number of people there and felt like he had not made any progress in terms of getting a job.

Tommie and leaving the job fair are related in that Tommie left the job fair feeling discouraged and overwhelmed.
result in generateReaction REACT: Tommie lets out a sigh of defeat.
 Tommie leaves the job fair feeling disappointed.  Tommie REACT: Tommie lets out a sigh of defeat.
{
  output: '\n' +
    'Tommie is buying lunch for a group of friends.\n' +
    '\n' +
    'Tommie and the group of friends have a close relationship; Tommie is buying lunch out of a sense of friendship and generosity.'
}
the value of relevantMemoriesStr Tommie is buying lunch for a group of friends.

Tommie and the group of friends have a close relationship; Tommie is buying lunch out of a sense of friendship and generosity.
{
  output: '\nTommie loves eating.\n\nTommie and eating have a positive relationship.'
}
the value of relevantMemoriesStr Tommie loves eating.

Tommie and eating have a positive relationship.
result in generateReaction REACT: Tommie looks around the diner with apprehension, feeling anxious about the job hunt.
 Tommie stops by a local diner to grab some lunch.  Tommie REACT: Tommie looks around the diner with apprehension, feeling anxious about the job hunt.
result in generateReaction REACT: Tommie looks around the diner, feeling anxious about the job search.
 Tommie stops by a local diner to grab some lunch.  Tommie REACT: Tommie looks around the diner, feeling anxious about the job search.
{
  output: '\n' +
    'Tommie has been waiting for hours.\n' +
    '\n' +
    'Tommie and waiting have a relationship of Tommie waiting for hours.'
}
the value of relevantMemoriesStr Tommie has been waiting for hours.

Tommie and waiting have a relationship of Tommie waiting for hours.
result in generateReaction REACT: Tommie shakes his head in frustration.
 The service is slow, and Tommie has to wait for 30 minutes to get his food.  Tommie REACT: Tommie shakes his head in frustration.
{
  output: '\n' +
    'Tommie is waiting for his friend at the bus stop.\n' +
    '\n' +
    'Tommie and waiting have a temporal relationship; Tommie is waiting for his friend at the bus stop.'
}
the value of relevantMemoriesStr Tommie is waiting for his friend at the bus stop.

Tommie and waiting have a temporal relationship; Tommie is waiting for his friend at the bus stop.
result in generateReaction REACT: Tommie shows frustration but maintains a polite and understanding demeanor.
 The service is slow, and Tommie has to wait for 30 minutes to get his food.  Tommie REACT: Tommie shows frustration but maintains a polite and understanding demeanor.
{
  output: '\n' +
    'Tommie is always listening to music.\n' +
    '\n' +
    'Tommie and listening are related in that Tommie enjoys listening to music.'
}
the value of relevantMemoriesStr Tommie is always listening to music.

Tommie and listening are related in that Tommie enjoys listening to music.
{
  output: '\n' +
    'Tommie is a student in a government-sponsored program that teaches students the art of eavesdropping.\n' +
    '\n' +
    'Tommie and eavesdropping have a mentor-mentee relationship. Tommie is learning the art of eavesdropping from the government-sponsored program.'
}
the value of relevantMemoriesStr Tommie is a student in a government-sponsored program that teaches students the art of eavesdropping.

Tommie and eavesdropping have a mentor-mentee relationship. Tommie is learning the art of eavesdropping from the government-sponsored program.
result in generateReaction REACT: Tommie leans in to listen more closely.
 Tommie overhears a conversation at the next table about a job opening.  Tommie REACT: Tommie leans in to listen more closely.
 */
