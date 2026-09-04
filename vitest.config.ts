import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Everything under test/ is either pure logic or static analysis over the
    // source. Nothing here renders a component or touches a native module, so
    // node is the right environment and no React Native preset is needed — see
    // docs/architecture/mobile-testing.md.
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup/env.ts"],
    testTimeout: 10_000,
  },
});
