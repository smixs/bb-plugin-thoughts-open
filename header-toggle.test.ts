// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountHeaderToggle } from "./header-toggle";
import { getOpenMode, setModeWriter, setOpenMode } from "./thoughts-open";

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const toggles = () => [...document.querySelectorAll<HTMLButtonElement>("[data-thoughts-open-toggle]")];

function header(): HTMLElement {
  const el = document.createElement("header");
  const slot = document.createElement("div");
  slot.setAttribute("data-thread-header-workflow-actions", "");
  el.appendChild(slot);
  return el;
}

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

describe("mountHeaderToggle", () => {
  it("puts one toggle into each thread header, also into headers that appear later", async () => {
    document.body.append(header());
    stop = mountHeaderToggle();
    expect(toggles()).toHaveLength(1);

    document.body.append(header());
    await settle();
    expect(toggles()).toHaveLength(2);

    await settle();
    expect(toggles()).toHaveLength(2);
  });

  it("shows the mode with aria-pressed, a label and the dot", () => {
    document.body.append(header());
    stop = mountHeaderToggle();
    const [button] = toggles();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.title).toBe("Thoughts open, click to fold");
    expect(button.querySelector("[data-dot]")).not.toBeNull();
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("flips the mode on click, saves it and updates every toggle", () => {
    document.body.append(header(), header());
    const written: boolean[] = [];
    setModeWriter((open) => written.push(open));
    stop = mountHeaderToggle();

    toggles()[0].click();
    expect(getOpenMode()).toBe(false);
    expect(written).toEqual([false]);
    for (const button of toggles()) {
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.title).toBe("Thoughts folded, click to open");
    }
  });

  it("follows a mode change from elsewhere", () => {
    document.body.append(header());
    stop = mountHeaderToggle();
    setOpenMode(false);
    expect(toggles()[0].getAttribute("aria-pressed")).toBe("false");
  });

  it("removes its buttons and style on dispose", async () => {
    document.body.append(header());
    stop = mountHeaderToggle();
    stop();
    stop = null;
    expect(toggles()).toHaveLength(0);
    expect(document.getElementById("thoughts-open-toggle-style")).toBeNull();

    document.body.append(header());
    await settle();
    expect(toggles()).toHaveLength(0);
  });
});
