/** Source bodies sometimes already contain the heading that our renderer supplies. */
export function statblockBody(name: string, description: string): string {
  const prefix = `${name.trim()}.`;
  return description.trimStart().toLowerCase().startsWith(prefix.toLowerCase())
    ? description.trimStart().slice(prefix.length).trimStart() : description;
}
