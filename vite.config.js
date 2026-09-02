import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src",
  publicDir: "../public",
  server: {
    port: 3000,
    fs: {
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "web-llm-unlocked": path.resolve(
        __dirname,
        "web-llm-unlocked/lib/index.js",
      ),
    },
  },
  customLogger: {
    ...console,
    warn(msg, options) {
      if (
        typeof msg === "string" &&
        msg.includes("Failed to load source map")
      ) {
        return;
      }
      console.warn(msg, options);
    },
  },
});
