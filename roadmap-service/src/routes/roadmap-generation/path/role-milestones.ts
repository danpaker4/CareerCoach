import type { RoleMilestone, RoleMilestonePlan } from "./role-milestones.types";
import { resolveRoleArchetype } from "../catalog/role-archetype.consts";

const BEGINNER_CYBER_CEO_MILESTONES: readonly RoleMilestone[] = [
    {
        id: "ms.degree",
        label: "Get the basics: CS degree or equivalent foundation",
        howToGetThere:
            "If you have no technical background, start with a Computer Science (or closely related) bachelor's degree, or an equivalent multi-year learning path with assessed projects. During the degree, take networking, operating systems, and security electives when available. Build small labs every semester so you are not only collecting grades.",
        whatYouGain:
            "You gain structured fundamentals: programming, systems thinking, and the language employers expect. You also gain a credible signal that you can finish hard, multi-year work—and a portfolio of class/lab projects you can show in interviews.",
        whyItMatters:
            "Without foundations, cybersecurity job interviews and on-the-job learning are much harder. This stage is the on-ramp, not the destination.",
        targetRole: "Student / junior technical candidate",
        progressionType: "learning",
        capabilityIds: ["cap.credential.cs.degree", "cap.programming.fundamentals", "cap.cybersecurity", "cap.portfolio"],
        actions: [
            "Enroll in a CS (or related) degree, or commit to an equivalent multi-year curriculum with graded projects",
            "Complete networking, OS, and intro-security coursework or labs",
            "Publish 3–5 portfolio projects (for example: a small secure web app, a network lab write-up, a threat-model memo)",
            "Apply to internships or security-related student clubs / CTF teams while studying",
        ],
        completionCriteria: [
            "Degree in progress or completed, or equivalent portfolio reviewed by a mentor/employer",
            "At least three public project write-ups",
            "One internship application cycle completed (even if not yet hired)",
        ],
        minMonths: 24,
        maxMonths: 48,
    },
    {
        id: "ms.cyber.job",
        label: "Work in a company as a cybersecurity professional",
        howToGetThere:
            "After foundations, get hired into a real cybersecurity role: security engineer, SOC analyst, junior penetration tester, IT security specialist, or a software role with security ownership. Apply widely, use internships as a bridge if needed, and accept a solid entry role even if it is not glamorous. Your goal is paid, supervised work on real systems—not more courses alone.",
        whatYouGain:
            "You gain professional credibility: production exposure, incident participation, tickets/projects shipped, and coworkers who can vouch for you. This is the experience that later leadership roles require.",
        whyItMatters:
            "A CEO of a cybersecurity company needs domain credibility. That credibility comes from years of real cybersecurity work, not from titles invented on a résumé.",
        targetRole: "Cybersecurity Engineer / Security Analyst",
        progressionType: "experience",
        capabilityIds: [
            "cap.professional.experience",
            "cap.cybersecurity",
            "cap.security.operations",
            "cap.project.ownership",
            "cap.communication",
        ],
        actions: [
            "Land and keep a cybersecurity (or security-heavy) job for a sustained period",
            "Own at least one recurring responsibility (alerts, hardening, reviews, or a security feature)",
            "Join incident response or change/review processes and document what you learned",
            "Ask for stretch projects that touch architecture or customer-facing security outcomes",
        ],
        completionCriteria: [
            "12+ months of relevant employment (or equivalent sustained internship + conversion)",
            "Written examples of 2–3 delivered security outcomes",
            "Manager or peer feedback confirming independent delivery",
        ],
        minMonths: 12,
        maxMonths: 36,
    },
    {
        id: "ms.senior.ic",
        label: "Grow into a senior cybersecurity individual contributor",
        howToGetThere:
            "After you can do the job independently, take harder problems: security design reviews, threat modeling, complex incidents, cross-team security projects. Seek senior/staff IC titles or the same scope without the title. Mentor juniors informally.",
        whatYouGain:
            "You gain judgment: when controls are enough, how to trade risk vs speed, and how to explain security to non-security stakeholders. This prepares you to lead people later.",
        whyItMatters:
            "Team leads who never developed strong IC judgment struggle. Senior IC depth is the bridge into management.",
        targetRole: "Senior Security Engineer / Security Architect",
        progressionType: "hybrid",
        capabilityIds: [
            "cap.security.architecture",
            "cap.system.design",
            "cap.project.ownership",
            "cap.collaboration",
        ],
        actions: [
            "Lead security design reviews and write ADRs for major decisions",
            "Own a multi-quarter security initiative end-to-end",
            "Mentor at least one junior colleague with regular feedback",
            "Present technical trade-offs to engineering and product partners",
        ],
        completionCriteria: [
            "Two reviewed architecture/threat-model documents",
            "One multi-quarter initiative delivered with a retrospective",
            "Evidence of mentoring or technical leadership without formal management",
        ],
        minMonths: 18,
        maxMonths: 36,
    },
    {
        id: "ms.team.lead",
        label: "Become a team lead and gain managing experience",
        howToGetThere:
            "Move into a people-lead role: Security Team Lead, Engineering Manager (Security), or Tech Lead with hiring/perf responsibilities. Start by leading a small team or squad. Learn to hire, coach, set priorities, and take responsibility for others' outcomes—not only your own tickets.",
        whatYouGain:
            "You gain managing experience: 1:1s, feedback, prioritization, hiring input, and accountability for team delivery. This is the first true leadership proof for later director/CISO/CEO paths.",
        whyItMatters:
            "You cannot skip from individual contributor work to running a company. Managing a team is how you learn people leadership under real constraints.",
        targetRole: "Security Team Lead / Security Engineering Manager",
        progressionType: "experience",
        capabilityIds: ["cap.leadership", "cap.project.ownership", "cap.communication", "cap.collaboration"],
        actions: [
            "Accept a team-lead or EM role (or run a squad with formal people responsibilities)",
            "Run recurring 1:1s, goal-setting, and feedback cycles",
            "Own team hiring or interview loop participation and onboarding",
            "Deliver team outcomes against a roadmap and write a quarterly leadership retrospective",
        ],
        completionCriteria: [
            "Sustained people-lead tenure (typically 12+ months)",
            "Documented team outcomes and one hiring/onboarding example",
            "Written feedback from reports or manager on your leadership",
        ],
        minMonths: 12,
        maxMonths: 36,
    },
    {
        id: "ms.director",
        label: "Lead a security organization (Director / Head of Security)",
        howToGetThere:
            "Expand from one team to multiple teams or a full security function. Own strategy, budget inputs, vendor choices, and cross-functional influence with product, sales, and executives.",
        whatYouGain:
            "You gain organizational leadership: managers reporting to you, portfolio prioritization, and executive communication about risk and investment.",
        whyItMatters:
            "CEO-level work requires leading leaders and connecting security to company outcomes.",
        targetRole: "Director of Security / Head of Security",
        progressionType: "experience",
        capabilityIds: ["cap.leadership", "cap.executive.leadership", "cap.business.finance", "cap.domain.business"],
        actions: [
            "Own a multi-team security roadmap and operating rhythm",
            "Present risk and investment trade-offs to senior leadership quarterly",
            "Manage managers and coaching conversations at scale",
            "Partner with product/sales on security as a customer-facing differentiator",
        ],
        completionCriteria: [
            "Multi-team ownership for a sustained period",
            "Executive-facing strategy updates delivered",
            "Budget or headcount planning artifacts you owned",
        ],
        minMonths: 18,
        maxMonths: 36,
    },
    {
        id: "ms.executive",
        label: "Build executive and commercial leadership toward CEO",
        howToGetThere:
            "Take CISO/VP Security, GM, founder, or general-management roles where you own P&L exposure, customers, hiring plans, and board- or investor-style communication. If founding, start with a real customer problem and a small paid product/service. Learn finance, GTM, and organizational design deliberately.",
        whatYouGain:
            "You gain CEO-relevant proof: commercial judgment, organizational design, customer understanding, and the ability to set strategy under uncertainty. This still does not guarantee a CEO seat—it makes you a credible candidate.",
        whyItMatters:
            "Technical excellence alone does not create a cybersecurity CEO. Business, people, and market leadership must be earned in later stages.",
        targetRole: "VP Security / CISO / Founder track → CEO",
        progressionType: "hybrid",
        capabilityIds: [
            "cap.executive.leadership",
            "cap.business.finance",
            "cap.product.sense",
            "cap.domain.business",
        ],
        actions: [
            "Own or co-own a P&L, budget, or revenue-adjacent security offering",
            "Build a hiring and org plan for a growing security/product organization",
            "Run customer or board-style updates on strategy, risk, and results",
            "Write a personal CEO-readiness case study covering domain + leadership + commercial evidence",
        ],
        completionCriteria: [
            "Evidence of commercial or P&L-adjacent ownership",
            "Org/hiring plan you authored and executed against",
            "Strategy narrative reviewed by a mentor, board advisor, or senior operator",
        ],
        minMonths: 24,
        maxMonths: 48,
    },
] as const;

