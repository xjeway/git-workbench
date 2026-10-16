#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { main } from '../../packages/breakdown/src/cli.js';

const { version } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { version: string };
await main(process.argv.slice(2), process.cwd(), version);
