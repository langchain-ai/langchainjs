import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TimeWeightedVectorStoreRetriever } from "langchain/retrievers/time_weighted";
import {
  GenerativeAgentMemory,
  GenerativeAgent,
} from "langchain/experimental/generative_agents";

const Simulation = async () => {
  const userName = "USER";
  const llm = new OpenAI({
    temperature: 0.9,
    maxTokens: 1500,
  });

  const createNewMemoryRetriever = async () => {
    // Create a new, demo in-memory vector store retriever unique to the agent.
    // Better results can be achieved with a more sophisticatd vector store.
    const vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
    const retriever = new TimeWeightedVectorStoreRetriever({
      vectorStore,
      otherScoreKeys: ["importance"],
      k: 15,
    });
    return retriever;
  };

  // Initializing Tommie
  const tommiesMemory: GenerativeAgentMemory = new GenerativeAgentMemory(
    llm,
    await createNewMemoryRetriever(),
    { reflectionThreshold: 8 }
  );

  const tommie: GenerativeAgent = new GenerativeAgent(llm, tommiesMemory, {
    name: "Tommie",
    age: 25,
    traits: "anxious, likes design, talkative",
    status: "looking for a job",
  });

  console.log("Tommie's first summary:\n", await tommie.getSummary());

  /*
    Tommie's first summary:
    Name: Tommie (age: 25)
    Innate traits: anxious, likes design, talkative
    Tommie is an individual with no specific core characteristics described.
  */

  // Let's give Tommie some memories!
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
    await tommie.addMemory(observation, new Date());
  }

  // Checking Tommie's summary again after giving him some memories
  console.log(
    "Tommie's second summary:\n",
    await tommie.getSummary({ forceRefresh: true })
  );

  /*
    Tommie's second summary:
    Name: Tommie (age: 25)
    Innate traits: anxious, likes design, talkative
    Tommie remembers his dog, is tired from driving, sees a new home with neighbors who have a cat, is aware of the noisy road at night, is hungry, and tries to get some rest.
  */

  const interviewAgent = async (
    agent: GenerativeAgent,
    message: string
  ): Promise<string> => {
    // Simple wrapper helping the user interact with the agent
    const newMessage = `${userName} says ${message}`;
    const response = await agent.generateDialogueResponse(newMessage);
    return response[1];
  };

  // Let's have Tommie start going through a day in his life.
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

  // Let's send Tommie on his way. We'll check in on his summary every few observations to watch him evolve
  for (let i = 0; i < observations.length; i += 1) {
    const observation = observations[i];
    const [, reaction] = await tommie.generateReaction(observation);
    console.log("\x1b[32m", observation, "\x1b[0m", reaction);
    if ((i + 1) % 20 === 0) {
      console.log("*".repeat(40));
      console.log(
        "\x1b[34m",
        `After ${
          i + 1
        } observations, Tommie's summary is:\n${await tommie.getSummary({
          forceRefresh: true,
        })}`,
        "\x1b[0m"
      );
      console.log("*".repeat(40));
    }
  }

  /*
    Tommie wakes up to the sound of a noisy construction site outside his window.  Tommie REACT: Tommie groans in frustration and covers his ears with his pillow.
    Tommie gets out of bed and heads to the kitchen to make himself some coffee.  Tommie REACT: Tommie rubs his tired eyes before heading to the kitchen to make himself some coffee.
    Tommie realizes he forgot to buy coffee filters and starts rummaging through his moving boxes to find some.  Tommie REACT: Tommie groans and looks through his moving boxes in search of coffee filters.
    Tommie finally finds the filters and makes himself a cup of coffee.  Tommie REACT: Tommie sighs in relief and prepares himself a much-needed cup of coffee.
    The coffee tastes bitter, and Tommie regrets not buying a better brand.  Tommie REACT: Tommie frowns in disappointment as he takes a sip of the bitter coffee.
    Tommie checks his email and sees that he has no job offers yet.  Tommie REACT: Tommie sighs in disappointment before pushing himself away from the computer with a discouraged look on his face.
    Tommie spends some time updating his resume and cover letter.  Tommie REACT: Tommie takes a deep breath and stares at the computer screen as he updates his resume and cover letter.
    Tommie heads out to explore the city and look for job openings.  Tommie REACT: Tommie takes a deep breath and steps out into the city, ready to find the perfect job opportunity.
    Tommie sees a sign for a job fair and decides to attend.  Tommie REACT: Tommie takes a deep breath and marches towards the job fair, determination in his eyes.
    The line to get in is long, and Tommie has to wait for an hour.  Tommie REACT: Tommie groans in frustration as he notices the long line.
    Tommie meets several potential employers at the job fair but doesn't receive any offers.  Tommie REACT: Tommie's face falls as he listens to each potential employer's explanation as to why they can't hire him.
    Tommie leaves the job fair feeling disappointed.  Tommie REACT: Tommie's face falls as he walks away from the job fair, disappointment evident in his expression.
    Tommie stops by a local diner to grab some lunch.  Tommie REACT: Tommie smiles as he remembers Bruno as he walks into the diner, feeling both a sense of nostalgia and excitement.
    The service is slow, and Tommie has to wait for 30 minutes to get his food.  Tommie REACT: Tommie sighs in frustration and taps his fingers on the table, growing increasingly impatient.
    Tommie overhears a conversation at the next table about a job opening.  Tommie REACT: Tommie leans in closer, eager to hear the conversation.
    Tommie asks the diners about the job opening and gets some information about the company.  Tommie REACT: Tommie eagerly listens to the diner's description of the company, feeling hopeful about the job opportunity.
    Tommie decides to apply for the job and sends his resume and cover letter.  Tommie REACT: Tommie confidently sends in his resume and cover letter, determined to get the job.
    Tommie continues his search for job openings and drops off his resume at several local businesses.  Tommie REACT: Tommie confidently drops his resume off at the various businesses, determined to find a job.
    Tommie takes a break from his job search to go for a walk in a nearby park.  Tommie REACT: Tommie takes a deep breath of the fresh air and smiles in appreciation as he strolls through the park.
    A dog approaches and licks Tommie's feet, and he pets it for a few minutes.  Tommie REACT: Tommie smiles in surprise as he pets the dog, feeling a sense of comfort and nostalgia.
    ****************************************
    After 20 observations, Tommie's summary is:
    Name: Tommie (age: 25)
    Innate traits: anxious, likes design, talkative
    Tommie is a determined and resilient individual who remembers his dog from when he was a kid. Despite feeling tired from driving, he has the courage to explore the city, looking for job openings. He persists in updating his resume and cover letter in the pursuit of finding the perfect job opportunity, even attending job fairs when necessary, and is disappointed when he's not offered a job.
    ****************************************
    Tommie sees a group of people playing frisbee and decides to join in.  Tommie REACT: Tommie smiles and approaches the group, eager to take part in the game.
    Tommie has fun playing frisbee but gets hit in the face with the frisbee and hurts his nose.  Tommie REACT: Tommie grimaces in pain and raises his hand to his nose, checking to see if it's bleeding.
    Tommie goes back to his apartment to rest for a bit.  Tommie REACT: Tommie yawns and trudges back to his apartment, feeling exhausted from his busy day.
    A raccoon tore open the trash bag outside his apartment, and the garbage is all over the floor.  Tommie REACT: Tommie shakes his head in annoyance as he surveys the mess.
    Tommie starts to feel frustrated with his job search.  Tommie REACT: Tommie sighs in frustration and shakes his head, feeling discouraged from his lack of progress.
    Tommie calls his best friend to vent about his struggles.  Tommie REACT: Tommie runs his hands through his hair and sighs heavily, overwhelmed by his job search.
    Tommie's friend offers some words of encouragement and tells him to keep trying.  Tommie REACT: Tommie gives his friend a grateful smile, feeling comforted by the words of encouragement.
    Tommie feels slightly better after talking to his friend.  Tommie REACT: Tommie gives a small smile of appreciation to his friend, feeling grateful for the words of encouragement.
  */

  // Interview after the day
  console.log(
    await interviewAgent(tommie, "Tell me about how your day has been going")
  );
  /*
    Tommie said "My day has been pretty hectic. I've been driving around looking for job openings, attending job fairs, and updating my resume and cover letter. It's been really exhausting, but I'm determined to find the perfect job for me."
  */
  console.log(await interviewAgent(tommie, "How do you feel about coffee?"));
  /*
    Tommie said "I actually love coffee - it's one of my favorite things. I try to drink it every day, especially when I'm stressed from job searching."
  */
  console.log(
    await interviewAgent(tommie, "Tell me about your childhood dog!")
  );
  /*
    Tommie said "My childhood dog was named Bruno. He was an adorable black Labrador Retriever who was always full of energy. Every time I came home he'd be so excited to see me, it was like he never stopped smiling. He was always ready for adventure and he was always my shadow. I miss him every day."
  */

  console.log(
    "Tommie's second summary:\n",
    await tommie.getSummary({ forceRefresh: true })
  );
  /*
    Tommie's second summary:
    Name: Tommie (age: 25)
    Innate traits: anxious, likes design, talkative
    Tommie is a hardworking individual who is looking for new opportunities. Despite feeling tired, he is determined to find the perfect job. He remembers his dog from when he was a kid, is hungry, and is frustrated at times. He shows resilience when searching for his coffee filters, disappointment when checking his email and finding no job offers, and determination when attending the job fair.
  */

  // Let’s add a second character to have a conversation with Tommie. Feel free to configure different traits.
  const evesMemory: GenerativeAgentMemory = new GenerativeAgentMemory(
    llm,
    await createNewMemoryRetriever(),
    {
      verbose: false,
      reflectionThreshold: 5,
    }
  );

  const eve: GenerativeAgent = new GenerativeAgent(llm, evesMemory, {
    name: "Eve",
    age: 34,
    traits: "curious, helpful",
    status:
      "just started her new job as a career counselor last week and received her first assignment, a client named Tommie.",
    // dailySummaries: [
    //   "Eve started her new job as a career counselor last week and received her first assignment, a client named Tommie."
    // ]
  });

  const eveObservations = [
    "Eve overhears her colleague say something about a new client being hard to work with",
    "Eve wakes up and hears the alarm",
    "Eve eats a boal of porridge",
    "Eve helps a coworker on a task",
    "Eve plays tennis with her friend Xu before going to work",
    "Eve overhears her colleague say something about Tommie being hard to work with",
  ];

  for (const observation of eveObservations) {
    await eve.addMemory(observation, new Date());
  }

  const eveInitialSummary: string = await eve.getSummary({
    forceRefresh: true,
  });
  console.log("Eve's initial summary\n", eveInitialSummary);
  /*
    Eve's initial summary
    Name: Eve (age: 34)
    Innate traits: curious, helpful
    Eve is an attentive listener, helpful colleague, and sociable friend who enjoys playing tennis.
  */

  // Let’s “Interview” Eve before she speaks with Tommie.
  console.log(await interviewAgent(eve, "How are you feeling about today?"));
  /*
    Eve said "I'm feeling a bit anxious about meeting my new client, but I'm sure it will be fine! How about you?".
  */
  console.log(await interviewAgent(eve, "What do you know about Tommie?"));
  /*
    Eve said "I know that Tommie is a recent college graduate who's been struggling to find a job. I'm looking forward to figuring out how I can help him move forward."
  */
  console.log(
    await interviewAgent(
      eve,
      "Tommie is looking to find a job. What are are some things you'd like to ask him?"
    )
  );
  /*
    Eve said: "I'd really like to get to know more about Tommie's professional background and experience, and why he is looking for a job. And I'd also like to know more about his strengths and passions and what kind of work he would be best suited for. That way I can help him find the right job to fit his needs."
  */

  // Generative agents are much more complex when they interact with a virtual environment or with each other.
  // Below, we run a simple conversation between Tommie and Eve.
  const runConversation = async (
    agents: GenerativeAgent[],
    initialObservation: string
  ): Promise<void> => {
    // Starts the conversation bewteen two agents
    let [, observation] = await agents[1].generateReaction(initialObservation);
    console.log("Initial reply:", observation);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let breakDialogue = false;
      for (const agent of agents) {
        const [stayInDialogue, agentObservation] =
          await agent.generateDialogueResponse(observation);
        console.log("Next reply:", agentObservation);
        observation = agentObservation;
        if (!stayInDialogue) {
          breakDialogue = true;
        }
      }

      if (breakDialogue) {
        break;
      }
    }
  };

  const agents: GenerativeAgent[] = [tommie, eve];
  await runConversation(
    agents,
    "Tommie said: Hi, Eve. Thanks for agreeing to meet with me today. I have a bunch of questions and am not sure where to start. Maybe you could first share about your experience?"
  );

  /*
    Initial reply: Eve said "Of course, Tommie. I'd be happy to share about my experience. What specific questions do you have?"
    Next reply: Tommie said "Thank you, Eve. I'm curious about what strategies you used in your own job search. Did you have any specific tactics that helped you stand out to employers?"
    Next reply: Eve said "Sure, Tommie. I found that networking and reaching out to professionals in my field was really helpful. I also made sure to tailor my resume and cover letter to each job I applied to. Do you have any specific questions about those strategies?"
    Next reply: Tommie said "Thank you, Eve. That's really helpful advice. Did you have any specific ways of networking that worked well for you?"
    Next reply: Eve said "Sure, Tommie. I found that attending industry events and connecting with professionals on LinkedIn were both great ways to network. Do you have any specific questions about those tactics?"
    Next reply: Tommie said "That's really helpful, thank you for sharing. Did you find that you were able to make meaningful connections through LinkedIn?"
    Next reply: Eve said "Yes, definitely. I was able to connect with several professionals in my field and even landed a job through a LinkedIn connection. Have you had any luck with networking on LinkedIn?"
    Next reply: Tommie said "That's really impressive! I haven't had much luck yet, but I'll definitely keep trying. Thank you for the advice, Eve."
    Next reply: Eve said "Glad I could help, Tommie. Is there anything else you want to know?"
    Next reply: Tommie said "Thanks again, Eve. I really appreciate your advice and I'll definitely put it into practice. Have a great day!"
    Next reply: Eve said "You're welcome, Tommie! Don't hesitate to reach out if you have any more questions. Have a great day too!"
  */

  // Since the generative agents retain their memories from the day, we can ask them about their plans, conversations, and other memories.
  const tommieSummary: string = await tommie.getSummary({
    forceRefresh: true,
  });
  console.log("Tommie's third and final summary\n", tommieSummary);
  /*
    Tommie's third and final summary
    Name: Tommie (age: 25)
    Innate traits: anxious, likes design, talkative
    Tommie is a determined individual, who demonstrates resilience in the face of disappointment. He is also a nostalgic person, remembering fondly his childhood pet, Bruno. He is resourceful, searching through his moving boxes to find what he needs, and takes initiative to attend job fairs to look for job openings.
  */

  const eveSummary: string = await eve.getSummary({ forceRefresh: true });
  console.log("Eve's final summary\n", eveSummary);
  /*
    Eve's final summary
    Name: Eve (age: 34)
    Innate traits: curious, helpful
    Eve is a helpful and encouraging colleague who actively listens to her colleagues and offers advice on how to move forward. She is willing to take time to understand her clients and their goals, and is committed to helping them succeed.
  */

  const interviewOne: string = await interviewAgent(
    tommie,
    "How was your conversation with Eve?"
  );
  console.log("USER: How was your conversation with Eve?\n");
  console.log(interviewOne);
  /*
    Tommie said "It was great. She was really helpful and knowledgeable. I'm thankful that she took the time to answer all my questions."
  */

  const interviewTwo: string = await interviewAgent(
    eve,
    "How was your conversation with Tommie?"
  );
  console.log("USER: How was your conversation with Tommie?\n");
  console.log(interviewTwo);
  /*
    Eve said "The conversation went very well. We discussed his goals and career aspirations, what kind of job he is looking for, and his experience and qualifications. I'm confident I can help him find the right job."
  */

  const interviewThree: string = await interviewAgent(
    eve,
    "What do you wish you would have said to Tommie?"
  );
  console.log("USER: What do you wish you would have said to Tommie?\n");
  console.log(interviewThree);
  /*
    Eve said "It's ok if you don't have all the answers yet. Let's take some time to learn more about your experience and qualifications, so I can help you find a job that fits your goals."
  */

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
    throw error;
  }
};

await runSimulation();
