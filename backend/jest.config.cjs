module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["./tests/setup.js"],
  clearMocks: true,
  moduleNameMapper: {
    "^file-type$": "<rootDir>/tests/__mocks__/file-type.js",
    "^.*utils/otp\\.js$": "<rootDir>/tests/__mocks__/otp.js",
  },
};
