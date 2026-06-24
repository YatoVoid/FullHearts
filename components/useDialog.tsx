"use client";

import { useCallback, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";

interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: IconName;
}
interface PromptOpts {
  title: string;
  body?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  icon?: IconName;
}

type State =
  | { kind: "confirm"; opts: ConfirmOpts }
  | { kind: "prompt"; opts: PromptOpts; value: string }
  | null;

/**
 * Promise-based, on-theme replacements for window.confirm / window.prompt, so we
 * never show a generic browser dialog. Returns `confirm`/`prompt` (awaitable) and
 * a `dialog` element the caller renders once. Styled with the site's cmodal.
 */
export function useDialog() {
  const [state, setState] = useState<State>(null);
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const settle = useCallback((v: boolean | string | null) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    r?.(v);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((res) => {
        resolver.current = res as (v: unknown) => void;
        setState({ kind: "confirm", opts });
      }),
    []
  );

  const prompt = useCallback(
    (opts: PromptOpts) =>
      new Promise<string | null>((res) => {
        resolver.current = res as (v: unknown) => void;
        setState({ kind: "prompt", opts, value: opts.defaultValue ?? "" });
      }),
    []
  );

  const cancelValue = state?.kind === "confirm" ? false : null;

  const dialog = state && (
    <div className="cmodal-overlay" role="dialog" aria-modal="true" aria-label={state.opts.title} onClick={() => settle(cancelValue)}>
      <div className="cmodal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {state.opts.icon && <Icon name={state.opts.icon} size={15} />}
          {state.opts.icon ? " " : ""}
          {state.opts.title}
        </h3>
        {state.opts.body && <p className="cmodal-sub">{state.opts.body}</p>}

        {state.kind === "prompt" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = state.value.trim();
              settle(v ? v : null);
            }}
          >
            <div className="cmodal-new">
              <input
                className="cmodal-input"
                autoFocus
                value={state.value}
                placeholder={state.opts.placeholder}
                aria-label={state.opts.title}
                onChange={(e) => setState({ ...state, value: e.target.value })}
              />
              <button type="submit" className="btn-primary">{state.opts.confirmLabel ?? "Save"}</button>
            </div>
          </form>
        ) : (
          <div className="cmodal-actions">
            <button
              type="button"
              className={state.opts.danger ? "btn-danger" : "btn-primary"}
              onClick={() => settle(true)}
            >
              {state.opts.confirmLabel ?? "Confirm"}
            </button>
          </div>
        )}

        <button type="button" className="cmodal-cancel" onClick={() => settle(cancelValue)}>
          {state.kind === "confirm" ? state.opts.cancelLabel ?? "Cancel" : "Cancel"}
        </button>
      </div>
    </div>
  );

  return { confirm, prompt, dialog };
}
