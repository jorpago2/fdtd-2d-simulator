#!/usr/bin/env node

process.argv.push("--physics");
await import("./browser-smoke.mjs");
