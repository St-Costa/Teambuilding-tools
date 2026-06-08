export function joinPath(base: string, ...parts: string[]): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const trimmed = base.replace(/[/\\]+$/, "");
  return [trimmed, ...parts].join(sep);
}
