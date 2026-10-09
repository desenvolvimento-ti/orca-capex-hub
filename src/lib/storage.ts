// Supabase Storage only accepts a restricted ASCII charset in object keys
// (accents like "´", "ç", "ã" yield "Invalid key"). The original name is kept
// in project_documents.file_name; only the storage path is sanitized.
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._]+|[._]+$/g, "");
  const safeBase = clean(base).slice(0, 100) || "arquivo";
  const safeExt = clean(ext).slice(0, 10);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function projectDocPath(userId: string, projectId: string, file: File): string {
  return `${userId}/${projectId}/${Date.now()}-${sanitizeFileName(file.name)}`;
}
