// bb-plugin-thoughts-open: frontend entry.
//
// - A content script (thoughts-open.ts) opens or folds Thought rows.
// - A second content script (header-toggle.ts) puts a brain icon toggle into
//   every thread header.
// - A thread menu entry and a command palette entry flip the mode too.
//
// The mode lives on the bb server (server.ts). The thread menu entry's
// useData, which bb calls once for the whole app, reads it, follows the
// realtime channel, and hands it to the content scripts.
import { useCallback, useEffect, useState } from "react";
import { definePluginApp, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { mountHeaderToggle } from "./header-toggle";
import { getOpenMode, keepThoughtsOpen, setOpenMode, toggleOpenMode, setModeWriter } from "./thoughts-open";

const MODE_CHANGED = "thoughts-open-mode";

interface ModeData {
  open: boolean;
  toggle: () => void;
}

function useMode(): ModeData {
  const rpc = useRpc<typeof rpcContract>();
  const [open, setOpen] = useState<boolean>(getOpenMode);

  const refetch = useCallback(() => {
    rpc.call("mode_get").then(
      (result) => setOpen(result.open),
      () => undefined,
    );
  }, [rpc]);

  useEffect(refetch, [refetch]);
  useRealtime(MODE_CHANGED, refetch);
  useEffect(() => setOpenMode(open), [open]);

  useEffect(() => {
    setModeWriter((next) => {
      setOpen(next);
      rpc.call("mode_set", { open: next }).catch(refetch);
    });
    return () => setModeWriter(null);
  }, [rpc, refetch]);

  return { open, toggle: toggleOpenMode };
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "thoughts-open",
    mount() {
      return keepThoughtsOpen();
    },
  });

  app.contentScripts.register({
    id: "header-toggle",
    mount() {
      return mountHeaderToggle();
    },
  });

  app.slots.experimental_threadAction<ModeData>({
    id: "toggle",
    title: "Thoughts: show or fold",
    icon: "Brain",
    group: "3_settings",
    useData: useMode,
    item: ({ data }) => ({
      label: data.open ? "Fold thoughts" : "Show thoughts",
      icon: "Brain",
      run: data.toggle,
    }),
  });

  app.commands.register({
    id: "toggle",
    title: "Thoughts: show or fold",
    run: toggleOpenMode,
  });
});
