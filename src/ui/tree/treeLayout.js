/* Assign stable vertical lanes to an evolution graph.
   Leaves receive consecutive lanes in lineage order; every ancestor sits at
   the centre of its visible children. A one-child lineage therefore remains
   perfectly horizontal instead of being re-sorted independently per tier. */
import { BRANCH_ORDER } from '../../data/branches.js';

const branchRank = branch => Number.isFinite(BRANCH_ORDER[branch]) ? BRANCH_ORDER[branch] : 999;

const compareNodes = (a, b) =>
  (branchRank(a.branch) - branchRank(b.branch)) ||
  a.name.localeCompare(b.name) ||
  a.id.localeCompare(b.id);

export function assignLineageRows(nodes) {
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  const parents = Object.fromEntries(nodes.map(node => [node.id, []]));
  const children = Object.fromEntries(nodes.map(node => [node.id, []]));

  for (const node of nodes) {
    for (const childId of node.evolvesTo || []) {
      if (!byId[childId]) continue;
      children[node.id].push(childId); parents[childId].push(node.id);
    }
    children[node.id].sort((a, b) => compareNodes(byId[a], byId[b]));
  }

  const roots = nodes.filter(node => parents[node.id].length === 0).sort(compareNodes);
  const row = {}; const visiting = new Set(); let nextLane = 0;
  const place = id => {
    if (Number.isFinite(row[id])) return row[id];
    // Species data should be acyclic, but this fallback keeps a malformed mod
    // from recursing forever and still gives its node a usable lane.
    if (visiting.has(id)) return (row[id] = nextLane++);
    visiting.add(id);
    const childRows = children[id].map(place);
    visiting.delete(id);
    row[id] = childRows.length ? (childRows[0] + childRows[childRows.length - 1]) / 2 : nextLane++;
    return row[id];
  };

  roots.forEach(root => place(root.id));
  // Also lay out disconnected/cyclic nodes deterministically.
  nodes.slice().sort(compareNodes).forEach(node => place(node.id));
  return { row, laneCount: Math.max(1, nextLane) };
}
