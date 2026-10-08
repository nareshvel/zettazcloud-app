// Per-path breadcrumb label overrides for dynamic routes (e.g. /customers/:id
// should show the customer's name, not the raw UUID). Detail pages set a label
// for their own pathname on load; Breadcrumbs.tsx resolves it via
// useSyncExternalStore. Keys are full pathnames, so navigating between records
// never shows a stale name.

const labels = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

export function setBreadcrumbLabel(path: string, label: string | null): void {
  if (label == null) {
    labels.delete(path);
  } else {
    labels.set(path, label);
  }
  version++;
  listeners.forEach((fn) => fn());
}

export function getBreadcrumbLabel(path: string): string | undefined {
  return labels.get(path);
}

export function subscribeBreadcrumbLabels(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getBreadcrumbLabelsVersion(): number {
  return version;
}
