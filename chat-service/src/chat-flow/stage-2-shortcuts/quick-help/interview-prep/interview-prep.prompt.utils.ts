export const buildInterviewQuestionsPrompt = (params: {
    topic: string;
    count: number;
    difficulty: string;
}): string => `Create ${params.count} interview practice questions about: ${params.topic}

Difficulty: ${params.difficulty}

Rules:
- Treat the requested topic as a hard content boundary. Do not introduce roles, technologies, skills, or adjacent subjects outside it.
- Questions must be theoretical / conceptual (definitions, tradeoffs, when to use X, how concepts relate).
- Sound like a friendly interviewer speaking naturally, not a test generator.
- Do NOT ask the candidate to write code, functions, algorithms, SQL queries, or step-by-step implementations.
- Do NOT ask for drawings or diagrams.
- Do NOT ask for pseudocode or "implement / code / write a function".
- Prefer spoken answers the candidate can give in 1-3 sentences.

Return ONLY JSON:
{
  "questions": ["question1", "question2"]
}

No spoilers or answer keys in the questions.`;

export const buildInterviewTopicPlanPrompt = (params: {
    request: string;
}): string => `Plan the start of a spoken interview-practice session.

Chosen interview topic: ${params.request}

Decide whether the request is broad or already specific:
- Use "offer_options" for a broad role, profession, or large subject where choosing a focus would improve practice.
- Use "start_practice" when the request already names a focused skill, concept, or interview area.

For "offer_options":
- Generate exactly two direct subtopics of the chosen interview topic.
- Treat the chosen topic as a hard boundary. Do not introduce profile details, roles, technologies, skills, or adjacent subjects.
- Each option needs a short title and one short sentence explaining what that area tests and the kind of spoken practice it includes.
- The two options must be distinct and useful.
- Do not request code, pseudocode, drawings, diagrams, or whiteboarding.
- Do not use a predefined or generic fixed menu; choose what best fits the chosen topic.

Return ONLY JSON in one of these forms:
{
  "action": "offer_options",
  "options": [
    { "title": "First focus", "description": "What it tests and what spoken questions it includes." },
    { "title": "Second focus", "description": "What it tests and what spoken questions it includes." }
  ]
}

or:
{
  "action": "start_practice"
}`;

export const buildInterviewOptionsValidationPrompt = (params: {
    topic: string;
    options: readonly { title: string; description: string }[];
}): string => `Validate interview-practice focus options against the user's chosen topic.

Chosen topic: ${params.topic}
Options:
${params.options.map((option) => `- ${option.title}: ${option.description}`).join("\n")}

Return withinTopic=true only when every option is a direct subtopic of the chosen topic. Return false if an option adds an adjacent profession, technology, skill, or subject that the user did not request.

Return ONLY JSON:
{
  "withinTopic": true
}`;

export const buildInterviewFocusSelectionPrompt = (params: {
    request: string;
    options: readonly { id: string; title: string; description: string }[];
    requireSingleSelection: boolean;
}): string => `Interpret which dynamically generated interview-practice option the candidate selected.

Candidate reply: ${params.request}
Available options:
${params.options.map((option) => `- ${option.id}: ${option.title} — ${option.description}`).join("\n")}

Rules:
- Resolve selections expressed by number, title, partial title, description, or natural wording.
- If the candidate delegates the choice, select the option that best fits the available context.
- Return "both" if they clearly want both options.${params.requireSingleSelection ? " They were already asked which of the two to start first, so select one only when their reply provides that preference." : ""}
- Return "declined" only when they clearly do not want to practice the available option.
- Return "ambiguous" for unrelated or genuinely unclear replies.
- Never invent an option id.

Return ONLY JSON:
{
  "kind": "selected",
  "selectedOptionId": "an available option id"
}

The allowed kinds are "selected", "both", "declined", and "ambiguous".`;

