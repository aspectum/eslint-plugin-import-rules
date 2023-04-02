module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { project: [__dirname + "/tsconfig.json"] },
  plugins: ["import-rules"],
  rules: {
    "import-rules/imports-in-modules": "error",
  },
  ignorePatterns: [".eslintrc.js"],
  settings: {
    importRules: {
      modules: ["lib"],
    },
  },
};