/** Job + learning ladder for Principal / Staff Architect destinations. */
const ARCHITECTURE_IC_MILESTONES_EXPERIENCED: readonly RoleMilestone[] = [
    {
        id: "ms.arch.skills",
        label: "Close architecture skill gaps (system design & distributed systems)",
        howToGetThere:
            "Build on the languages and stack you already know. Study system design deeply, practice designing large-scale services, and learn the data/platform pieces your target role needs (for example cloud, streaming, or ML platforms)—as focused upskilling, not a restart from CS 101.",
        whatYouGain:
            "You gain portable architecture evidence: design docs, trade-off write-ups, and small prototypes that show you can reason about scale, reliability, and interfaces.",
        whyItMatters:
            "Principal Architect interviews and day-to-day work reward design judgment more than collecting unrelated beginner courses.",
        targetRole: "Senior Software Engineer / Software Architect (prep)",
        progressionType: "learning",
        capabilityIds: ["cap.system.design", "cap.cloud.basics", "cap.communication"],
        actions: [
            "Complete a structured system-design practice set (APIs, storage, consistency, failure modes)",
            "Write 2 architecture decision records for systems you know or can prototype",
            "Fill only the platform gaps your target role needs (cloud, streaming, or data plane)—not a full beginner stack",
            "Present one design review to peers or a mentor and capture feedback",
        ],
        completionCriteria: [
            "Two reviewed design/ADR artifacts",
            "One design presentation with notes",
            "A short gap list of remaining skills tied to the next job, not a degree plan",
        ],
        minMonths: 3,
        maxMonths: 9,
    },
    {
        id: "ms.senior.swe.job",
        label: "Work as a Senior Software Engineer or Software Architect",
        howToGetThere:
            "Target senior IC or architect-track roles at companies that ship real production systems. Apply with design docs and shipped outcomes from your current stack. Prefer teams where you own interfaces across services—not only feature tickets.",
        whatYouGain:
            "You gain paid architectural scope: production ownership, cross-team design influence, and coworkers who can vouch for your judgment.",
        whyItMatters:
            "You cannot become a Principal Architect by studying alone. Employers expect years of senior engineering work on real systems.",
        targetRole: "Senior Software Engineer / Software Architect",
        progressionType: "experience",
        capabilityIds: [
            "cap.professional.experience",
            "cap.system.design",
            "cap.project.ownership",
            "cap.collaboration",
        ],
        actions: [
            "Land and keep a senior engineering or software-architect role",
            "Own at least one cross-service interface or platform decision end-to-end",
            "Lead or co-lead design reviews for your team",
            "Document 2–3 shipped outcomes with measurable impact",
        ],
        completionCriteria: [
            "12+ months in a senior IC / architect-track role",
            "Two production architecture outcomes you can explain in interviews",
            "Manager or peer feedback confirming design ownership",
        ],
        minMonths: 12,
        maxMonths: 30,
    },
    {
        id: "ms.staff.eng",
        label: "Grow into a Staff Engineer leading cross-team architecture",
        howToGetThere:
            "Expand from one team to multi-team technical leadership: set standards, unblock adjacent teams, and drive multi-quarter platform or product architecture. Seek Staff Engineer / Lead Architect scope even if the title varies by company.",
        whatYouGain:
            "You gain staff-level proof: org-wide design influence, mentoring of seniors, and a track record of hard trade-offs under real constraints.",
        whyItMatters:
            "Principal Architect roles expect staff-level influence before the title—guiding multiple teams, not only writing local designs.",
        targetRole: "Staff Engineer / Lead Architect",
        progressionType: "hybrid",
        capabilityIds: [
            "cap.system.design",
            "cap.leadership",
            "cap.project.ownership",
            "cap.communication",
        ],
        actions: [
            "Lead a multi-team architecture initiative for multiple quarters",
            "Publish architecture standards or RFCs adopted beyond your team",
            "Mentor senior engineers on design quality",
            "Partner with product/eng leadership on roadmap trade-offs",
        ],
        completionCriteria: [
            "One multi-team initiative delivered with a retrospective",
            "Evidence of standards/RFC adoption outside your team",
            "Mentoring or technical leadership feedback from seniors",
        ],
        minMonths: 18,
        maxMonths: 36,
    },
    {
        id: "ms.principal.scope",
        label: "Operate at Principal Engineer / Principal Architect scope",
        howToGetThere:
            "Take ownership of a major technical domain (platform, data plane, product architecture). Drive strategy for that domain, hire/influence specialists, and represent architecture in exec or customer-facing forums when needed.",
        whatYouGain:
            "You gain principal-level evidence: domain strategy, high-stakes decisions, and a narrative that matches Principal Architect expectations at large tech companies.",
        whyItMatters:
            "The title follows demonstrated principal scope. This stage is about doing the job before—or while—chasing the exact title at your dream employer.",
        targetRole: "Principal Engineer / Principal Architect",
        progressionType: "experience",
        capabilityIds: [
            "cap.system.design",
            "cap.executive.leadership",
            "cap.project.ownership",
            "cap.domain.business",
        ],
        actions: [
            "Own a company-critical architecture domain for a sustained period",
            "Write and socialize a multi-year technical strategy for that domain",
            "Lead high-stakes incident or migration architecture decisions",
            "Build a principal-level case study portfolio (3–5 deep examples)",
        ],
        completionCriteria: [
            "Documented domain ownership and strategy artifacts",
            "Two high-stakes decisions with outcomes and retros",
            "Portfolio ready for principal-level interviews",
        ],
        minMonths: 18,
        maxMonths: 36,
    },
    {
        id: "ms.arch.target",
        label: "Package evidence and pursue Principal Architect roles",
        howToGetThere:
            "Translate your job history into a Principal Architect narrative: design stories, org impact, and platform outcomes. Target companies and teams that hire principal architects; practice architecture interviews; network with hiring managers and staff/principal peers.",
        whatYouGain:
            "You gain a hireable story and interview-ready proof—without inventing experience you did not earn in earlier job stages.",
        whyItMatters:
            "The destination role is competitive. Packaging and targeting is how you convert the ladder into offers.",
        targetRole: "Principal Architect",
        progressionType: "hybrid",
        capabilityIds: ["cap.portfolio", "cap.interview.ready", "cap.communication"],
        actions: [
            "Rewrite résumé and portfolio around architecture impact, not task lists",
            "Complete a principal-level system design interview practice loop",
            "Apply to Principal Architect / Principal Engineer roles at target companies",
            "Run mock interviews with staff/principal peers and iterate",
        ],
        completionCriteria: [
            "Portfolio and narrative reviewed by a senior peer",
            "Interview practice loop completed with notes",
            "Active applications to target principal-level roles",
        ],
        minMonths: 3,
        maxMonths: 9,
    },
] as const;

