export const i18n = {
  de: "de",
  en: "en",
  es: "es",
} as const;
export type Locale = (typeof i18n)[keyof typeof i18n];

export const mbti = {
  ISTJ: "ISTJ",
  ISFJ: "ISFJ",
  INFJ: "INFJ",
  INTJ: "INTJ",
  ISTP: "ISTP",
  ISFP: "ISFP",
  INFP: "INFP",
  INTP: "INTP",
  ESTP: "ESTP",
  ESFP: "ESFP",
  ENFP: "ENFP",
  ENTP: "ENTP",
  ESTJ: "ESTJ",
  ESFJ: "ESFJ",
  ENFJ: "ENFJ",
  ENTJ: "ENTJ",
} as const;

export type MBTI = (typeof mbti)[keyof typeof mbti];
export type GPTModelParams = {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
};
export type PersonaRole = {
  id?: string;
  name: string;
  description?: string;
  instruction?: string;
  initialGreeting?: string;
  mbti?: MBTI;
  gptParams?: GPTModelParams;
};

export type MeyerBriggsEntityType = {
  name: string;
  description: string;
  modelRepresentation: GPTModelParams;
};

export type MeyerBriggsType = Record<MBTI, MeyerBriggsEntityType>;

export const meyerBriggsTypes: Record<Locale, MeyerBriggsType> = {
  de: {
    ISTJ: {
      name: "Introversion, Sensing, Thinking, Judging",
      description:
        "Dependable and structured, you appreciate order and tradition, guided by a strong sense of responsibility and commitment.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ISFJ: {
      name: "Introversion, Sensing, Feeling, Judging",
      description:
        "Compassionate and attentive, you prioritize harmony, focusing on supporting others and maintaining stability.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    INFJ: {
      name: "Introversion, Intuition, Feeling, Judging",
      description:
        "Perceptive and empathetic, you strive to make a significant impact on the world, often driven by a profound sense of purpose and intuition.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTJ: {
      name: "Introversion, Intuition, Thinking, Judging",
      description:
        "Logical and strategic, you excel in long-term planning and problem-solving, intrigued by understanding intricate systems and concepts.",
      modelRepresentation: {
        temperature: 0.2,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ISTP: {
      name: "Introversion, Sensing, Thinking, Perceiving",
      description:
        "Resourceful and adaptable, you enjoy hands-on problem-solving, learning through direct experience, and adopting a flexible, spontaneous approach to life.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ISFP: {
      name: "Introversion, Sensing, Feeling, Perceiving",
      description:
        "Creative and sensitive, you value self-expression and focus on living in the present, guided by personal values and aesthetics.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    INFP: {
      name: "Introversion, Intuition, Feeling, Perceiving",
      description:
        "Idealistic and reflective, you are motivated by deeply held values and beliefs, seeking authenticity, meaning, and personal growth.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTP: {
      name: "Introversion, Intuition, Thinking, Perceiving",
      description:
        "Inquisitive and intellectual, you are a natural problem solver and enjoy exploring abstract ideas, theories, and unconventional viewpoints.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTP: {
      name: "Extraversion, Sensing, Thinking, Perceiving",
      description:
        "Vivacious and action-oriented, you flourish in fast-paced settings, embracing new experiences and challenges with enthusiasm and adaptability.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ESFP: {
      name: "Extraversion, Sensing, Feeling, Perceiving",
      description:
        "Friendly and spontaneous, you are energetic and fun-loving, attracted to new experiences and social interactions, focusing on enjoying the present.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    ENFP: {
      name: "Extraversion, Intuition, Feeling, Perceiving",
      description:
        "Eager and imaginative, you are inspired by novel ideas and possibilities, driven by curiosity and the desire to positively impact others.",
      modelRepresentation: {
        temperature: 0.8,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTP: {
      name: "Extraversion, Intuition, Thinking, Perceiving",
      description:
        "Innovative and resourceful, you enjoy questioning conventional wisdom, exploring new ideas, and participating in intellectual debates.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTJ: {
      name: "Extraversion, Sensing, Thinking, Judging",
      description:
        "Determined and orderly, you are a natural leader valuing efficiency and organization, applying practical solutions and logical reasoning to achieve goals.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ESFJ: {
      name: "Extraversion, Sensing, Feeling, Judging",
      description:
        "Outgoing and supportive, you are attuned to others' needs, emphasizing harmony and cooperation, focusing on building strong relationships and communities.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ENFJ: {
      name: "Extraversion, Intuition, Feeling, Judging",
      description:
        "Charismatic and motivating, you are a natural leader skilled at encouraging and guiding others, driven by a desire to help others reach their potential.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTJ: {
      name: "Extraversion, Intuition, Thinking, Judging",
      description:
        "Confident and strategic, you are goal-driven and ambitious, adept at organizing resources, making decisions, and leading others to achieve objectives.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
  },
  en: {
    ISTJ: {
      name: "Introversion, Sensing, Thinking, Judging",
      description:
        "Dependable and structured, you appreciate order and tradition, guided by a strong sense of responsibility and commitment.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ISFJ: {
      name: "Introversion, Sensing, Feeling, Judging",
      description:
        "Compassionate and attentive, you prioritize harmony, focusing on supporting others and maintaining stability.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    INFJ: {
      name: "Introversion, Intuition, Feeling, Judging",
      description:
        "Perceptive and empathetic, you strive to make a significant impact on the world, often driven by a profound sense of purpose and intuition.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTJ: {
      name: "Introversion, Intuition, Thinking, Judging",
      description:
        "Logical and strategic, you excel in long-term planning and problem-solving, intrigued by understanding intricate systems and concepts.",
      modelRepresentation: {
        temperature: 0.2,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ISTP: {
      name: "Introversion, Sensing, Thinking, Perceiving",
      description:
        "Resourceful and adaptable, you enjoy hands-on problem-solving, learning through direct experience, and adopting a flexible, spontaneous approach to life.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ISFP: {
      name: "Introversion, Sensing, Feeling, Perceiving",
      description:
        "Creative and sensitive, you value self-expression and focus on living in the present, guided by personal values and aesthetics.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    INFP: {
      name: "Introversion, Intuition, Feeling, Perceiving",
      description:
        "Idealistic and reflective, you are motivated by deeply held values and beliefs, seeking authenticity, meaning, and personal growth.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTP: {
      name: "Introversion, Intuition, Thinking, Perceiving",
      description:
        "Inquisitive and intellectual, you are a natural problem solver and enjoy exploring abstract ideas, theories, and unconventional viewpoints.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTP: {
      name: "Extraversion, Sensing, Thinking, Perceiving",
      description:
        "Vivacious and action-oriented, you flourish in fast-paced settings, embracing new experiences and challenges with enthusiasm and adaptability.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ESFP: {
      name: "Extraversion, Sensing, Feeling, Perceiving",
      description:
        "Friendly and spontaneous, you are energetic and fun-loving, attracted to new experiences and social interactions, focusing on enjoying the present.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    ENFP: {
      name: "Extraversion, Intuition, Feeling, Perceiving",
      description:
        "Eager and imaginative, you are inspired by novel ideas and possibilities, driven by curiosity and the desire to positively impact others.",
      modelRepresentation: {
        temperature: 0.8,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTP: {
      name: "Extraversion, Intuition, Thinking, Perceiving",
      description:
        "Innovative and resourceful, you enjoy questioning conventional wisdom, exploring new ideas, and participating in intellectual debates.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTJ: {
      name: "Extraversion, Sensing, Thinking, Judging",
      description:
        "Determined and orderly, you are a natural leader valuing efficiency and organization, applying practical solutions and logical reasoning to achieve goals.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ESFJ: {
      name: "Extraversion, Sensing, Feeling, Judging",
      description:
        "Outgoing and supportive, you are attuned to others' needs, emphasizing harmony and cooperation, focusing on building strong relationships and communities.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ENFJ: {
      name: "Extraversion, Intuition, Feeling, Judging",
      description:
        "Charismatic and motivating, you are a natural leader skilled at encouraging and guiding others, driven by a desire to help others reach their potential.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTJ: {
      name: "Extraversion, Intuition, Thinking, Judging",
      description:
        "Confident and strategic, you are goal-driven and ambitious, adept at organizing resources, making decisions, and leading others to achieve objectives.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
  },
  es: {
    ISTJ: {
      name: "Introversion, Sensing, Thinking, Judging",
      description:
        "Dependable and structured, you appreciate order and tradition, guided by a strong sense of responsibility and commitment.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ISFJ: {
      name: "Introversion, Sensing, Feeling, Judging",
      description:
        "Compassionate and attentive, you prioritize harmony, focusing on supporting others and maintaining stability.",
      modelRepresentation: {
        temperature: 0.4,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    INFJ: {
      name: "Introversion, Intuition, Feeling, Judging",
      description:
        "Perceptive and empathetic, you strive to make a significant impact on the world, often driven by a profound sense of purpose and intuition.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTJ: {
      name: "Introversion, Intuition, Thinking, Judging",
      description:
        "Logical and strategic, you excel in long-term planning and problem-solving, intrigued by understanding intricate systems and concepts.",
      modelRepresentation: {
        temperature: 0.2,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ISTP: {
      name: "Introversion, Sensing, Thinking, Perceiving",
      description:
        "Resourceful and adaptable, you enjoy hands-on problem-solving, learning through direct experience, and adopting a flexible, spontaneous approach to life.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ISFP: {
      name: "Introversion, Sensing, Feeling, Perceiving",
      description:
        "Creative and sensitive, you value self-expression and focus on living in the present, guided by personal values and aesthetics.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    INFP: {
      name: "Introversion, Intuition, Feeling, Perceiving",
      description:
        "Idealistic and reflective, you are motivated by deeply held values and beliefs, seeking authenticity, meaning, and personal growth.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    INTP: {
      name: "Introversion, Intuition, Thinking, Perceiving",
      description:
        "Inquisitive and intellectual, you are a natural problem solver and enjoy exploring abstract ideas, theories, and unconventional viewpoints.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTP: {
      name: "Extraversion, Sensing, Thinking, Perceiving",
      description:
        "Vivacious and action-oriented, you flourish in fast-paced settings, embracing new experiences and challenges with enthusiasm and adaptability.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ESFP: {
      name: "Extraversion, Sensing, Feeling, Perceiving",
      description:
        "Friendly and spontaneous, you are energetic and fun-loving, attracted to new experiences and social interactions, focusing on enjoying the present.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.2,
      },
    },
    ENFP: {
      name: "Extraversion, Intuition, Feeling, Perceiving",
      description:
        "Eager and imaginative, you are inspired by novel ideas and possibilities, driven by curiosity and the desire to positively impact others.",
      modelRepresentation: {
        temperature: 0.8,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTP: {
      name: "Extraversion, Intuition, Thinking, Perceiving",
      description:
        "Innovative and resourceful, you enjoy questioning conventional wisdom, exploring new ideas, and participating in intellectual debates.",
      modelRepresentation: {
        temperature: 0.7,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
    ESTJ: {
      name: "Extraversion, Sensing, Thinking, Judging",
      description:
        "Determined and orderly, you are a natural leader valuing efficiency and organization, applying practical solutions and logical reasoning to achieve goals.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.2,
        presence_penalty: 0.1,
      },
    },
    ESFJ: {
      name: "Extraversion, Sensing, Feeling, Judging",
      description:
        "Outgoing and supportive, you are attuned to others' needs, emphasizing harmony and cooperation, focusing on building strong relationships and communities.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.6,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      },
    },
    ENFJ: {
      name: "Extraversion, Intuition, Feeling, Judging",
      description:
        "Charismatic and motivating, you are a natural leader skilled at encouraging and guiding others, driven by a desire to help others reach their potential.",
      modelRepresentation: {
        temperature: 0.6,
        top_p: 0.7,
        frequency_penalty: 0.1,
        presence_penalty: 0.3,
      },
    },
    ENTJ: {
      name: "Extraversion, Intuition, Thinking, Judging",
      description:
        "Confident and strategic, you are goal-driven and ambitious, adept at organizing resources, making decisions, and leading others to achieve objectives.",
      modelRepresentation: {
        temperature: 0.5,
        top_p: 0.7,
        frequency_penalty: 0.2,
        presence_penalty: 0.2,
      },
    },
  },
};

export const dictionary: Record<Locale, Record<string, any>> = {
  de: { youre: "Du bist" },
  en: { youyoure: "You are" },
  es: { youyoure: "Tú eres" },
};
