const newline = /\r\n?|\n|\u2028|\u2029/g;

export function countLines(string: string): number {
  return (string.match(newline) || []).length + 1;
}
