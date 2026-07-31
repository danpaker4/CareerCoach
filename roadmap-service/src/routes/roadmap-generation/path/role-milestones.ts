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

const trimMilestones = (milestones: readonly RoleMilestone[], targetYears: number): RoleMilestone[] => {
    if (targetYears <= 4) return [...milestones.slice(0, 3), milestones[milestones.length - 1]!];
    if (targetYears <= 7) return [...milestones.slice(0, 5), milestones[milestones.length - 1]!];
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
        // Non-beginners still get the role ladder, skipping the pure degree-first milestone when they already have skills.
        const withoutDegree = BEGINNER_CYBER_CEO_MILESTONES.filter((milestone) => milestone.id !== "ms.degree");
        return {
            milestones: trimMilestones(withoutDegree, params.targetYears),
            reasonCodes: ["role_milestones", "executive_cyber", "skipped_degree_for_experienced"],
        };
    }

    return null;
};
