// Shows every reasoning ("Thought") row of every provider open and in full, or
// folds them all, by one mode switch.
//
// Open mode, in each open thread:
// - a Thought row with a closed toggle is opened;
// - bb folds finished thoughts into work groups ("Ran 3 commands"). A closed
//   group hides its rows, so the plugin opens each group once to look inside.
//   A group that holds a Thought stays open; any other group is closed again.
//   A group is looked at again when its header text changes (new rows joined);
// - the Thought body loses its 20rem height cap, so the text is not scrolled.
//
// Folded mode: open Thought rows fold, and open groups that hold a Thought fold.
//
// The user's own clicks win: a Thought or group the user toggled by hand is
// left alone until the mode changes. A mode change applies to every row again.
//
// The rules rest on bb's timeline DOM: data-timeline-row-id, row ids with
// "op:reasoning" and "work-summary", aria-expanded toggles and the body class
// max-h-80. A bb update that renames them turns this into a no-op.

const ROW = "data-timeline-row-id";
const TOGGLE = "button[aria-expanded], [role='button'][aria-expanded]";
const BODY_MARK = "data-thoughts-open-body";
const STYLE_ID = "thoughts-open-style";
const CSS = `[${BODY_MARK}]{max-height:none!important;overflow:visible!important}`;

/** Forced opens per row before the plugin gives up on it (guards against a click loop). */
const MAX_FORCED = 3;
/** Frames to wait for an opened group to render its rows. */
const PROBE_FRAMES = 20;

const MODE_CACHE = "thoughts-open:mode";

let openMode = readCachedMode();
let modeWriter: ((open: boolean) => void) | null = null;
const modeListeners = new Set<() => void>();

/** The current mode: true shows Thought rows open, false folds them. */
export function getOpenMode(): boolean {
  return openMode;
}

/** Applies a mode read from the server or picked by the user. */
export function setOpenMode(open: boolean): void {
  if (open === openMode) return;
  openMode = open;
  try {
    localStorage.setItem(MODE_CACHE, open ? "open" : "folded");
  } catch {
    // Storage can be unavailable; the server keeps the mode anyway.
  }
  for (const listener of modeListeners) listener();
}

/** Calls the listener after every mode change. Returns the unsubscribe function. */
export function onModeChange(listener: () => void): () => void {
  modeListeners.add(listener);
  return () => modeListeners.delete(listener);
}

/** Set by the app: saves a new mode on the server. */
export function setModeWriter(writer: ((open: boolean) => void) | null): void {
  modeWriter = writer;
}

/** Flips the mode, saving it on the server when the app is ready. */
export function toggleOpenMode(): void {
  const next = !openMode;
  setOpenMode(next);
  modeWriter?.(next);
}

function readCachedMode(): boolean {
  try {
    return localStorage.getItem(MODE_CACHE) !== "folded";
  } catch {
    return true;
  }
}

export type RowKind = "reasoning" | "group" | "other";

/** Kind of a timeline row, read from its id. A group id embeds its first child's id, so it is checked first. */
export function rowKind(id: string): RowKind {
  if (/(^|:)work-summary:/.test(id)) return "group";
  if (/(^|:)op:reasoning(:|$)/.test(id)) return "reasoning";
  return "other";
}

interface Probe {
  signature: string;
  /** "pending" while waiting for rows, then the verdict. */
  state: "pending" | "keep" | "closed";
  frames: number;
}

