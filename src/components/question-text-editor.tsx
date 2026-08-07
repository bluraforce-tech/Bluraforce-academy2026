"use client";

import { useEffect, useRef } from "react";

type Props = { value: string; onChange: (value: string) => void; name?: string; required?: boolean };
const tools = [
  { label: "Bold", command: "bold", icon: <b>B</b> },
  { label: "Italic", command: "italic", icon: <i>I</i> },
  { label: "Underline", command: "underline", icon: <u>U</u> },
  { label: "Strikethrough", command: "strikeThrough", icon: <s>S</s> },
] as const;

export function QuestionTextEditor({ value, onChange, name, required = false }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = editor.current;
    if (!element || document.activeElement === element) return;
    if (/<\/?(?:b|strong|i|em|u|s|strike|div|p|br)\b/i.test(value)) element.innerHTML = value;
    else element.textContent = value;
  }, [value]);
  const update = () => onChange(editor.current?.innerHTML ?? "");
  const format = (command: string) => {
    editor.current?.focus();
    document.execCommand(command, false);
    update();
  };
  return <div className="question-text-editor">
    <div className="writing-tools" role="toolbar" aria-label="Question writing tools">{tools.map(tool => <button type="button" key={tool.label} aria-label={tool.label} title={tool.label} onMouseDown={event=>event.preventDefault()} onClick={()=>format(tool.command)}>{tool.icon}</button>)}</div>
    <div ref={editor} className="question-rich-input" contentEditable role="textbox" aria-multiline="true" aria-required={required} onInput={update} onPaste={event=>{event.preventDefault();document.execCommand("insertText",false,event.clipboardData.getData("text/plain"));update();}} suppressContentEditableWarning />
    {name&&<input type="hidden" name={name} value={value}/>}
  </div>;
}
