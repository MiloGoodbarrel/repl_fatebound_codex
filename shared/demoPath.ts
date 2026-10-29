/** Only the public simulation's document URLs; never an API or identity flag. */
export function isDemoPath(path: string, basePath = "") {
  const root = `${basePath.replace(/\/$/, "")}/dev`;
  return path === root || path.startsWith(`${root}/`);
}
export function isDemoDocument(method: string, path: string) {
  return (method === "GET" || method === "HEAD") && isDemoPath(path);
}
