import type { AmericanCategory } from "@/lib/education-target";

export function parseStudentAmericanCategory(value: string | undefined): AmericanCategory {
  return value === "sat" || value === "est" ? value : "classified";
}

export function withAmericanCategory(path: string, category: AmericanCategory) {
  return `${path}?category=${category}`;
}
