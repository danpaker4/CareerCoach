import type { CreateJobBody } from "../routes/jobs/jobs.schema";

export const SAMPLE_JOBS: readonly CreateJobBody[] = [
    {
        "jobTitle": "Backend Developer",
        "company": "Wix",
        "description": "Wix is looking for a backend developer. Node.js, TypeScript and MongoDB services behind a high-traffic product; you will design REST APIs, own data models and ship features used by millions.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 32000,
        "requirements": [
            "Node.js",
            "TypeScript",
            "MongoDB",
            "REST APIs"
        ],
        "url": "https://www.wix.com/jobs/careers"
    },
    {
        "jobTitle": "Senior Backend Engineer",
        "company": "Monday.com",
        "description": "Monday.com is looking for a senior backend engineer. Lead the design of high-throughput services, mentor engineers and own architectural decisions across the platform group.",
        "seniority": "senior",
        "location": "Tel Aviv",
        "salary": 49300,
        "requirements": [
            "Node.js",
            "Kafka",
            "System design",
            "AWS"
        ],
        "url": "https://monday.com/careers/positions"
    },
    {
        "jobTitle": "Junior Backend Developer",
        "company": "Riskified",
        "description": "Riskified is looking for a junior backend developer. Join the platform team to write services, add tests and learn from senior engineers in a supportive environment.",
        "seniority": "junior",
        "location": "Tel Aviv",
        "salary": 24600,
        "requirements": [
            "JavaScript",
            "SQL",
            "Git"
        ],
        "url": "https://www.riskified.com/careers/"
    },
    {
        "jobTitle": "Full Stack Developer",
        "company": "Lemonade",
        "description": "Lemonade is looking for a full stack developer. Build customer-facing flows end to end, from React screens to the Node services behind them.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 35900,
        "requirements": [
            "React",
            "Node.js",
            "TypeScript"
        ],
        "url": "https://www.lemonade.com/careers"
    },
    {
        "jobTitle": "Full Stack Engineer",
        "company": "Fiverr",
        "description": "Fiverr is looking for a full stack engineer. Ship features across the stack for a large marketplace and improve the experience for buyers and sellers.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 37200,
        "requirements": [
            "React",
            "Node.js",
            "MongoDB",
            "CI/CD"
        ],
        "url": "https://www.fiverr.com/lp/careers"
    },
    {
        "jobTitle": "Frontend Developer",
        "company": "Payoneer",
        "description": "Payoneer is looking for a frontend developer. Build data-heavy dashboards used by analysts, focusing on performance and clear visualisation of large datasets.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 38500,
        "requirements": [
            "React",
            "TypeScript",
            "CSS",
            "Data visualisation"
        ],
        "url": "https://www.payoneer.com/careers/"
    },
    {
        "jobTitle": "Senior Frontend Engineer",
        "company": "Similarweb",
        "description": "Similarweb is looking for a senior frontend engineer. Own the component system and rendering performance of a product used daily by thousands of teams.",
        "seniority": "senior",
        "location": "Tel Aviv",
        "salary": 55800,
        "requirements": [
            "React",
            "TypeScript",
            "Performance",
            "Design systems"
        ],
        "url": "https://www.similarweb.com/corp/careers/"
    },
    {
        "jobTitle": "QA Engineer",
        "company": "JFrog",
        "description": "JFrog is looking for a qa engineer. Design test plans, run manual and exploratory testing and automate regression suites for a complex platform.",
        "seniority": "mid",
        "location": "Netanya",
        "salary": 41100,
        "requirements": [
            "Manual testing",
            "Test plans",
            "SQL",
            "Jira"
        ],
        "url": "https://jfrog.com/careers/"
    },
    {
        "jobTitle": "QA Automation Engineer",
        "company": "Cellebrite",
        "description": "Cellebrite is looking for a qa automation engineer. Build Playwright and API test suites, integrate them into CI and raise release confidence across teams.",
        "seniority": "mid",
        "location": "Petah Tikva",
        "salary": 42400,
        "requirements": [
            "Playwright",
            "Selenium",
            "JavaScript",
            "CI/CD"
        ],
        "url": "https://cellebrite.com/en/careers/"
    },
    {
        "jobTitle": "Junior QA Engineer",
        "company": "Verbit",
        "description": "Verbit is looking for a junior qa engineer. Write test cases, execute regression cycles and learn automation from senior engineers.",
        "seniority": "junior",
        "location": "Tel Aviv",
        "salary": 25700,
        "requirements": [
            "Manual testing",
            "Attention to detail"
        ],
        "url": "https://verbit.ai/careers/"
    },
    {
        "jobTitle": "DevOps Engineer",
        "company": "Kaltura",
        "description": "Kaltura is looking for a devops engineer. Own CI/CD pipelines and Kubernetes infrastructure, improving deployment reliability across engineering.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 32000,
        "requirements": [
            "Kubernetes",
            "Docker",
            "Terraform",
            "AWS"
        ],
        "url": "https://corp.kaltura.com/careers/"
    },
    {
        "jobTitle": "Site Reliability Engineer",
        "company": "Outbrain",
        "description": "Outbrain is looking for a site reliability engineer. Own uptime, incident response and observability for a large recommendation platform.",
        "seniority": "senior",
        "location": "Netanya",
        "salary": 62300,
        "requirements": [
            "Kubernetes",
            "Prometheus",
            "Terraform",
            "Go"
        ],
        "url": "https://www.outbrain.com/careers/"
    },
    {
        "jobTitle": "Data Engineer",
        "company": "Taboola",
        "description": "Taboola is looking for a data engineer. Build and maintain batch and streaming pipelines that feed analytics and machine-learning workloads.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 34600,
        "requirements": [
            "Python",
            "Airflow",
            "Spark",
            "SQL"
        ],
        "url": "https://www.taboola.com/careers"
    },
    {
        "jobTitle": "Senior Data Engineer",
        "company": "Gong",
        "description": "Gong is looking for a senior data engineer. Design the data platform, own warehouse modelling and lead the migration to a streaming architecture.",
        "seniority": "senior",
        "location": "Ramat Gan",
        "salary": 64900,
        "requirements": [
            "Python",
            "Kafka",
            "Snowflake",
            "dbt"
        ],
        "url": "https://www.gong.io/careers/"
    },
    {
        "jobTitle": "Data Analyst",
        "company": "Snyk",
        "description": "Snyk is looking for a data analyst. Turn product and business questions into dashboards and analyses that guide decisions.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 37200,
        "requirements": [
            "SQL",
            "Tableau",
            "Excel",
            "Statistics"
        ],
        "url": "https://snyk.io/careers/"
    },
    {
        "jobTitle": "Machine Learning Engineer",
        "company": "Armis",
        "description": "Armis is looking for a machine learning engineer. Build and deploy models in production, own training pipelines and work alongside research.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 38500,
        "requirements": [
            "Python",
            "PyTorch",
            "MLOps",
            "Docker"
        ],
        "url": "https://www.armis.com/careers/"
    },
    {
        "jobTitle": "Senior Machine Learning Engineer",
        "company": "Wix",
        "description": "Wix is looking for a senior machine learning engineer. Lead applied ML for ranking and personalisation, from experimentation to production serving.",
        "seniority": "senior",
        "location": "Tel Aviv",
        "salary": 51800,
        "requirements": [
            "Python",
            "TensorFlow",
            "Ranking",
            "Kubernetes"
        ],
        "url": "https://www.wix.com/jobs/careers"
    },
    {
        "jobTitle": "Data Scientist",
        "company": "Monday.com",
        "description": "Monday.com is looking for a data scientist. Design experiments, build predictive models and communicate findings to product teams.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 41100,
        "requirements": [
            "Python",
            "Statistics",
            "SQL",
            "Machine learning"
        ],
        "url": "https://monday.com/careers/positions"
    },
    {
        "jobTitle": "Mobile Developer",
        "company": "Riskified",
        "description": "Riskified is looking for a mobile developer. Build and ship features for a React Native application used across iOS and Android.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 42400,
        "requirements": [
            "React Native",
            "TypeScript",
            "iOS",
            "Android"
        ],
        "url": "https://www.riskified.com/careers/"
    },
    {
        "jobTitle": "iOS Engineer",
        "company": "Lemonade",
        "description": "Lemonade is looking for a ios engineer. Own core screens of a native iOS app, focusing on smooth interactions and offline behaviour.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 43700,
        "requirements": [
            "Swift",
            "SwiftUI",
            "iOS"
        ],
        "url": "https://www.lemonade.com/careers"
    },
    {
        "jobTitle": "Android Engineer",
        "company": "Fiverr",
        "description": "Fiverr is looking for a android engineer. Build native Android features and improve startup performance across a large user base.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 32000,
        "requirements": [
            "Kotlin",
            "Android",
            "Jetpack Compose"
        ],
        "url": "https://www.fiverr.com/lp/careers"
    },
    {
        "jobTitle": "Security Engineer",
        "company": "Payoneer",
        "description": "Payoneer is looking for a security engineer. Harden services and infrastructure, run threat modelling and support incident response.",
        "seniority": "senior",
        "location": "Petah Tikva",
        "salary": 58300,
        "requirements": [
            "AppSec",
            "Threat modelling",
            "Cloud security"
        ],
        "url": "https://www.payoneer.com/careers/"
    },
    {
        "jobTitle": "Cyber Security Analyst",
        "company": "Similarweb",
        "description": "Similarweb is looking for a cyber security analyst. Monitor and triage alerts in the SOC, investigate incidents and improve detection coverage.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 34600,
        "requirements": [
            "SIEM",
            "Incident response",
            "Networking"
        ],
        "url": "https://www.similarweb.com/corp/careers/"
    },
    {
        "jobTitle": "Cloud Engineer",
        "company": "JFrog",
        "description": "JFrog is looking for a cloud engineer. Design and operate cloud infrastructure, focusing on cost, scalability and security.",
        "seniority": "mid",
        "location": "Netanya",
        "salary": 35900,
        "requirements": [
            "AWS",
            "Terraform",
            "Networking"
        ],
        "url": "https://jfrog.com/careers/"
    },
    {
        "jobTitle": "Platform Engineer",
        "company": "Cellebrite",
        "description": "Cellebrite is looking for a platform engineer. Build the internal developer platform: build systems, deployment tooling and golden paths.",
        "seniority": "senior",
        "location": "Petah Tikva",
        "salary": 62200,
        "requirements": [
            "Kubernetes",
            "Go",
            "CI/CD",
            "Developer experience"
        ],
        "url": "https://cellebrite.com/en/careers/"
    },
    {
        "jobTitle": "Product Manager",
        "company": "Verbit",
        "description": "Verbit is looking for a product manager. Own a product area end to end: discovery, prioritisation, and working with engineering to ship.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 38500,
        "requirements": [
            "Product discovery",
            "Roadmapping",
            "Analytics"
        ],
        "url": "https://verbit.ai/careers/"
    },
    {
        "jobTitle": "Technical Product Manager",
        "company": "Kaltura",
        "description": "Kaltura is looking for a technical product manager. Own developer-facing APIs and platform capabilities, working closely with backend teams.",
        "seniority": "senior",
        "location": "Ramat Gan",
        "salary": 64800,
        "requirements": [
            "APIs",
            "Technical writing",
            "Roadmapping"
        ],
        "url": "https://corp.kaltura.com/careers/"
    },
    {
        "jobTitle": "UX Designer",
        "company": "Outbrain",
        "description": "Outbrain is looking for a ux designer. Research, prototype and design flows for a complex product used by professionals daily.",
        "seniority": "mid",
        "location": "Netanya",
        "salary": 41100,
        "requirements": [
            "Figma",
            "User research",
            "Prototyping"
        ],
        "url": "https://www.outbrain.com/careers/"
    },
    {
        "jobTitle": "Product Designer",
        "company": "Taboola",
        "description": "Taboola is looking for a product designer. Own the end-to-end design of new features, from concept through to shipped interface.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 42400,
        "requirements": [
            "Figma",
            "Design systems",
            "Interaction design"
        ],
        "url": "https://www.taboola.com/careers"
    },
    {
        "jobTitle": "Engineering Manager",
        "company": "Gong",
        "description": "Gong is looking for a engineering manager. Lead a team of engineers, own delivery and grow people through coaching and feedback.",
        "seniority": "manager",
        "location": "Ramat Gan",
        "salary": 77700,
        "requirements": [
            "People management",
            "Delivery",
            "Architecture"
        ],
        "url": "https://www.gong.io/careers/"
    },
    {
        "jobTitle": "Solutions Architect",
        "company": "Snyk",
        "description": "Snyk is looking for a solutions architect. Design customer-facing technical solutions and support enterprise integrations.",
        "seniority": "senior",
        "location": "Remote",
        "salary": 53000,
        "requirements": [
            "Architecture",
            "Cloud",
            "Pre-sales"
        ],
        "url": "https://snyk.io/careers/"
    },
    {
        "jobTitle": "Business Intelligence Developer",
        "company": "Armis",
        "description": "Armis is looking for a business intelligence developer. Build the reporting layer: models, dashboards and self-service analytics for the business.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 33300,
        "requirements": [
            "SQL",
            "Power BI",
            "dbt",
            "Data modelling"
        ],
        "url": "https://www.armis.com/careers/"
    },
    {
        "jobTitle": "Automation Engineer",
        "company": "Wix",
        "description": "Wix is looking for a automation engineer. Automate internal operations and testing workflows to reduce manual effort across teams.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 34600,
        "requirements": [
            "Python",
            "Automation",
            "CI/CD"
        ],
        "url": "https://www.wix.com/jobs/careers"
    },
    {
        "jobTitle": "Support Engineer",
        "company": "Monday.com",
        "description": "Monday.com is looking for a support engineer. Resolve complex technical issues for customers and feed recurring problems back into the product.",
        "seniority": "junior",
        "location": "Tel Aviv",
        "salary": 24900,
        "requirements": [
            "Debugging",
            "SQL",
            "Customer communication"
        ],
        "url": "https://monday.com/careers/positions"
    },
    {
        "jobTitle": "Technical Writer",
        "company": "Riskified",
        "description": "Riskified is looking for a technical writer. Own developer documentation: guides, API references and release notes.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 37200,
        "requirements": [
            "Technical writing",
            "APIs",
            "Markdown"
        ],
        "url": "https://www.riskified.com/careers/"
    },
    {
        "jobTitle": "Embedded Software Engineer",
        "company": "Lemonade",
        "description": "Lemonade is looking for a embedded software engineer. Develop firmware for connected devices, working close to the hardware.",
        "seniority": "mid",
        "location": "Remote",
        "salary": 38500,
        "requirements": [
            "C",
            "C++",
            "RTOS",
            "Embedded"
        ],
        "url": "https://www.lemonade.com/careers"
    },
    {
        "jobTitle": "Algorithm Engineer",
        "company": "Fiverr",
        "description": "Fiverr is looking for a algorithm engineer. Design and optimise algorithms for computer-vision and signal-processing pipelines.",
        "seniority": "senior",
        "location": "Tel Aviv",
        "salary": 60800,
        "requirements": [
            "C++",
            "Python",
            "Computer vision",
            "Algorithms"
        ],
        "url": "https://www.fiverr.com/lp/careers"
    },
    {
        "jobTitle": "Performance Engineer",
        "company": "Payoneer",
        "description": "Payoneer is looking for a performance engineer. Profile and optimise services and clients, owning latency and throughput targets.",
        "seniority": "senior",
        "location": "Petah Tikva",
        "salary": 62100,
        "requirements": [
            "Profiling",
            "Node.js",
            "Benchmarking"
        ],
        "url": "https://www.payoneer.com/careers/"
    },
    {
        "jobTitle": "Integration Engineer",
        "company": "Similarweb",
        "description": "Similarweb is looking for a integration engineer. Build and maintain integrations with third-party systems and partner APIs.",
        "seniority": "mid",
        "location": "Tel Aviv",
        "salary": 42400,
        "requirements": [
            "REST APIs",
            "Node.js",
            "Webhooks"
        ],
        "url": "https://www.similarweb.com/corp/careers/"
    },
    {
        "jobTitle": "Junior Data Analyst",
        "company": "JFrog",
        "description": "JFrog is looking for a junior data analyst. Support reporting and analysis, building dashboards and answering business questions.",
        "seniority": "junior",
        "location": "Netanya",
        "salary": 24700,
        "requirements": [
            "SQL",
            "Excel",
            "Curiosity"
        ],
        "url": "https://jfrog.com/careers/"
    }
];
