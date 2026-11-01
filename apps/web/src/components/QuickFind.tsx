"use client";

import { useRouter } from "next/navigation";
import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FindEntry, findEntries } from "@greecon/shared";

/**
 * Quick find (docs/29-apple-notion-standards.md): one box, opened from anywhere with Ctrl+K (Command+K on a Mac) or "/", or by the
 * Search button, that takes a person to a page, a site, a client or an action by what they remember of its name. It is a modal dialog
 * in the browser's own sense (`dialog`), so the page behind it is inert, Escape closes it and the focus goes back where it was.
 *
 * The pages and actions are known when the page is drawn. Sites and clients are asked for as the person types, from the server, through
 * `search`; the static demo has no server, and is given its sites as `extra` instead.
 */
export type QuickFindSearch = (query: string) => Promise<FindEntry[]>;

const OPEN_EVENT = "greecon:quick-find";
const ASK_AFTER_MS = 140;

/** Whether a key press is the person typing into something, so that "/" must be left to them. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || !element.tagName) return false;
  return element.isContentEditable || element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT";
}

function Magnifier() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

/** The button that opens quick find: a field-like row in the bar on a desk, a round icon in the top bar on a phone. */
export function QuickFindButton({ variant }: { variant: "sidebar" | "bar" }) {
  const [hint, setHint] = useState("");
  // The key to press is not known on the server, and what the server drew must be what the browser first draws.
  useEffect(() => {
    setHint(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K");
  }, []);

  return (
    <button type="button" className={`find-button find-button--${variant}`} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
      <Magnifier />
      <span className={variant === "bar" ? "visually-hidden" : "find-button__label"}>Search</span>
      {variant === "sidebar" && hint ? <kbd>{hint}</kbd> : null}
    </button>
  );
}

export function QuickFind({ pages, extra = [], search }: { pages: readonly FindEntry[]; extra?: readonly FindEntry[]; search?: QuickFindSearch }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const sequence = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly FindEntry[]>([]);
  const [answered, setAnswered] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const show = useCallback(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    setQuery("");
    setFound([]);
    setAnswered(null);
    setActive(0);
    element.showModal();
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const control = event.ctrlKey || event.metaKey;
      if (control && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      } else if (event.key === "/" && !control && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, [show]);

  // What the server knows (sites, clients, requests), asked for as the person types, and again for "nothing typed yet" each time the box
  // opens, which is the list of suggestions. A late answer to an earlier question is dropped.
  useEffect(() => {
    if (!search || !open) return;
    const ask = ++sequence.current;
    const timer = setTimeout(
      async () => {
        let result: readonly FindEntry[] = [];
        try {
          result = await search(query);
        } catch {
          // The pages and actions still work without the server's help.
        }
        if (ask !== sequence.current) return;
        setFound(result);
        setAnswered(query);
      },
      query === "" ? 0 : ASK_AFTER_MS
    );
    return () => clearTimeout(timer);
  }, [query, search, open]);

  const results = useMemo(() => {
    // For "nothing typed yet": what the server suggests (the sites that most need a look), then the pages.
    const all = [...found, ...extra, ...pages];
    const seen = new Set<string>();
    const unique = all.filter((entry) => (seen.has(entry.id) ? false : (seen.add(entry.id), true)));
    return findEntries(unique, query, 12);
  }, [found, extra, pages, query]);

  useEffect(() => {
    setActive(0);
  }, [query, results.length]);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const go = (entry: FindEntry) => {
    dialog.current?.close();
    router.push(entry.href);
  };

  const onFieldKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (results.length === 0 ? 0 : (current + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (results.length === 0 ? 0 : (current - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = results[active];
      if (entry) go(entry);
    }
  };

  const waiting = Boolean(search) && answered !== query;
  const announcement = results.length === 0 ? (waiting ? "Searching." : "Nothing found.") : `${results.length} ${results.length === 1 ? "result" : "results"}. Use the up and down arrow keys, then Enter.`;

  return (
    <dialog
      ref={dialog}
      className="find"
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // The dark area around the box is the dialog's own backdrop: a press there is "never mind".
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="find__panel">
        <div className="find__field">
          <Magnifier />
          <input
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${listId}-list`}
            aria-activedescendant={results.length > 0 ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages, sites and people"
            placeholder="Search pages, sites and people"
            value={query}
            maxLength={60}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onFieldKey}
          />
          <button type="button" className="button-ghost find__close" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <ul id={`${listId}-list`} role="listbox" aria-label="Results" className="find__results" aria-busy={waiting}>
          {results.map((entry, index) => (
            <li
              key={entry.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="find__result"
              onMouseMove={() => index !== active && setActive(index)}
              onClick={() => go(entry)}
            >
              <span className="find__main">
                <strong>{entry.label}</strong>
                {entry.detail ? <span>{entry.detail}</span> : null}
              </span>
              <span className="find__kind">{entry.kind}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 ? (
          <p className="find__empty">
            {waiting ? "Searching…" : `Nothing matches “${query.trim()}”. Try the name of a site or a place, or a page such as Alerts.`}
          </p>
        ) : null}
        <p className="find__hint" aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
        </p>
        <p className="visually-hidden" role="status">
          {announcement}
        </p>
      </div>
    </dialog>
  );
}
