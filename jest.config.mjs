

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
  moduleFileExtensions: ["ts", "tsx", "js", "html"],
  coverageReporters: ["html"],
  transform: {
    "^.*src/.+\\.tsx?$": "ts-jest"
    // SWC decorator metadata missing, needs debugging - another time
    // "^.*src/.+\\.tsx?$": ["@swc/jest", {
    //
    //   "jsc": {
    //     "parser": {
    //       "syntax": "typescript",
    //       "tsx": false,
    //       "decorators": true,
    //       dynamicImport: true
    //     },
    //     "target": "es2017",
    //     "transform": {
    //       "legacyDecorator": true,
    //       "decoratorMetadata": true
    //     }
    //   },
    //   "module": {
    //     "type": "commonjs",
    //     "noInterop": false
    //   }
    // }]
  }
}
