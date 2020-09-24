export default {
  //rootDir: process.cwd(),
  verbose: true,

  testRegex: "/src/.*\\.spec\\.ts$",
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "js", "html"],
  coverageReporters: ["html"],
  // transform: {}
  transform: {
    "^.*src/.+\\.ts$": "ts-jest"
  }
}
