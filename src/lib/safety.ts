// Safety keyword list — fast heuristic pre-screen only
// The LLM safety classifier is authoritative; these are a fast pre-screen

export const SAFETY_KEYWORDS = [
  "suicide",
  "kill myself",
  "end my life",
  "self-harm",
  "want to die",
  "hurt myself",
  "harm myself",
  "nothing to live for",
  "better off dead",
  "cut myself",
  "overdose",
  "crisis",
  "emergency",
  "kill me",
  "end it all",
  "no reason to live",
  "wish i were dead",
];

export function containsSafetyKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}
