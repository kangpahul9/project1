// Simple but effective guard layer

const BLOCKED_PATTERNS = [
  "ignore previous",
  "system prompt",
  "show database",
  "dump data",
  "password",
  "users",
  "schema",
  "tables",
  "other restaurant",
  "all restaurants",
  "admin access",
];

export function isMalicious(question = "") {
  const q = question.toLowerCase();
  return BLOCKED_PATTERNS.some((p) => q.includes(p));
}

export function isBusinessQuery(question = "") {
  const q = question.toLowerCase();

  const allowed = [
    "sale",
    "revenue",
    "order",
    "item",
    "sold",
    "expense",
    "cash",
    "drawer",
    "profit",
    "top",
    "today",
    "yesterday",
    "week",
    "month",
    "between",
  ];

  return allowed.some((k) => q.includes(k));
}