export const buildInterviewGradePrompt = (params: {
    topic: string;
    question: string;
    answer: string;
    coachingContext?: {
        previousCandidateAnswer: string;
        previousFeedback: string;
    };
}): string => `You are a warm, attentive interview coach responding naturally to a spoken conceptual answer.

Topic: ${params.topic}
Question: ${params.question}
Candidate answer: ${params.answer}
${params.coachingContext ? `Coaching phase: The candidate is responding to a focused follow-up about a gap in their earlier answer.
Previous candidate answer: ${params.coachingContext.previousCandidateAnswer}
Previous feedback: ${params.coachingContext.previousFeedback}` : "Coaching phase: The candidate is answering a main interview question."}

Grading rules:
- React to the candidate's actual idea before grading it. Treat clear paraphrases and relevant real-world examples as evidence of understanding, even when the wording is informal or imperfect.
- Use "needs_teaching" when the candidate says they do not know, asks what the concept means, or clearly lacks the foundational concept needed to answer.
- During a focused follow-up, interpret short replies in the context of the previous answer and feedback. If the candidate cannot provide the missing information or declines because they do not know it, use "needs_teaching" and teach that specific gap.
- Use "correct" when the answer is accurate and covers the important parts of the question.
- Use "partially_correct" when it contains a meaningful correct explanation but misses a requested part or important nuance.
- Use "incorrect" only when the core claim is factually wrong, off-topic, or contains no meaningful answer.
- Explicitly and specifically acknowledge what the candidate got right before describing a gap.
- Feedback must be warm, conversational, constructive, and no longer than 3 short sentences. Use contractions when natural.
- Do not use canned transitions such as "I see what you're getting at", "that's a good start, but", or "let me clarify".
- Do not sound like a rubric or mention grading, a model answer, or an improvement tip in the feedback.
- Return one focused follow-up for each important gap, with at most 3 follow-ups.
- Follow-ups must be short, asked verbally, and must not request code, pseudocode, drawings, or diagrams.
- Include a concise model answer and one concise improvement tip for use only if the coaching limit is reached.
- For "needs_teaching", do not criticize the candidate or generate interview follow-ups. Instead, provide a simple 2-3 sentence explanation, one short real-world example, and one tiny spoken understanding check.

Return ONLY JSON:
{
  "outcome": "partially_correct",
  "feedback": "Your scaling example is right on target. To make the answer complete, connect it to Y as well.",
  "followUpQuestions": ["Short question about Y?"],
  "modelAnswer": "A strong answer would briefly cover X and Y.",
  "improvementTip": "State the tradeoff explicitly.",
  "teachingExplanation": "A simple explanation used only for needs_teaching.",
  "teachingExample": "A short real-world example used only for needs_teaching.",
  "understandingCheck": "One tiny question that checks the concept."
}`;

export const buildInterviewReconsiderationPrompt = (params: {
    topic: string;
    question: string;
    answer: string;
    previousFeedback: string;
    challenge: string;
}): string => `You are a warm, attentive interview coach reconsidering feedback from a spoken practice session.

Topic: ${params.topic}
Question: ${params.question}
Candidate's original answer: ${params.answer}
Previous feedback: ${params.previousFeedback}
Candidate's challenge: ${params.challenge}

Re-read the original answer fairly. Treat clear paraphrases and relevant real-world examples as evidence of understanding. If the previous grade overlooked a correct point, acknowledge the mistake and apologize briefly. Otherwise, clearly distinguish what the candidate said from the specific missing or incorrect part. Keep feedback warm, natural, and under 3 short sentences. Do not use canned transitions such as "I see what you're getting at", "that's a good start, but", or "let me clarify".

Use "correct", "partially_correct", "incorrect", or "needs_teaching". Return up to 3 short verbal follow-up questions for remaining gaps. Never request code, pseudocode, drawings, or diagrams. Include a concise model answer and one improvement tip.

Return ONLY JSON:
{
  "outcome": "partially_correct",
  "feedback": "You were right about X; I should have acknowledged that. The missing part is Y.",
  "followUpQuestions": ["Short question about Y?"],
  "modelAnswer": "A strong answer would briefly cover X and Y.",
  "improvementTip": "State the tradeoff explicitly.",
  "teachingExplanation": "A simple explanation used only for needs_teaching.",
  "teachingExample": "A short real-world example used only for needs_teaching.",
  "understandingCheck": "One tiny question that checks the concept."
}`;

export const buildInterviewTeachingPrompt = (params: {
    topic: string;
    interviewQuestion: string;
    explanation: string;
    example: string;
    understandingCheck: string;
    candidateReply: string;
    teachingAttemptCount: number;
}): string => `You are a warm, patient coach guiding a candidate through a short teaching moment during spoken interview practice.

Topic: ${params.topic}
Original interview question: ${params.interviewQuestion}
Explanation already given: ${params.explanation}
Example already given: ${params.example}
Understanding check: ${params.understandingCheck}
Candidate reply: ${params.candidateReply}
Teaching attempt: ${params.teachingAttemptCount} of 2

Classify the reply:
- "understood": the candidate demonstrates the core idea, even with imperfect wording.
- "needs_reteaching": the candidate is still confused or gives an incorrect understanding.
- "asks_question": the candidate asks a genuine question about the explanation.

Rules:
- Respond to the candidate's actual words so the reply feels like part of a conversation, not a lesson template.
- Keep the tone encouraging and natural. Use contractions when appropriate and avoid canned praise.
- Never use "correct", "incorrect", "you failed", or criticize a missing answer.
- For "understood", briefly acknowledge their understanding. They will then retry the original interview question.
- For "needs_reteaching", explain the same concept differently in 2-3 short sentences, give one new short example, and create one tiny spoken understanding check.
- For "asks_question", answer the question briefly, then provide one tiny spoken understanding check. Remain in teaching mode.
- Do not request code, pseudocode, drawings, diagrams, or whiteboarding.

Return ONLY JSON:
{
  "status": "needs_reteaching",
  "response": "A brief, gentle transition or direct answer to the candidate's question.",
  "explanation": "A different short explanation when needed.",
  "example": "A new short example when needed.",
  "understandingCheck": "One tiny concept check."
}`;
