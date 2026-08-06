import { CAPABILITY_CATALOG } from "../catalog/capability-catalog.consts";
import { getCapabilityDependencies } from "../catalog/capability-normalization";
import type { DependencyGraphResult, TopoSortResult } from "./capability-dependency-graph.types";

export const topologicalSortCapabilities = (
    capabilityIds: readonly string[],
    edges?: ReadonlyMap<string, readonly string[]>
): TopoSortResult => {
    const nodes = [...new Set(capabilityIds)];
    const dependencyMap = new Map<string, string[]>();
    for (const id of nodes) {
        const deps = edges?.get(id) ?? getCapabilityDependencies(id);
        dependencyMap.set(
            id,
            deps.filter((dep) => nodes.includes(dep) || (edges?.has(dep) ?? false))
        );
    }

    // Include explicit deps that may not be in the input set when using catalog edges
    for (const id of nodes) {
        const deps = edges?.get(id) ?? [...getCapabilityDependencies(id)];
        for (const dep of deps) {
            if (!dependencyMap.has(dep)) {
                dependencyMap.set(dep, [...(edges?.get(dep) ?? getCapabilityDependencies(dep))]);
            }
        }
    }

    const allNodes = [...dependencyMap.keys()];
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const node of allNodes) {
        inDegree.set(node, 0);
        dependents.set(node, []);
    }

    for (const [node, deps] of dependencyMap.entries()) {
        for (const dep of deps) {
            if (!inDegree.has(dep)) {
                inDegree.set(dep, 0);
                dependents.set(dep, []);
            }
            inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
            dependents.get(dep)?.push(node);
        }
    }

    const queue = allNodes.filter((node) => (inDegree.get(node) ?? 0) === 0);
    const ordered: string[] = [];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        ordered.push(current);
        for (const next of dependents.get(current) ?? []) {
            const nextDegree = (inDegree.get(next) ?? 0) - 1;
            inDegree.set(next, nextDegree);
            if (nextDegree === 0) queue.push(next);
        }
    }

    const remaining = allNodes.filter((node) => !ordered.includes(node));
    if (remaining.length === 0) {
        return { ordered, cycles: [] };
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    for (const start of remaining) {
        if (visited.has(start)) continue;
        const path: string[] = [];
        const stack = [start];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node === undefined || visited.has(node)) continue;
            visited.add(node);
            path.push(node);
            for (const dep of dependencyMap.get(node) ?? []) {
                if (remaining.includes(dep)) stack.push(dep);
            }
        }
        if (path.length > 0) cycles.push(path);
    }

    return { ordered: [...ordered, ...remaining], cycles };
};

export const buildCapabilityDependencyOrder = (
    capabilityIds: readonly string[]
): DependencyGraphResult => {
    const catalogEdges = new Map(
        CAPABILITY_CATALOG.map((capability) => [capability.id, capability.dependsOn] as const)
    );
    const result = topologicalSortCapabilities(capabilityIds, catalogEdges);
    return {
        orderedCapabilityIds: result.ordered,
        cycles: result.cycles,
    };
};
