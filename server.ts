// bb-plugin-thoughts-open: backend entry.
//
// Holds one value: whether Thought rows are shown open (true) or folded
// (false). It lives in the plugin's key-value storage, so one switch applies to
// every bb window and device. Each change is broadcast on a realtime channel.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const MODE_CHANGED = "thoughts-open-mode";
const MODE_KEY = "open";

const modeSchema = z.object({ open: z.boolean() });

export const rpcContract = defineRpcContract({
  mode_get: { input: z.null(), output: modeSchema },
  mode_set: { input: modeSchema, output: modeSchema },
});

export default async function plugin(bb: BbPluginApi) {
  async function readMode(): Promise<boolean> {
    const stored = await bb.storage.kv.get<unknown>(MODE_KEY);
    return typeof stored === "boolean" ? stored : true;
  }

  bb.rpc.register(rpcContract, {
    mode_get: async () => ({ open: await readMode() }),
    mode_set: async ({ open }) => {
      await bb.storage.kv.set(MODE_KEY, open);
      bb.realtime.publish(MODE_CHANGED, { open });
      return { open };
    },
  });

  bb.log.info("loaded");
}
