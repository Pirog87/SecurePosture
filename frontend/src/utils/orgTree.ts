import type { OrgUnitTreeNode } from "../types";

/** Flatten tree to a list with depth for select dropdowns */
export function flattenTree(nodes: OrgUnitTreeNode[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}

/** Build a path map: unitId -> "Pion1\Dzial2\Zespol3" */
export function buildPathMap(nodes: OrgUnitTreeNode[], parentPath = ""): Map<number, string> {
  const map = new Map<number, string>();
  for (const n of nodes) {
    const path = parentPath ? `${parentPath}\\${n.name}` : n.name;
    map.set(n.id, path);
    const childMap = buildPathMap(n.children, path);
    childMap.forEach((v, k) => map.set(k, v));
  }
  return map;
}

/** Collect all descendant IDs (inclusive) for hierarchical filtering */
export function collectDescendantIds(nodes: OrgUnitTreeNode[], targetId: number): number[] {
  const ids: number[] = [];

  function findAndCollect(tree: OrgUnitTreeNode[]): boolean {
    for (const n of tree) {
      if (n.id === targetId) {
        collectAll(n);
        return true;
      }
      if (findAndCollect(n.children)) return true;
    }
    return false;
  }

  function collectAll(node: OrgUnitTreeNode) {
    ids.push(node.id);
    for (const c of node.children) collectAll(c);
  }

  findAndCollect(nodes);
  return ids;
}
