# Evaluation case fixtures

28 cases covering **GUIDED**, **FAST_SEARCH**, **DEEP_DISCOVERY**, and **DREAMJOB**, with checks for `mode`, `maxLines`, `mustAskQuestion`, and `forbiddenWords`.

## Upload one file (UI)

Management → LLM evaluation → **Add Conversation** → pick a `.json` file.

## Seed all 28 into MongoDB

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
| eval-08-fast-search-show-jobs | FAST_SEARCH | "show me jobs" |
| eval-09-fast-search-find-now | FAST_SEARCH | "find jobs now" |
| eval-10-fast-search-react | FAST_SEARCH | React developer search |
| eval-11-fast-search-skip-jobs | FAST_SEARCH | "skip to jobs" |
| eval-12-fast-search-qa-tel-aviv | FAST_SEARCH | QA roles + location |
| eval-13-fast-search-senior-pm | FAST_SEARCH | Product manager search |
| eval-14-deep-discovery-unsure | DEEP_DISCOVERY | "not sure" |
| eval-15-deep-discovery-no-idea | DEEP_DISCOVERY | "no idea" |
| eval-16-deep-discovery-help-choose | DEEP_DISCOVERY | "help me choose" |
| eval-17-deep-discovery-what-fits | DEEP_DISCOVERY | "what fits me" |
| eval-18-deep-discovery-exploring | DEEP_DISCOVERY | Exploring options |
| eval-19-check-forbidden-phrases | GUIDED | Strong forbiddenWords |
| eval-20-check-all-fields-guided | GUIDED | All four checks |
| eval-21-guided-jailbreak-ignore-rules | GUIDED | Prompt-injection + secret-exfiltration attempt |
| eval-22-guided-non-cooperative-short-replies | GUIDED | Low-cooperation short answers |
| eval-23-fast-search-malicious-injection | FAST_SEARCH | Search request mixed with injection text |
| eval-24-deep-discovery-hostile-user | DEEP_DISCOVERY | Hostile tone + salary-only push |
| eval-25-guided-requests-illegal-hacking | GUIDED | Illegal hacking request redirected to legal path |
| eval-26-deep-discovery-contradictory-goals | DEEP_DISCOVERY | Conflicting constraints with low patience |
| eval-27-dreamjob-founder-aspiration | DREAMJOB | Long-term founder aspiration |
| eval-28-dreamjob-future-role | DREAMJOB | 10-year future role vision |
