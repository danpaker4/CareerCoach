/** Markers that suggest a QA / testing identity (used to detect conflict and scrub stale skills). */
export const QA_ROLE_MARKERS: readonly string[] = [
    "qa",
    "quality assurance",
    "test automation",
    "automation engineer",
    "performance engineer",
    "performance test",
    "sdet",
    "quality engineer",
    "testing engineer",
];

export const SOFTWARE_ROLE_MARKERS: readonly string[] = [
    "software engineer",
    "software developer",
    "full stack",
    "fullstack",
    "backend engineer",
    "frontend engineer",
    "web developer",
    "swe",
];

/** Skill/achievement tokens removed when the user rejects a QA CV identity. */
export const QA_STALE_SKILL_MARKERS: readonly string[] = [
    "qa",
    "quality assurance",
    "selenium",
    "cypress",
    "playwright",
    "jmeter",
    "loadrunner",
    "testng",
    "junit",
    "pytest",
    "appium",
    "postman",
    "test automation",
    "automation test",
    "performance test",
    "lotem",
    "sdet",
    "manual testing",
    "regression test",
];