const ARCHITECTURE_IC_MILESTONES_BEGINNER: readonly RoleMilestone[] = [
    {
        id: "ms.arch.foundations",
        label: "Build software engineering foundations",
        howToGetThere:
            "Learn programming fundamentals and ship small projects until you can pass entry-level software interviews. Prefer structured practice and portfolio work over collecting random certificates.",
        whatYouGain:
            "You gain enough coding and systems basics to get a first engineering job—the real start of an architect path.",
        whyItMatters:
            "Architecture careers start with engineering delivery. Foundations without a job still leave you stuck.",
        targetRole: "Junior Software Engineer candidate",
        progressionType: "learning",
        capabilityIds: ["cap.programming.fundamentals", "cap.portfolio", "cap.system.design"],
        actions: [
            "Complete a structured programming curriculum with weekly projects",
            "Publish 3 portfolio projects with README and tests",
            "Practice basic system-design explanations for apps you built",
            "Apply to internships or junior software roles",
        ],
        completionCriteria: [
            "Three public projects",
            "One internship or junior application cycle completed",
        ],
        minMonths: 6,
        maxMonths: 18,
    },
    {
        id: "ms.arch.first.job",
        label: "Work as a Software Engineer",
        howToGetThere:
            "Get hired as a software engineer and ship production features under mentorship. Stay long enough to own a service area and learn how real systems fail.",
        whatYouGain:
            "You gain professional engineering experience—the prerequisite for senior and architect roles.",
        whyItMatters:
            "Without a first engineering job, later architect titles are not credible.",
        targetRole: "Software Engineer",
        progressionType: "experience",
        capabilityIds: ["cap.professional.experience", "cap.programming.fundamentals", "cap.collaboration"],
        actions: [
            "Land and keep a software engineering role",
            "Ship features to production and write short postmortems when things break",
            "Ask for ownership of a small service or component",
            "Seek design-review exposure with seniors",
        ],
        completionCriteria: [
            "12+ months of software engineering employment",
            "Examples of production delivery you can discuss",
        ],
        minMonths: 12,
        maxMonths: 30,
    },
    ...ARCHITECTURE_IC_MILESTONES_EXPERIENCED,
] as const;

