---
name: thoughts-open
description: How the Thoughts Open bb plugin shows every Thought (reasoning) row expanded and in full or folds them all from one thread header button, and how to tell it is working. Use when a user asks why Thought rows open or fold on their own, how to flip or remove that, or whether the plugin still works after a bb update.
---

# Thoughts Open

The plugin runs in the open bb app. Its mode is one switch saved on the bb server:

- the thread header button reads **Thoughts: open** or **Thoughts: folded**; a click flips the mode for every thread and window. The command palette entry **Thoughts: show or fold** does the same;
- in open mode every Thought row of every provider opens on its own;
- a work group that holds a Thought opens; other groups open for a moment, are checked and close again;
- the Thought text has no height cap, so it is not scrolled inside the row;
- in folded mode open Thought rows fold, and groups that hold a Thought fold;
- a row or group the user toggled by hand is left alone until the mode changes.

The plugin has no CLI command. Remove the header button and all behavior with `bb plugin disable thoughts-open`.

It depends on bb's timeline markup (`data-timeline-row-id`, ids with `op:reasoning` and `work-summary`, `aria-expanded`, class `max-h-80`). After a bb update that renames them it silently stops working; check a thread with a Thought after updating bb.