export function keepThoughtsOpen(): () => void {
  const userTouched = new Set<string>();
  const forced = new Map<string, number>();
  const probes = new Map<string, Probe>();
  const marked = new Set<HTMLElement>();
  let frame = 0;
  let stopped = false;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  const schedule = () => {
    if (frame || stopped) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!stopped) sync();
    });
  };

  // A trusted click (mouse or keyboard) on a row's own toggle hands that row to the user.
  const onClick = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest(TOGGLE);
    const row = toggle?.closest(`[${ROW}]`);
    if (!toggle || !row || toggleOf(row as HTMLElement) !== toggle) return;
    const id = row.getAttribute(ROW) ?? "";
    if (rowKind(id) !== "other") userTouched.add(id);
  };
  document.addEventListener("click", onClick, true);

  // A mode change hands every row back to the plugin.
  const onModeChange = () => {
    userTouched.clear();
    forced.clear();
    probes.clear();
    schedule();
  };
  modeListeners.add(onModeChange);

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded"],
  });
  schedule();

  function sync() {
    let waiting = false;
    for (const row of document.querySelectorAll<HTMLElement>(`[${ROW}]`)) {
      const id = row.getAttribute(ROW) ?? "";
      const kind = rowKind(id);
      if (kind === "reasoning") {
        markBody(row);
        if (!userTouched.has(id)) setRow(row, id, openMode);
      } else if (kind === "group" && !userTouched.has(id)) {
        if (openMode) {
          if (handleGroup(row, id)) waiting = true;
        } else {
          foldGroup(row, id);
        }
      }
    }
    for (const el of marked) if (!el.isConnected) marked.delete(el);
    if (waiting) schedule();
  }

  function setRow(row: HTMLElement, id: string, open: boolean) {
    const toggle = toggleOf(row);
    if (!toggle || isOpen(toggle) === open) return;
    const count = forced.get(id) ?? 0;
    if (count >= MAX_FORCED) return;
    forced.set(id, count + 1);
    toggle.click();
  }

  /** Returns true while a probe still waits for the group's rows. */
  function handleGroup(row: HTMLElement, id: string): boolean {
    const toggle = toggleOf(row);
    if (!toggle) return false;
    const signature = (toggle.textContent ?? "").trim();
    const probe = probes.get(id);

    if (probe?.state === "pending") {
      if (!isOpen(toggle)) {
        probes.delete(id);
        return false;
      }
      const inner = row.querySelectorAll(`[${ROW}]`);
      const hasThought = [...inner].some((r) => rowKind(r.getAttribute(ROW) ?? "") === "reasoning");
      if (hasThought) {
        probe.state = "keep";
        return false;
      }
      if (inner.length === 0 && probe.frames < PROBE_FRAMES) {
        probe.frames += 1;
        return true;
      }
      probe.state = "closed";
      toggle.click();
      return false;
    }

    if (isOpen(toggle)) return false;
    if (probe && probe.signature === signature) {
      if (probe.state === "keep") setRow(row, id, true);
      return false;
    }
    probes.set(id, { signature, state: "pending", frames: 0 });
    toggle.click();
    return true;
  }

  /** Folded mode: an open group that holds a Thought folds. */
  function foldGroup(row: HTMLElement, id: string) {
    const toggle = toggleOf(row);
    if (!toggle || !isOpen(toggle)) return;
    const hasThought = [...row.querySelectorAll(`[${ROW}]`)].some(
      (r) => rowKind(r.getAttribute(ROW) ?? "") === "reasoning",
    );
    if (hasThought) setRow(row, id, false);
  }

  function markBody(row: HTMLElement) {
    for (const el of row.querySelectorAll<HTMLElement>(".max-h-80")) {
      if (el.closest(`[${ROW}]`) !== row || el.hasAttribute(BODY_MARK)) continue;
      el.setAttribute(BODY_MARK, "");
      marked.add(el);
    }
  }

  return () => {
    stopped = true;
    modeListeners.delete(onModeChange);
    observer.disconnect();
    document.removeEventListener("click", onClick, true);
    if (frame) cancelAnimationFrame(frame);
    for (const el of marked) el.removeAttribute(BODY_MARK);
    for (const el of document.querySelectorAll(`[${BODY_MARK}]`)) el.removeAttribute(BODY_MARK);
    marked.clear();
    style.remove();
    userTouched.clear();
    forced.clear();
    probes.clear();
  };
}

/** The row's own toggle, skipping toggles of rows nested inside it. */
function toggleOf(row: HTMLElement): HTMLElement | null {
  for (const el of row.querySelectorAll<HTMLElement>(TOGGLE)) {
    if (el.closest(`[${ROW}]`) === row) return el;
  }
  return null;
}

function isOpen(toggle: HTMLElement): boolean {
  return toggle.getAttribute("aria-expanded") === "true";
}
