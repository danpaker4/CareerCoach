# Evaluation case fixtures

39 cases covering **GUIDED**, **NEAR_TERM**, **DREAMJOB**, and quick-help modes (**SKILLS_GAP**, **CV_IMPROVE**, **INTERVIEW_PREP**), with checks for `mode`, `maxLines`, `mustAskQuestion`, and `forbiddenWords`.

## Upload one file (UI)

Management → LLM evaluation → **Add Conversation** → pick a `.json` file.

## Seed all fixtures into MongoDB

With evaluation-service running on port 3004:

```bash
cd evaluation-service
./scripts/seed-evaluation-cases.sh
```

Creates new cases and **replaces** existing ones (POST then PUT on 409) so fixture edits stay in sync.

## Case index

| ID | Expected mode | Notes |
|----|---------------|--------|
| eval-01-guided-qa-intro | GUIDED | QA + Cypress intro |
| eval-02-guided-career-change | GUIDED | Switching from teaching |
| eval-03-guided-timeline-asap | NEAR_TERM | ASAP / next months → near-term search after onboarding |
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
| eval-37-onboarding-near-term-now | NEAR_TERM | Onboarding background then "looking for a job now" |
| eval-38-onboarding-guided-figuring-it-out | GUIDED | Onboarding background then "still figuring it out" |
| eval-39-onboarding-chat-role-preferred | GUIDED | Chat-stated QA/5 years must not echo CV-only tenure wording |
