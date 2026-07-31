export type DependencyGraphResult = {
    readonly orderedCapabilityIds: readonly string[];
    readonly cycles: readonly (readonly string[])[];
};

export type TopoSortResult = {
    readonly ordered: readonly string[];
    readonly cycles: readonly (readonly string[])[];
};
