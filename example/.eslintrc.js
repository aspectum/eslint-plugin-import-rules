module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { project: [__dirname + "/tsconfig.json"] },
  plugins: ["@aspectum/import-rules"],
  rules: {
    "@aspectum/import-rules/imports-in-modules": "error",
  },
  ignorePatterns: [".eslintrc.js"],
  settings: {
    importRules: {
      modules: ["lib"],
    },
  },
};
