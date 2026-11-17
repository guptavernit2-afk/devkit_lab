// Iterative Kosaraju traversal supports deep chains and overlapping cycles.
export function cycleMembers(settings) {
  const edges = new Map([...settings].map(([key, entry]) => [key, entry.references.filter(name => settings.has(name))]));
  const reverse = new Map([...settings.keys()].map(key => [key, []]));
  for (const [key, targets] of edges) for (const target of targets) reverse.get(target).push(key);
  const visited = new Set();
  const order = [];
  for (const root of settings.keys()) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack = [{ key: root, next: 0 }];
    while (stack.length) {
      const frame = stack.at(-1);
      const targets = edges.get(frame.key);
      if (frame.next === targets.length) { order.push(frame.key); stack.pop(); continue; }
      const target = targets[frame.next++];
      if (!visited.has(target)) { visited.add(target); stack.push({ key: target, next: 0 }); }
    }
  }
  visited.clear();
  const cyclic = new Set();
  for (const root of order.reverse()) {
    if (visited.has(root)) continue;
    const members = [];
    const pending = [root];
    visited.add(root);
    while (pending.length) {
      const key = pending.pop();
      members.push(key);
      for (const target of reverse.get(key)) if (!visited.has(target)) { visited.add(target); pending.push(target); }
    }
    if (members.length > 1 || edges.get(root).includes(root)) for (const key of members) cyclic.add(key);
  }
  return cyclic;
}
// Only ${NAME} is supported. Literal dollars and escaped tokens are harmless.
export function inspectReferences(value) {
  const references = [];
  let unsupported = false;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\') { i++; continue; }
    if (value[i] !== '$') continue;
    if (value[i + 1] === '{') {
      const end = value.indexOf('}', i + 2);
      const name = value.slice(i + 2, end === -1 ? undefined : end);
      if (end !== -1 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) references.push(name);
      else unsupported = true;
      i = end === -1 ? value.length : end;
    } else if (/[A-Za-z_(]/.test(value[i + 1] ?? '')) {
      unsupported = true;
    }
  }
  return { references, unsupported };
}
