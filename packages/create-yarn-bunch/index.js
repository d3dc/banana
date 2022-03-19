#!/usr/bin/env node

const args = process.argv.slice(2);
const argv = require("minimist")(args);
const path = require("path");

const { Plop, run } = require("plop");

Plop.launch(
  {
    cwd: argv.cwd,
    configPath: path.join(__dirname, "plopfile.ts"),
    require: argv.require,
    completion: argv.completion,
  },
  (env) => run(env, undefined, true)
);