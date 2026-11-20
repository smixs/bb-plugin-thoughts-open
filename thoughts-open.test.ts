// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOpenMode, keepThoughtsOpen, rowKind, setModeWriter, setOpenMode, toggleOpenMode } from "./thoughts-open";

// A small stand-in for bb's timeline: rows carry data-timeline-row-id and own a
// toggle button with aria-expanded. A group renders its child rows only while open.
const T = "thr_demo";
const thoughtId = (n: number) => `${T}:op:reasoning:kind:reasoning|turn:x-t1|parent:root|item:x-i${n}`;
const commandId = (n: number) => `${T}:x-t1:command:x-i${n}`;
const groupId = (first: string) => `${T}:x-t1:work-summary:${first}`;

function row(id: string, opts: { open?: boolean; body?: string } = {}): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-timeline-row-id", id);
  const toggle = document.createElement("button");
  toggle.setAttribute("aria-expanded", String(opts.open ?? false));
  toggle.textContent = "Thought";
  const body = document.createElement("div");
  body.className = "max-h-80 overflow-auto";
  body.textContent = opts.body ?? "reasoning text";
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
  });
  body.hidden = !(opts.open ?? false);
  el.append(toggle, body);
  return el;
}

function group(id: string, label: string, children: () => HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-timeline-row-id", id);
  const toggle = document.createElement("button");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = label;
  const list = document.createElement("div");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    list.replaceChildren(...(open ? children() : []));
  });
  el.append(toggle, list);
  return el;
}

const toggleOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-timeline-row-id="${CSS.escape(id)}"] > button`)!;
const isOpen = (id: string) => toggleOf(id).getAttribute("aria-expanded") === "true";

function userClick(el: HTMLElement) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "isTrusted", { value: true });
  el.dispatchEvent(event);
}

const settle = async (ms = 120) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

let stop: (() => void) | null = null;

beforeEach(() => {
  setOpenMode(true);
  setModeWriter(null);
  document.body.replaceChildren();
  document.head.replaceChildren();
});

afterEach(() => {
  stop?.();
  stop = null;
});

describe("rowKind", () => {
  it("reads thought, group and other rows", () => {
    expect(rowKind(thoughtId(1))).toBe("reasoning");
    expect(rowKind(`${T}:x-t1:op:reasoning:r1`)).toBe("reasoning");
    expect(rowKind(groupId(thoughtId(1)))).toBe("group");
    expect(rowKind(groupId(commandId(1)))).toBe("group");
    expect(rowKind(commandId(1))).toBe("other");
    expect(rowKind(`${T}:x-t1:assistant:m1`)).toBe("other");
    expect(rowKind(`${T}:x-t1:op:reasoningx:r1`)).toBe("other");
  });
});

describe("keepThoughtsOpen", () => {
  it("opens every Thought row and lifts the height cap", async () => {
    document.body.append(row(thoughtId(1)), row(commandId(2)), row(thoughtId(3)));
    stop = keepThoughtsOpen();
    await settle();

    expect(isOpen(thoughtId(1))).toBe(true);
    expect(isOpen(thoughtId(3))).toBe(true);
    expect(isOpen(commandId(2))).toBe(false);
    expect(document.querySelectorAll("[data-thoughts-open-body]")).toHaveLength(2);
    expect(document.getElementById("thoughts-open-style")).not.toBeNull();
  });

  it("opens a Thought row that streams in later", async () => {
    stop = keepThoughtsOpen();
    await settle();
    document.body.append(row(thoughtId(7)));
    await settle();
    expect(isOpen(thoughtId(7))).toBe(true);
  });

  it("keeps a group open when it holds a Thought", async () => {
    const id = groupId(commandId(1));
    document.body.append(group(id, "Ran 1 command, thought", () => [row(commandId(1)), row(thoughtId(2))]));
    stop = keepThoughtsOpen();
    await settle();

    expect(isOpen(id)).toBe(true);
    expect(isOpen(thoughtId(2))).toBe(true);
  });

  it("closes a group again when it holds no Thought", async () => {
    const id = groupId(commandId(1));
    document.body.append(group(id, "Ran 2 commands", () => [row(commandId(1)), row(commandId(2))]));
    stop = keepThoughtsOpen();
    await settle();

    expect(isOpen(id)).toBe(false);
  });

  it("looks into a group again when its header changes", async () => {
    const id = groupId(commandId(1));
    let rows = () => [row(commandId(1)), row(commandId(2))];
    const el = group(id, "Ran 2 commands", () => rows());
    document.body.append(el);
    stop = keepThoughtsOpen();
    await settle();
    expect(isOpen(id)).toBe(false);

    rows = () => [row(commandId(1)), row(commandId(2)), row(thoughtId(3))];
    toggleOf(id).textContent = "Ran 2 commands, thought";
    await settle();
    expect(isOpen(id)).toBe(true);
    expect(isOpen(thoughtId(3))).toBe(true);
  });

  it("leaves a Thought the user folded by hand", async () => {
    document.body.append(row(thoughtId(1)));
    stop = keepThoughtsOpen();
    await settle();
    expect(isOpen(thoughtId(1))).toBe(true);

    userClick(toggleOf(thoughtId(1)));
    await settle();
    expect(isOpen(thoughtId(1))).toBe(false);
  });

  it("gives up after three forced opens of one row", async () => {
    document.body.append(row(thoughtId(1)));
    const toggle = toggleOf(thoughtId(1));
    let clicks = 0;
    toggle.addEventListener("click", () => {
      clicks += 1;
      // The host folds the row straight back, every time.
      queueMicrotask(() => toggle.setAttribute("aria-expanded", "false"));
    });
    stop = keepThoughtsOpen();
    await settle(400);
    expect(clicks).toBe(3);
  });

  it("removes its style, marks and listeners on dispose", async () => {
    document.body.append(row(thoughtId(1)));
    stop = keepThoughtsOpen();
    await settle();
    stop();
    stop = null;

    expect(document.getElementById("thoughts-open-style")).toBeNull();
    expect(document.querySelectorAll("[data-thoughts-open-body]")).toHaveLength(0);
    document.body.append(row(thoughtId(2)));
    await settle();
    expect(isOpen(thoughtId(2))).toBe(false);
  });
});

describe("folded mode", () => {
  it("folds open Thought rows and leaves other rows", async () => {
    document.body.append(row(thoughtId(1), { open: true }), row(commandId(2), { open: true }));
    setOpenMode(false);
    stop = keepThoughtsOpen();
    await settle();

    expect(isOpen(thoughtId(1))).toBe(false);
    expect(isOpen(commandId(2))).toBe(true);
  });

  it("folds a group the plugin opened when the mode flips", async () => {
    const id = groupId(commandId(1));
    document.body.append(group(id, "Ran 1 command, thought", () => [row(commandId(1)), row(thoughtId(2))]));
    stop = keepThoughtsOpen();
    await settle();
    expect(isOpen(id)).toBe(true);

    setOpenMode(false);
    await settle();
    expect(isOpen(id)).toBe(false);

    setOpenMode(true);
    await settle();
    expect(isOpen(id)).toBe(true);
    expect(isOpen(thoughtId(2))).toBe(true);
  });

  it("re-applies the mode to rows the user toggled by hand", async () => {
    document.body.append(row(thoughtId(1)));
    stop = keepThoughtsOpen();
    await settle();
    userClick(toggleOf(thoughtId(1)));
    await settle();
    expect(isOpen(thoughtId(1))).toBe(false);

    setOpenMode(false);
    await settle();
    setOpenMode(true);
    await settle();
    expect(isOpen(thoughtId(1))).toBe(true);
  });

  it("lets the user open one Thought while the rest stay folded", async () => {
    document.body.append(row(thoughtId(1)), row(thoughtId(2)));
    setOpenMode(false);
    stop = keepThoughtsOpen();
    await settle();

    userClick(toggleOf(thoughtId(1)));
    await settle();
    expect(isOpen(thoughtId(1))).toBe(true);
    expect(isOpen(thoughtId(2))).toBe(false);
  });

  it("toggleOpenMode flips the mode and hands it to the writer", () => {
    const written: boolean[] = [];
    setModeWriter((open) => written.push(open));
    toggleOpenMode();
    expect(getOpenMode()).toBe(false);
    toggleOpenMode();
    expect(getOpenMode()).toBe(true);
    expect(written).toEqual([false, true]);
  });
});
