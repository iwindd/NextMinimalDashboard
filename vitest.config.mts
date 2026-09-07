import { configDefaults, defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "prisma/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [...configDefaults.exclude, ".next/**"],
    environment: "node",
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/auth.ts",
        "src/proxy.ts",
        "src/lib/action-client.ts",
        // about/exceptions.ts is left out until its unused error classes are removed.
        "src/servers/about/{actions,files,queries}/**/*.ts",
        "src/servers/about/{authorization,helpers}.ts",
        "src/servers/homepage/{actions,files,queries}/**/*.ts",
        "src/servers/homepage/{authorization,helpers}.ts",
        "src/servers/network-partner/**/*.ts",
        "src/lib/audit/**/*.ts",
        "src/lib/prisma-extensions/**/*.ts",
        "src/servers/file-manager/queries/**/*.ts",
        "src/servers/infographic/actions/**/*-action.ts",
        "src/servers/infographic/queries/**/*.ts",
        "src/servers/news/actions/**/*-action.ts",
        "src/servers/news/queries/**/*.ts",
        "src/servers/news-category/actions/**/*-action.ts",
        "src/servers/news-category/queries/**/*.ts",
        "src/servers/user/**/*.ts",
        "src/servers/profile/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*-schema.ts",
        "**/types.ts",
      ],
      thresholds: {
        perFile: true,
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
});
