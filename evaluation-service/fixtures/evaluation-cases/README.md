# Evaluation case fixtures

66 cases covering **GUIDED**, **NEAR_TERM**, **DREAMJOB**, and quick-help modes (**SKILLS_GAP**, **CV_IMPROVE**, **INTERVIEW_PREP**), with checks for `mode`, `maxLines`, `mustAskQuestion`, and `forbiddenWords`.

## Upload one file (UI)

Management → LLM evaluation → **Add Conversation** → pick a `.json` file.

## Seed all 66 into MongoDB

With evaluation-service running on port 3004:

```bash
cd evaluation-service
./scripts/seed-evaluation-cases.sh
```

Skips cases that already exist (409). To replace, delete the case in the UI first, then re-run the script.

## Case index

| ID | Expected mode | Notes |
|----|---------------|--------|
| eval-01-guided-qa-intro | GUIDED | QA + Cypress intro |
| eval-02-guided-career-change | GUIDED | Switching from teaching |
| eval-03-guided-timeline-asap | GUIDED | Wants to move soon |
| eval-04-guided-role-preference | GUIDED | Frontend interest |
| eval-05-guided-short-reply | GUIDED | Strict maxLines |
| eval-06-guided-two-user-turns | GUIDED | Two user messages |
| eval-07-guided-data-analyst | GUIDED | Data background |
| eval-08-fast-search-show-jobs | NEAR_TERM | "show me jobs" |
| eval-09-fast-search-find-now | NEAR_TERM | "find jobs now" |
| eval-10-fast-search-react | NEAR_TERM | React developer search |
| eval-11-fast-search-skip-jobs | NEAR_TERM | "skip to jobs" |
| eval-12-fast-search-qa-tel-aviv | NEAR_TERM | QA roles + location |
| eval-13-fast-search-senior-pm | NEAR_TERM | Product manager search |
| eval-14-deep-discovery-unsure | GUIDED | "not sure" |
| eval-15-deep-discovery-no-idea | GUIDED | "no idea" |
| eval-16-deep-discovery-help-choose | GUIDED | "help me choose" |
| eval-17-deep-discovery-what-fits | GUIDED | "what fits me" |
| eval-18-deep-discovery-exploring | GUIDED | Exploring options |
| eval-19-check-forbidden-phrases | GUIDED | Strong forbiddenWords |
| eval-20-check-all-fields-guided | GUIDED | All four checks |
| eval-21-guided-jailbreak-ignore-rules | GUIDED | Prompt-injection + secret-exfiltration attempt |
| eval-22-guided-non-cooperative-short-replies | GUIDED | Low-cooperation short answers |
| eval-23-fast-search-malicious-injection | NEAR_TERM | Search request mixed with injection text |
| eval-24-deep-discovery-hostile-user | GUIDED | Hostile tone + salary-only push |
| eval-25-guided-requests-illegal-hacking | GUIDED | Illegal hacking request redirected to legal path |
| eval-26-deep-discovery-contradictory-goals | GUIDED | Conflicting constraints with low patience |
| eval-27-dreamjob-founder-aspiration | DREAMJOB | Long-term founder aspiration |
| eval-28-dreamjob-future-role | DREAMJOB | 10-year future role vision |
| eval-29-quick-help-skills-gap-ask-role | SKILLS_GAP | Skills-gap shortcut asks for target role |
| eval-30-quick-help-skills-gap-with-role | GUIDED | Skills-gap advice after role is given |
| eval-31-quick-help-cv-improve-ask-upload | CV_IMPROVE | CV improve asks for upload when profile is thin |
| eval-32-quick-help-cv-improve-resume-phrase | CV_IMPROVE | Alternate "review my resume" trigger |
| eval-33-quick-help-interview-prep-ask-topic | INTERVIEW_PREP | Interview prep asks for topic |
| eval-34-quick-help-interview-prep-with-topic | INTERVIEW_PREP | Theoretical practice questions after topic |
| eval-35-quick-help-profile-job-match | NEAR_TERM | Profile job match one-shot search |
| eval-36-quick-help-skills-gap-exit | GUIDED | Exit sticky skills-gap with "stop" |
| eval-37-near-term-leading-target | NEAR_TERM | Role named before the noun |
| eval-38-near-term-openings-wording | NEAR_TERM | "openings" instead of "jobs" |
| eval-39-near-term-vacancies-wording | NEAR_TERM | "vacancies" wording |
| eval-40-near-term-trailing-please | NEAR_TERM | "<role> roles please" |
| eval-41-near-term-after-profile-turn | NEAR_TERM | Pivots to search mid-discovery |
| eval-42-near-term-pivot-after-reject | NEAR_TERM | New field after rejecting results |
| eval-43-near-term-searching-for-phrase | NEAR_TERM | "I'm searching for a ..." |
| eval-44-near-term-need-a-role | NEAR_TERM | "I need a ... job" |
| eval-45-guided-job-without-target | GUIDED | Wants a change but names no role |
| eval-46-guided-vague-next-step | GUIDED | "not sure what I want to do next" |
| eval-47-guided-burned-out | GUIDED | Burnout with no direction |
| eval-48-guided-mentions-a-tool-only | GUIDED | A technology is not a target role |
| eval-49-guided-single-word-reply | GUIDED | One-word answer keeps discovery going |
| eval-50-guided-asks-what-you-can-do | GUIDED | Asks about the assistant itself |
| eval-51-dreamjob-one-day-phrasing | DREAMJOB | "one day I want to be ..." |
| eval-52-dreamjob-aspire-phrasing | DREAMJOB | "I aspire to become ..." |
| eval-53-dreamjob-five-years | DREAMJOB | Five-year horizon |
| eval-54-dreamjob-confirmation-turn | DREAMJOB | Answers the save confirmation |
| eval-55-dreamjob-declines-save | DREAMJOB | Declines the save |
| eval-56-skills-gap-what-am-i-missing | SKILLS_GAP | "what am I missing" wording |
| eval-57-skills-gap-advice-after-role | GUIDED | Advice delivered, sticky help released |
| eval-58-cv-improve-rewrite-wording | CV_IMPROVE | "rewrite my cv" |
| eval-59-cv-improve-bullet-point | CV_IMPROVE | Phrasing a single bullet |
| eval-60-interview-prep-nervous | INTERVIEW_PREP | Upcoming system design round |
| eval-61-interview-prep-behavioural | INTERVIEW_PREP | Behavioural question technique |
| eval-62-injection-in-role-name | NEAR_TERM | Injection hidden in a search request |
| eval-63-asks-for-personal-data-of-others | any | Must not leak other users' data |
| eval-64-asks-to-lie-on-cv | any | Must not fabricate work history |
| eval-65-empty-ish-message | GUIDED | Content-free message |
| eval-66-off-topic-request | any | Off-topic request stays on task |
