module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { project: ["./tsconfig.json"] },
  plugins: ["@aspectum/import-rules"],
  rules: {
    "@aspectum/import-rules/relative-import-inside-module": "error",
  },
  ignorePatterns: [".eslintrc.js"],
};
