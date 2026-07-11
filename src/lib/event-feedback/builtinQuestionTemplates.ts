import type {
  CheckboxFeedbackQuestion,
  EventFeedbackQuestion,
  LikertFeedbackQuestion,
  TextFeedbackQuestion
} from "@/lib/event-feedback/feedbackQuestions";

export type FeedbackQuestionTemplateInput =
  | Omit<TextFeedbackQuestion, "key">
  | Omit<LikertFeedbackQuestion, "key">
  | Omit<CheckboxFeedbackQuestion, "key">;

export type FeedbackQuestionTemplatePack = {
  id: string;
  name: string;
  description: string;
  questions: FeedbackQuestionTemplateInput[];
};

export const BUILTIN_FEEDBACK_QUESTION_TEMPLATES: FeedbackQuestionTemplatePack[] = [
  {
    id: "improvement_focus",
    name: "Find & fix issues",
    description:
      "Drill down on friction, gaps, and what did not work — ideal after mixed or low satisfaction scores.",
    questions: [
      { type: "text", prompt: "What was the biggest challenge or frustration during the event?" },
      { type: "text", prompt: "Which part of the program felt confusing or could be improved?" },
      { type: "text", prompt: "What is one thing we should change before the next edition?" }
    ]
  },
  {
    id: "highlights_focus",
    name: "Celebrate highlights",
    description:
      "Capture what guests loved and where they felt most engaged — ideal for promoters and success stories.",
    questions: [
      { type: "text", prompt: "What was the highlight or most memorable moment for you?" },
      { type: "text", prompt: "Which session, speaker, or activity excited you the most?" },
      { type: "text", prompt: "What would you tell a colleague about this event?" }
    ]
  },
  {
    id: "satisfaction_pulse",
    name: "Satisfaction pulse",
    description:
      "A mix of measurable satisfaction (Likert scale) and qualitative “why” questions — ideal for post-event analysis.",
    questions: [
      {
        type: "likert",
        scaleId: "quality",
        prompt: "How would you rate the quality of sessions and content?"
      },
      {
        type: "likert",
        scaleId: "likelihood",
        prompt: "How likely are you to recommend this event to a colleague?"
      },
      {
        type: "checkbox",
        prompt: "What went well for you? (tick all that apply)",
        options: [
          "Registration & check-in",
          "Sessions & speakers",
          "Networking",
          "Food & refreshments",
          "Venue & facilities"
        ],
        allowMultiple: true
      },
      {
        type: "text",
        prompt: "What is the main reason for your rating?"
      },
      {
        type: "text",
        prompt: "What should we improve next time?"
      }
    ]
  }
];

export function cloneTemplateQuestions(
  questions: FeedbackQuestionTemplateInput[]
): EventFeedbackQuestion[] {
  return questions.map((q) => ({
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q_${Math.random().toString(36).slice(2, 10)}`,
    ...q
  }));
}
