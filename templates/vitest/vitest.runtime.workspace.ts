import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "runtime-surface",
      environment: "node",
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.test.ts"]
    }
  }
]);
