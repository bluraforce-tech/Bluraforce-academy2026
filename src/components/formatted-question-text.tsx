import { Fragment, type ReactNode } from "react";

const formats = [
  { open: "**", close: "**", wrap: (children: ReactNode) => <strong>{children}</strong> },
  { open: "~~", close: "~~", wrap: (children: ReactNode) => <s>{children}</s> },
  { open: "[u]", close: "[/u]", wrap: (children: ReactNode) => <u>{children}</u> },
  { open: "*", close: "*", wrap: (children: ReactNode) => <em>{children}</em> },
] as const;
function renderText(value: string, key = "text"): ReactNode {
  let first: { index: number; format: (typeof formats)[number] } | null = null;
  for (const format of formats) { const index = value.indexOf(format.open); if (index >= 0 && (!first || index < first.index)) first = { index, format }; }
  if (!first) return value;
  const start = first.index + first.format.open.length, end = value.indexOf(first.format.close, start);
  if (end < 0) return value;
  return <Fragment key={key}>{renderText(value.slice(0, first.index), `${key}-before`)}{first.format.wrap(renderText(value.slice(start, end), `${key}-inside`))}{renderText(value.slice(end + first.format.close.length), `${key}-after`)}</Fragment>;
}
export function FormattedQuestionText({ text }: { text: string }) { return <>{renderText(text)}</>; }