const ENGINEERING_IC_MILESTONES_EXPERIENCED: readonly RoleMilestone[] = [
    {
        id: "ms.eng.skills",
        label: "Close the skill gaps for your next engineering role",
        howToGetThere:
            "Identify the missing skills for your target engineering role and close them with focused projects—building on what you already know.",
        whatYouGain: "Targeted proof for the next job, not a full beginner restart.",
        whyItMatters: "Learning without a next-job target wastes time; job hunting without skill proof stalls.",
        targetRole: "Next engineering role (prep)",
        progressionType: "learning",
        capabilityIds: ["cap.programming.fundamentals", "cap.portfolio"],
        actions: [
            "List must-have skills for your target role and pick the top 3 gaps",
            "Ship one project that proves each gap is closed",
            "Update résumé bullets with measurable outcomes",
        ],
        completionCriteria: ["Three gap-closing artifacts ready for interviews"],
        minMonths: 2,
        maxMonths: 6,
    },
    {
        id: "ms.eng.job",
        label: "Work in the target engineering role",
        howToGetThere:
            "Apply and get hired into the role that matches your dream path. Prefer teams with strong mentorship and production ownership.",
        whatYouGain: "Paid experience and references in the domain you want.",
        whyItMatters: "Skills alone do not replace job tenure for career progression.",
        targetRole: "Software Engineer",
        progressionType: "experience",
        capabilityIds: ["cap.professional.experience", "cap.project.ownership"],
        actions: [
            "Land the target engineering role",
            "Own delivery for a meaningful product area",
            "Collect manager feedback each quarter",
        ],
        completionCriteria: ["12+ months of relevant employment with shipped outcomes"],
        minMonths: 12,
        maxMonths: 30,
    },
    {
        id: "ms.eng.senior",
        label: "Grow into a Senior Engineer",
        howToGetThere:
            "Take harder problems, mentor others, and own designs end-to-end until senior scope is obvious.",
        whatYouGain: "Senior-level judgment and leadership-without-management proof.",
        whyItMatters: "Senior scope is the usual bridge to staff/architect tracks.",
        targetRole: "Senior Software Engineer",
        progressionType: "hybrid",
        capabilityIds: ["cap.system.design", "cap.leadership", "cap.project.ownership"],
        actions: [
            "Lead designs for multi-week initiatives",
            "Mentor a junior engineer",
            "Deliver a senior-level case study of impact",
        ],
        completionCriteria: ["Evidence of senior scope for 12+ months"],
        minMonths: 12,
        maxMonths: 30,
    },
] as const;

