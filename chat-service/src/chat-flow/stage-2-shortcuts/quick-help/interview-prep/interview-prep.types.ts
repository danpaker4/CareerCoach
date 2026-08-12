export type InterviewQuestionsLlmResult = {
    questions: string[];
};

export type InterviewDifficulty = "easy" | "medium" | "hard";

export type InterviewFocusOption = {
    id: string;
    title: string;
    description: string;
};

export type InterviewTopicPlanLlmResult =
    | { action: "start_practice" }
    | { action: "offer_options"; introduction: string; options: [InterviewFocusOption, InterviewFocusOption] }
    | { action: "invalid" };

export type InterviewFocusSelectionLlmResult =
    | { kind: "selected"; selectedOptionId: string }
    | { kind: "both" }
    | { kind: "declined" }
    | { kind: "ambiguous" };

export type InterviewGradeOutcome = "correct" | "partially_correct" | "incorrect" | "needs_teaching";

export type InterviewGradeLlmResult = {
    outcome: InterviewGradeOutcome;
    feedback: string;
    followUpQuestions: string[];
    modelAnswer: string;
    improvementTip: string;
    teachingExplanation: string;
    teachingExample: string;
    understandingCheck: string;
};

export type InterviewTeachingStatus = "understood" | "needs_reteaching" | "asks_question";

export type InterviewTeachingLlmResult = {
    status: InterviewTeachingStatus;
    response: string;
    explanation: string;
    example: string;
    understandingCheck: string;
};
