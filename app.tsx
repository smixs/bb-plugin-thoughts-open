// bb-plugin-thoughts-open: frontend entry.
//
// - A content script (thoughts-open.ts) opens or folds Thought rows.
// - A thread header button shows the mode and flips it with one click.
// - A command palette entry ("Thoughts: show or fold") does the same.
//
// The mode lives on the bb server (server.ts). The header action's useData,
// which bb calls once for the whole app, reads it, follows the realtime
// channel, and hands it to the content script.
import { useCallback, useEffect, useState } from "react";
import { definePluginApp, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
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

  app.slots.experimental_threadAction<ModeData>({
    id: "toggle",
    title: "Thoughts: show or fold",
    icon: "Brain",
    group: "thoughts-open",
    placement: "header",
    useData: useMode,
    item: ({ data }) => ({
      label: data.open ? "Thoughts: open" : "Thoughts: folded",
      icon: data.open ? "Eye" : "EyeOff",
      run: data.toggle,
    }),
  });

  app.commands.register({
    id: "toggle",
    title: "Thoughts: show or fold",
    run: toggleOpenMode,
  });
});
