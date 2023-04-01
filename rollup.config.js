import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export default {
  input: "dist/index.js",
  preserveEntrySignatures: true,
  plugins: [commonjs(), terser()],
  output: {
    file: "./dist/bundle.cjs",
    format: "cjs",
  },
  external: ["fs", "path", "typescript", "@typescript-eslint/utils", "glob"],
};
