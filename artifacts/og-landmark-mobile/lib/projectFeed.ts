export type PublicProjectRecord = { id: string | number };

/** Merge preview Admin records over the live list so local edits take precedence. */
export function mergePublicProjects<T extends PublicProjectRecord>(live: T[], preview: T[]): T[] {
  const projects = new Map<string, T>();
  for (const project of live) projects.set(String(project.id), project);
  for (const project of preview) projects.set(String(project.id), project);
  return [...projects.values()];
}
