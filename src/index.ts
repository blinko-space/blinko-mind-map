import { defineExtension } from "@blinko-cloud/cli/sdk";

defineExtension({
  activate: async () => {
    // The signed sidebar custom view owns the interactive canvas. All data and AI operations
    // remain capability-scoped by the Blinko host bridge.
  },
});
