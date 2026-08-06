import type { ProfileInput } from "../../../routes/conversation/conversation.types";
import { mergeUniqueStrings, readStringArray } from "./profile-field.utils";
import type { ProfileListsContext } from "./profile-lists.types";

export const resolveProfileLists = (
    serverUser: Record<string, unknown>,
    profile?: ProfileInput | null
): ProfileListsContext => ({
    technologies: mergeUniqueStrings(readStringArray(serverUser.technologies), profile?.technologies ?? []),
    interests: mergeUniqueStrings(readStringArray(serverUser.interests), profile?.interests ?? []),
    knownSkills: mergeUniqueStrings(readStringArray(serverUser.knownSkills), profile?.knownSkills ?? []),
    githubSkills: mergeUniqueStrings(readStringArray(serverUser.githubSkills), profile?.githubSkills ?? []),
});