const trimMilestones = (milestones: readonly RoleMilestone[], targetYears: number): RoleMilestone[] => {
    if (milestones.length <= 3) return [...milestones];
    if (targetYears <= 4) return [...milestones.slice(0, 3), milestones[milestones.length - 1]!];
    if (targetYears <= 7) {
        if (milestones.length <= 5) return [...milestones];
        return [...milestones.slice(0, 4), milestones[milestones.length - 1]!];
    }
    return [...milestones];
};

export const resolveRoleMilestonePlan = (params: {
    readonly dreamJob: string;
    readonly targetYears: number;
    readonly isEntryLevel: boolean;
    readonly hasNoSkills: boolean;
}): RoleMilestonePlan | null => {
    const archetype = resolveRoleArchetype(params.dreamJob);
    const zeroKnowledge = params.isEntryLevel || params.hasNoSkills;

    if (archetype === "executive_cyber" && zeroKnowledge) {
        return {
            milestones: trimMilestones(BEGINNER_CYBER_CEO_MILESTONES, params.targetYears),
            reasonCodes: ["beginner_role_milestones", "path_degree_then_job_then_lead", "executive_cyber"],
        };
    }

    if (archetype === "executive_cyber") {
        const withoutDegree = BEGINNER_CYBER_CEO_MILESTONES.filter((milestone) => milestone.id !== "ms.degree");
        return {
            milestones: trimMilestones(withoutDegree, params.targetYears),
            reasonCodes: ["role_milestones", "executive_cyber", "skipped_degree_for_experienced"],
        };
    }

    if (archetype === "architecture_ic") {
        const milestones = zeroKnowledge
            ? ARCHITECTURE_IC_MILESTONES_BEGINNER
            : ARCHITECTURE_IC_MILESTONES_EXPERIENCED;
        return {
            milestones: trimMilestones(milestones, params.targetYears),
            reasonCodes: [
                "role_milestones",
                "architecture_ic",
                "jobs_plus_learning",
                ...(zeroKnowledge ? ["beginner_architecture_path"] : ["experienced_architecture_path"]),
            ],
        };
    }

    if (archetype === "engineering_ic") {
        const milestones = zeroKnowledge
            ? [
                  ARCHITECTURE_IC_MILESTONES_BEGINNER[0]!,
                  ARCHITECTURE_IC_MILESTONES_BEGINNER[1]!,
                  ...ENGINEERING_IC_MILESTONES_EXPERIENCED.slice(1),
              ]
            : ENGINEERING_IC_MILESTONES_EXPERIENCED;
        return {
            milestones: trimMilestones(milestones, params.targetYears),
            reasonCodes: [
                "role_milestones",
                "engineering_ic",
                "jobs_plus_learning",
                ...(zeroKnowledge ? ["beginner_engineering_path"] : ["experienced_engineering_path"]),
            ],
        };
    }

    return null;
};
