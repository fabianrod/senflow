#!/usr/bin/env node

const { runCli } = require("../src/cli/index.js");

runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[senflow:error] ${message}`);
    process.exitCode = 1;
  });
