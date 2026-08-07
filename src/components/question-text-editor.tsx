"use client";

import { useRef, type ReactNode } from "react";

type Props = { value: string; onChange: (value: string) => void; name?: string; required?: boolean; rows?: number };
type Tool = { label: string; open: string; close: string; icon: ReactNode };
const tools: Tool[] = [
  { label: "Bold", open: "**", close: "**", icon: <b>B</b> },
  { label: "Italic", open: "*", close: "*", icon: <i>I</i> },
  { label: "Underline", open: "[u]", close: "[/u]", icon: <u>U</u> },
  { label: "Strikethrough", open: "~~", close: "~~", icon: <s>S</s> },
];

export function QuestionTextEditor({ value, onChange, name, required = false, rows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const format = (tool: Tool) => {
    const input = ref.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    onChange(`${value.slice(0, start)}${tool.open}${value.slice(start, end)}${tool.close}${value.slice(end)}`);
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + tool.open.length, end + tool.open.length); });
  };
  return <div className="question-text-editor"><div className="writing-tools" role="toolbar" aria-label="Question writing tools">{tools.map(tool => <button type="button" key={tool.label} aria-label={tool.label} title={tool.label} onClick={() => format(tool)}>{tool.icon}</button>)}</div><textarea ref={ref} name={name} value={value} onChange={event => onChange(event.target.value)} rows={rows} required={required} /></div>;
}
