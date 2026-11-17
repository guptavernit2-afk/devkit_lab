// Iterative graph traversal keeps deeply chained settings off the call stack.
export function cycleMembers(settings) {
  const done = new Set();
  const cyclic = new Set();
  for (const root of settings.keys()) {
    if (done.has(root)) continue;
    const active = new Map();
    const stack = [{ key: root, next: 0 }];
    active.set(root, 0);
    while (stack.length) {
      const frame = stack.at(-1);
      const edges = settings.get(frame.key)?.references ?? [];
      if (frame.next >= edges.length) {
        done.add(frame.key);
        active.delete(frame.key);
        stack.pop();
        continue;
      }
      const target = edges[frame.next++];
      if (active.has(target)) {
        for (let i = active.get(target); i < stack.length; i++) cyclic.add(stack[i].key);
      } else if (settings.has(target) && !done.has(target)) {
        active.set(target, stack.length);
        stack.push({ key: target, next: 0 });
      }
    }
  }
  return cyclic;
}
