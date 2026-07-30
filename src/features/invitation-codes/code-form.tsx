"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { generateInvitationCode, type CodeState } from "./actions";

const initial: CodeState = {};

export function InvitationCodeForm() {
  const [state, action, pending] = useActionState(generateInvitationCode, initial);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.code) return;
    await navigator.clipboard.writeText(state.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form action={action} className="panel teacher-form">
      <div className="field">
        <label>Teacher access duration</label>
        <div className="fixed-duration">
          <strong>30 days</strong>
          <span>Fixed for every invitation code</span>
        </div>
        <small>The code expires after two days. After redemption, the student has access to this teacher for exactly 30 days.</small>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.code && (
        <div className="generated-code" role="status">
          <div>
            <small>New one-time code · valid for 2 days</small>
            <strong>{state.code}</strong>
            <p>Copy it now. Only its secure hash is stored.</p>
          </div>
          <button type="button" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "Generating…" : "Generate secure code"}</button>
      </div>
    </form>
  );
}
