export interface QuilvertResult {
  text: string;
  error: string | null;
}

export function trim(text: string): QuilvertResult {
  return { text: text.trim(), error: null };
}

export function collapseWhitespace(text: string): QuilvertResult {
  const collapsed = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: collapsed, error: null };
}

export function prettifyJSON(text: string): QuilvertResult {
  try {
    return { text: JSON.stringify(JSON.parse(text), null, 2), error: null };
  } catch {
    return { text, error: "Not valid JSON." };
  }
}

export function minifyJSON(text: string): QuilvertResult {
  try {
    return { text: JSON.stringify(JSON.parse(text)), error: null };
  } catch {
    return { text, error: "Not valid JSON." };
  }
}
