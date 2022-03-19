
export default {
  rootDir: process.cwd(),
  verbose: true,
  testMatch: [
    "<rootDir>/src/**/?(*)(test|spec).(ts|js|tsx)"
  ],
  modulePathIgnorePatterns: [
    ".*\\.layers.*",
    "<rootDir>\\/lib\\/.*"
  
  ],
  moduleDirectories: ["node_modules"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  coverageReporters: ["html"],
  transform: {
    "^.*src/.+\\.tsx?$": "ts-jest"
    // SWC decorator metadata missing, needs debugging - another time
    //"\\.tsx?$": ["@swc/jest"]
  }
}
