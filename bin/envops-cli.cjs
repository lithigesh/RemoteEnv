#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const API_BASE_URL = process.env.ENVMGMT_API_URL || 'http://localhost:3000';
const ACCESS_TOKEN = process.env.ENVMGMT_ACCESS_TOKEN || '';

function configPath() {
  return path.join(os.homedir(), '.env-service', 'config.json');
}

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeConfig(config) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
}

function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
  return { rl, ask };
}

function printHelp() {
  console.log(`EnvOps CLI

Usage:
  envops <resource> <action> [options]

Global options:
  --api-url <url>     Override API base URL (default: ${API_BASE_URL})
  --access-token <t>  Access token (or set ENVMGMT_ACCESS_TOKEN)
  --help              Show help

Token Commands:
  envops token set [--access-token <token>]
  envops token delete
  envops token show

Projects:
  envops project create --name <name>
  envops project list
  envops project get --id <projectId>
  envops project delete --id <projectId>

Environments:
  envops environment list --project-id <projectId>

Environment Variables:
  envops env create --project-id <projectId> --environment-id <environmentId> --key <key> --value <value>
  envops env list --project-id <projectId> --environment-id <environmentId>
  envops env secure-list --project-id <projectId> --environment-id <environmentId> --client-id <clientId> --kid <kid>
  envops env update --id <envVarId> [--key <key>] [--value <value>]
  envops env delete --id <envVarId>
  envops env register-client-key --project-id <projectId> --client-id <clientId> --kid <kid> --algorithm <algo> --public-key <pem>
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const flags = {};

  while (args.length > 0) {
    const token = args.shift();
    if (!token) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
      flags[key] = value;
      continue;
    }
    positional.push(token);
  }

  return { positional, flags };
}

function requireFlag(flags, key) {
  const value = flags[key];
  if (!value) {
    throw new Error(`Missing required option: --${key}`);
  }
  return value;
}

function kebabToCamel(input) {
  return input.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function pickFlags(flags, keys) {
  const out = {};
  for (const key of keys) {
    const value = flags[key];
    if (value !== undefined) {
      out[kebabToCamel(key)] = value;
    }
  }
  return out;
}

function buildBodyFromRequiredAndOptional(flags, requiredKeys, optionalKeys = []) {
  const body = {};
  for (const key of requiredKeys) {
    body[kebabToCamel(key)] = requireFlag(flags, key);
  }
  for (const key of optionalKeys) {
    const value = flags[key];
    if (value !== undefined) {
      body[kebabToCamel(key)] = value;
    }
  }
  return body;
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request(baseUrl, method, path, { query, body } = {}) {
  const token = process.env.ENVMGMT_ACCESS_TOKEN || '';
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = buildUrl(baseUrl, path, query);
  const response = await fetch(url, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // keep plain text response when not JSON
  }

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || JSON.stringify(payload);
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  if (payload === null || payload === '') {
    console.log('OK');
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function run() {
  const { positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || positional.length < 1) {
    printHelp();
    return;
  }

  const baseUrl = flags['api-url'] || API_BASE_URL;
  const [resource, action] = positional;

  if (resource === 'token') {
    const config = readConfig() || {};
    if (action === 'delete') {
      if (!config.accessToken) {
        console.log('No stored access token found.');
        return;
      }
      writeConfig({ ...config, accessToken: '' });
      console.log('Stored access token deleted.');
      return;
    }
    if (action === 'show') {
      if (!config.accessToken) {
        console.log('No stored access token found.');
        return;
      }
      const token = config.accessToken;
      const masked = token.length <= 8 ? '********' : `${token.slice(0, 4)}...${token.slice(-4)}`;
      console.log(`Stored access token: ${masked}`);
      return;
    }
    if (action === 'set') {
      const { rl, ask } = createPrompt();
      try {
        const token = flags['access-token'] || (await ask('Access token: '));
        if (!token) {
          throw new Error('Access token is required.');
        }
        writeConfig({ ...config, accessToken: token });
        console.log(`Stored access token at ${configPath()}`);
        return;
      } finally {
        rl.close();
      }
    }
    throw new Error('Unknown token command. Use: token set | token delete | token show');
  }

  if (!action) {
    printHelp();
    return;
  }

  let accessToken = flags['access-token'] || readConfig()?.accessToken || ACCESS_TOKEN;
  if (!accessToken) {
    const { rl, ask } = createPrompt();
    try {
      accessToken = await ask('Access token: ');
    } finally {
      rl.close();
    }
  }
  if (!accessToken) {
    throw new Error('Missing access token. Use `envops token set` or pass --access-token.');
  }
  process.env.ENVMGMT_ACCESS_TOKEN = accessToken;

  if (resource === 'project') {
    if (action === 'create') {
      await request(baseUrl, 'POST', '/projects', {
        body: { name: requireFlag(flags, 'name') },
      });
      return;
    }
    if (action === 'list') {
      await request(baseUrl, 'GET', '/projects');
      return;
    }
    if (action === 'get') {
      await request(baseUrl, 'GET', `/projects/${requireFlag(flags, 'id')}`);
      return;
    }
    if (action === 'delete') {
      await request(baseUrl, 'DELETE', `/projects/${requireFlag(flags, 'id')}`);
      return;
    }
  }

  if (resource === 'environment') {
    if (action === 'list') {
      await request(
        baseUrl,
        'GET',
        `/projects/${requireFlag(flags, 'project-id')}/environments`,
      );
      return;
    }
  }

  if (resource === 'env') {
    if (action === 'create') {
      await request(baseUrl, 'POST', '/env', {
        body: buildBodyFromRequiredAndOptional(flags, [
          'project-id',
          'environment-id',
          'key',
          'value',
        ]),
      });
      return;
    }
    if (action === 'list') {
      await request(baseUrl, 'GET', '/env', {
        query: pickFlags(flags, ['project-id', 'environment-id']),
      });
      return;
    }
    if (action === 'secure-list') {
      await request(baseUrl, 'GET', '/env/secure', {
        query: pickFlags(flags, ['project-id', 'environment-id', 'client-id', 'kid']),
      });
      return;
    }
    if (action === 'update') {
      const id = requireFlag(flags, 'id');
      const body = pickFlags(flags, ['key', 'value']);
      if (!body.key && !body.value) {
        throw new Error('Provide at least one of: --key or --value');
      }
      await request(baseUrl, 'PUT', `/env/${id}`, { body });
      return;
    }
    if (action === 'delete') {
      await request(baseUrl, 'DELETE', `/env/${requireFlag(flags, 'id')}`);
      return;
    }
    if (action === 'register-client-key') {
      await request(baseUrl, 'POST', '/env/clients/keys', {
        body: buildBodyFromRequiredAndOptional(flags, [
          'project-id',
          'client-id',
          'kid',
          'algorithm',
          'public-key',
        ]),
      });
      return;
    }
  }

  throw new Error(`Unknown command: ${resource} ${action}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
