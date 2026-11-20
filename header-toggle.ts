// The thread header toggle: a brain icon the size of bb's own header icons,
// with a dot while Thought rows are shown open. Clicking it flips the mode.
//
// bb's plugin SDK draws header actions as wide labelled buttons, so this one
// is placed by a content script into the header's workflow actions group,
// next to bb's icon buttons. If a bb update renames that group, the button
// does not appear; the plugin keeps working, and the thread menu entry and
// the command palette entry still flip the mode.

import { getOpenMode, onModeChange, toggleOpenMode } from "./thoughts-open";

const SLOT = "[data-thread-header-workflow-actions]";
const MARK = "data-thoughts-open-toggle";
const STYLE_ID = "thoughts-open-toggle-style";

// The same brain bb draws on Thought rows (data-icon="AiBrain01").
const BRAIN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4.5C5.34315 4.5 4 5.84315 4 7.5C4 8.06866 4.15822 8.60037 4.43304 9.0535C3.04727 9.31855 2 10.537 2 12C2 13.463 3.04727 14.6814 4.43304 14.9465M7 4.5C7 3.11929 8.11929 2 9.5 2C10.8807 2 12 3.11929 12 4.5V19.5C12 20.8807 10.8807 22 9.5 22C8.11929 22 7 20.8807 7 19.5C5.34315 19.5 4 18.1569 4 16.5C4 15.9313 4.15822 15.3996 4.43304 14.9465M7 4.5C7 5.31791 7.39278 6.04408 8 6.50018M4.43304 14.9465C4.78948 14.3588 5.34207 13.9032 6 13.6707" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/><path d="M17 19.4999C18.6569 19.4999 20 18.1567 20 16.4999C20 15.9312 19.8418 15.3995 19.567 14.9464C20.9527 14.6813 22 13.4629 22 11.9999C22 10.5369 20.9527 9.31843 19.567 9.05338M17 19.4999C17 20.8806 15.8807 21.9999 14.5 21.9999C13.1193 21.9999 12 20.8806 12 19.4999L12 4.49988C12 3.11917 13.1193 1.99988 14.5 1.99988C15.8807 1.99988 17 3.11917 17 4.49988C18.6569 4.49988 20 5.84302 20 7.49988C20 8.06854 19.8418 8.60024 19.567 9.05338M17 19.4999C17 18.682 16.6072 17.9558 16 17.4997M19.567 9.05338C19.2105 9.64109 18.6579 10.0966 18 10.3292" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/></svg>';

// Motion follows Emil Kowalski's rules: press feedback at scale(0.97) in
// 120ms, color in 150ms, the dot enters from scale(0.6) with a strong
// ease-out and never from scale(0). Hover is gated to fine pointers.
const CSS = `
[${MARK}]{all:unset;box-sizing:border-box;position:relative;font:inherit;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:6px;cursor:pointer;flex-shrink:0;color:var(--foreground);-webkit-tap-highlight-color:transparent;transition:color 150ms ease,background-color 150ms ease,transform 120ms ease-out}
[${MARK}][aria-pressed="false"]{color:var(--subtle-foreground,var(--muted-foreground));opacity:.75}
[${MARK}]:active{transform:scale(.97)}
[${MARK}]:focus-visible{outline:1px solid var(--ring);outline-offset:1px}
[${MARK}] svg{width:16px;height:16px;pointer-events:none}
[${MARK}] [data-dot]{position:absolute;top:5px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--timeline-accent,var(--primary,var(--ring,currentColor)));transition:transform 150ms cubic-bezier(0.23,1,0.32,1),opacity 150ms ease}
[${MARK}][aria-pressed="false"] [data-dot]{transform:scale(.6);opacity:0}
@media (hover:hover) and (pointer:fine){[${MARK}]:hover{background:var(--state-hover,color-mix(in oklab,var(--foreground) 14%,transparent));opacity:1}}
@media (pointer:coarse){[${MARK}]{width:36px;height:36px}[${MARK}] svg{width:20px;height:20px}}
`;

function label(open: boolean): string {
  return open ? "Thoughts open, click to fold" : "Thoughts folded, click to open";
}

function render(button: HTMLButtonElement, open: boolean) {
  button.setAttribute("aria-pressed", String(open));
  button.setAttribute("aria-label", label(open));
  button.title = label(open);
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(MARK, "");
  button.innerHTML = `${BRAIN}<span data-dot></span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleOpenMode();
  });
  render(button, getOpenMode());
  return button;
}

/** Keeps one toggle in every thread header on screen. Returns the disposer. */
export function mountHeaderToggle(): () => void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  let frame = 0;
  let stopped = false;

  const place = () => {
    for (const slot of document.querySelectorAll<HTMLElement>(SLOT)) {
      if (slot.querySelector(`[${MARK}]`)) continue;
      slot.appendChild(createButton());
    }
  };

  const schedule = () => {
    if (frame || stopped) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!stopped) place();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  const stopListening = onModeChange(() => {
    const open = getOpenMode();
    for (const button of document.querySelectorAll<HTMLButtonElement>(`[${MARK}]`)) render(button, open);
  });

  place();

  return () => {
    stopped = true;
    observer.disconnect();
    stopListening();
    if (frame) cancelAnimationFrame(frame);
    for (const button of document.querySelectorAll(`[${MARK}]`)) button.remove();
    style.remove();
  };
}
