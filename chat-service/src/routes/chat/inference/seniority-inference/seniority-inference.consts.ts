export type RoleDomainDefinition = {
    roleKey: string;
    displayLabel: string;
    messageAliases: readonly string[];
    jobTitleKeywords: readonly string[];
};

export const ROLE_DOMAIN_DEFINITIONS: readonly RoleDomainDefinition[] = [
    {
        roleKey: "software_engineering",
        displayLabel: "Software Engineering",
        messageAliases: [
            "software engineer",
            "software developer",
            "software development",
            "software programming",
            "programming",
            "backend engineer",
            "backend developer",
            "frontend engineer",
            "frontend developer",
            "full stack",
            "fullstack",
            "full-stack",
            "web developer",
            "developer",
            "engineering",
        ],
        jobTitleKeywords: [
            "software",
            "engineer",
            "developer",
            "backend",
            "frontend",
            "fullstack",
            "full stack",
            "devops",
            "sre",
            "platform engineer",
        ],
    },
    {
        roleKey: "product_management",
        displayLabel: "Product Management",
        messageAliases: [
            "product manager",
            "product management",
            "product owner",
            "be a pm",
            "as a pm",
            "into pm",
            "pm role",
            "pm position",
        ],
        jobTitleKeywords: ["product manager", "product owner", "product lead", " pm"],
    },
    {
        roleKey: "qa_engineering",
        displayLabel: "QA Engineering",
        messageAliases: [
            "qa engineer",
            "quality assurance",
            "test engineer",
            "automation engineer",
            "sdet",
        ],
        jobTitleKeywords: ["qa", "quality", "test engineer", "sdet", "automation engineer"],
    },
    {
        roleKey: "data_engineering",
        displayLabel: "Data Engineering",
        messageAliases: ["data engineer", "data engineering", "analytics engineer"],
        jobTitleKeywords: ["data engineer", "analytics engineer", "data platform"],
    },
    {
        roleKey: "design",
        displayLabel: "Design",
        messageAliases: ["ux designer", "ui designer", "product designer", "designer"],
        jobTitleKeywords: ["designer", "ux", "ui", "product design"],
    },
];
