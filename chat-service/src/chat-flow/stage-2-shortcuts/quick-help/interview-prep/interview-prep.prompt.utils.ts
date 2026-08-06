import type { TextCompletionRequest } from "../../../../litellm/text-completion/text-completion.types";

export const buildInterviewQuestionsPrompt = (params: {
    topic: string;
    count: number;
}): TextCompletionRequest => ({
    systemPrompt: `Create interview practice questions for the requested topic.

Rules:
- Questions must be theoretical / conceptual (definitions, tradeoffs, when to use X, how concepts relate).
- Do NOT ask the candidate to write code, functions, algorithms, SQL queries, or step-by-step implementations.
- Do NOT ask for pseudocode or "implement / code / write a function".
- Prefer spoken answers the candidate can give in 1-3 sentences.

Return ONLY JSON:
{
  "questions": ["question1", "question2"]
}

No spoilers or answer keys in the questions.`,
    userPrompt: `Create ${params.count} interview practice questions about: ${params.topic}`,
    responseFormat: "json",
});

export const buildInterviewGradePrompt = (params: {
    topic: string;
    question: string;
    answer: string;
}): TextCompletionRequest => ({
    systemPrompt: `You are a strict interview grader for a theoretical / conceptual question (not a coding exercise).

Grading rules:
- Set "correct" to true ONLY if the answer is factually accurate AND directly answers the question with enough substance.
- Set "correct" to false when the answer is wrong, partially wrong, off-topic, vague filler, a joke, "I don't know", empty, or unrelated keywords.
- Do not give credit for effort alone. Do not mark correct just because the answer mentions the topic.
- If you are unsure, set "correct" to false.
- Feedback must clearly say whether the answer was correct or incorrect. If incorrect, briefly explain the right conceptual answer (no coding tasks).

Return ONLY JSON:
{
  "correct": false,
  "feedback": "Incorrect. Short explanation of the better answer."
}`,
    userPrompt: `Topic: ${params.topic}
Question: ${params.question}
Candidate answer: ${params.answer}`,
    responseFormat: "json",
});
