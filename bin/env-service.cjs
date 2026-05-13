#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const DEFAULT_API_BASE_URL = process.env.ENVMGMT_API_URL || 'http://localhost:3000';
const DEFAULT_ACCESS_TOKEN = process.env.ENVMGMT_ACCESS_TOKEN || '';
const ALLOWED_ENVIRONMENTS = new Set(['dev', 'staging', 'production']);

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      return { flags, positional, command: argv.slice(i + 1) };
    }

    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      flags[key] = value;
      continue;
    }

    positional.push(token);
  }

  return { flags, positional, command: [] };
}

function normalizeBaseUrl(input, fallbackBaseUrl) {
  const value = (input || '').trim();
  if (!value) return fallbackBaseUrl;

  if (/^\d{2,5}$/.test(value)) {
    return `http://localhost:${value}`;
  }

  if (!/^https?:\/\//i.test(value)) {
    return `http://${value}`;
  }

  return value;
}

function buildUrl(baseUrl, route, query) {
  const url = new URL(route, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request(baseUrl, method, route, { query, body } = {}) {
  const authToken = process.env.ENVMGMT_ACCESS_TOKEN || '';
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(buildUrl(baseUrl, route, query), {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // keep text
  }

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || JSON.stringify(payload);
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return payload;
}

function configPath() {
  return path.join(os.homedir(), '.env-service', 'config.json');
}

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) {
    return null;
  }

  const data = fs.readFileSync(file, 'utf8');
  return JSON.parse(data);
}

function writeConfig(config) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
}

function updateConfig(patch) {
  const existing = readConfig() || {};
  const next = { ...existing, ...patch };
  writeConfig(next);
  return next;
}

function createPrompt() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
  return { rl, ask };
}

function printJson(payload) {
  if (payload === null || payload === undefined || payload === '') {
    console.log('OK');
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

function printHelp() {
  console.log(`Env Service CLI

Usage:
  env-service setup [--api-url <url>] [--project <name>] [--environment <name>]
                    [--access-token <token>]
  env-service run [--api-url <url>] [--project <name>] [--env <name>] -- <command>
  env-service run <command>
  env-service token set [--access-token <token>]
  env-service token delete
  env-service token show
  env-service            # opens interactive menu

Examples:
  env-service setup
  env-service run npm start
  env-service run --project payments-service --env staging -- npm test
  env-service token set --access-token <token>
  env-service token delete
`);
}

function assertAllowedEnvironment(environment) {
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error('Environment must be one of: dev, staging, production');
  }
}

async function setupCommand(flags) {
  const { rl, ask } = createPrompt();
  try {
    const existing = readConfig() || {};
    const apiUrlInput = flags['api-url'] || (await ask(`API URL [${existing.apiUrl || DEFAULT_API_BASE_URL}]: `));
    const project = flags.project || (await ask(`Project name [${existing.project || ''}]: `));
    const environment =
      flags.environment || flags.env || (await ask(`Environment name [${existing.environment || ''}]: `));
    const accessToken = flags['access-token'] || (await ask(`Access token [${existing.accessToken || DEFAULT_ACCESS_TOKEN}]: `));

    const config = {
      apiUrl: normalizeBaseUrl(apiUrlInput, existing.apiUrl || DEFAULT_API_BASE_URL),
      project: project || existing.project || '',
      environment: environment || existing.environment || '',
      accessToken: accessToken || existing.accessToken || DEFAULT_ACCESS_TOKEN,
    };

    if (!config.project || !config.environment) {
      throw new Error('Project and environment are required.');
    }
    if (!config.accessToken) {
      throw new Error('Access token is required.');
    }
    assertAllowedEnvironment(config.environment);

    writeConfig(config);
    console.log(`Saved config to ${configPath()}`);
    console.log(JSON.stringify(config, null, 2));
  } finally {
    rl.close();
  }
}

async function resolveAccessToken(flags, config, ask) {
  if (flags['access-token']) return flags['access-token'];
  if (config?.accessToken) return config.accessToken;
  if (process.env.ENVMGMT_ACCESS_TOKEN) return process.env.ENVMGMT_ACCESS_TOKEN;
  const prompted = await ask('Access token: ');
  if (!prompted) {
    throw new Error('Access token is required.');
  }
  return prompted;
}

function resolveRunCommand(parsed) {
  if (parsed.command.length > 0) {
    return parsed.command.join(' ');
  }

  if (parsed.positional.length > 1) {
    return parsed.positional.slice(1).join(' ');
  }

  return '';
}

async function runCommand(parsed) {
  const conf = readConfig() || {};
  const apiUrl = normalizeBaseUrl(parsed.flags['api-url'] || conf.apiUrl || DEFAULT_API_BASE_URL, DEFAULT_API_BASE_URL);
  const project = parsed.flags.project || conf.project;
  const environment = parsed.flags.env || parsed.flags.environment || conf.environment;
  const command = resolveRunCommand(parsed);

  if (!project || !environment) {
    throw new Error('Missing project/environment. Run `env-service setup` or pass --project and --env.');
  }
  assertAllowedEnvironment(environment);

  if (!command) {
    throw new Error('Missing command to run. Example: env-service run npm start');
  }

  const { rl, ask } = createPrompt();
  let accessToken = '';
  try {
    accessToken = await resolveAccessToken(parsed.flags, conf, ask);
  } finally {
    rl.close();
  }

  process.env.ENVMGMT_ACCESS_TOKEN = accessToken;
  if (accessToken !== conf.accessToken) {
    updateConfig({ accessToken });
  }

  const runtime = await request(apiUrl, 'GET', '/runtime/env', {
    query: { project, environment },
  });

  const runtimeVars = runtime?.variables;
  if (!runtimeVars || typeof runtimeVars !== 'object') {
    throw new Error('Runtime env payload missing `variables` map.');
  }

  const childEnv = { ...process.env, ...runtimeVars };
  console.log(`Running with project=${project}, environment=${environment}, api=${apiUrl}`);
  console.log(`Injected ${Object.keys(runtimeVars).length} variables.`);

  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env: childEnv,
  });

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code === null ? 1 : code;
      resolve();
    });
  });
}

async function tokenCommand(parsed) {
  const action = parsed.positional[1];
  const conf = readConfig() || {};

  if (action === 'delete') {
    if (!conf.accessToken) {
      console.log('No stored access token found.');
      return;
    }
    updateConfig({ accessToken: '' });
    console.log('Stored access token deleted.');
    return;
  }

  if (action === 'show') {
    if (!conf.accessToken) {
      console.log('No stored access token found.');
      return;
    }
    const token = conf.accessToken;
    const masked = token.length <= 8 ? '********' : `${token.slice(0, 4)}...${token.slice(-4)}`;
    console.log(`Stored access token: ${masked}`);
    return;
  }

  if (action === 'set') {
    const { rl, ask } = createPrompt();
    try {
      const token = parsed.flags['access-token'] || (await ask('Access token: '));
      if (!token) {
        throw new Error('Access token is required.');
      }
      updateConfig({ accessToken: token });
      console.log(`Stored access token at ${configPath()}`);
      return;
    } finally {
      rl.close();
    }
  }

  throw new Error('Unknown token command. Use: token set | token delete | token show');
}

async function projectMenu(ask, baseUrl) {
  console.log('\n=== Project Menu ===');
  console.log('1. Create Project');
  console.log('2. List Projects');
  console.log('3. Get Project by ID');
  console.log('4. Delete Project by ID');
  console.log('0. Back');
  const choice = await ask('Select option: ');
  if (choice === '0') return;

  if (choice === '1') printJson(await request(baseUrl, 'POST', '/projects', { body: { name: await ask('Project name: ') } }));
  else if (choice === '2') printJson(await request(baseUrl, 'GET', '/projects'));
  else if (choice === '3') printJson(await request(baseUrl, 'GET', `/projects/${await ask('Project ID: ')}`));
  else if (choice === '4') printJson(await request(baseUrl, 'DELETE', `/projects/${await ask('Project ID: ')}`));
  else console.log('Invalid option.');
}

async function environmentMenu(ask, baseUrl) {
  console.log('\n=== Environment Menu ===');
  console.log('1. List Environments by Project');
  console.log('0. Back');
  const choice = await ask('Select option: ');
  if (choice === '0') return;

  if (choice === '1') {
    printJson(await request(baseUrl, 'GET', `/projects/${await ask('Project ID: ')}/environments`));
  } else {
    console.log('Invalid option.');
  }
}

async function envVarMenu(ask, baseUrl) {
  console.log('\n=== Environment Variables Menu ===');
  console.log('1. Create Variable');
  console.log('2. List Variables');
  console.log('3. Update Variable');
  console.log('4. Delete Variable');
  console.log('0. Back');
  const choice = await ask('Select option: ');
  if (choice === '0') return;

  if (choice === '1') {
    const projectId = await ask('Project ID: ');
    const environmentId = await ask('Environment ID: ');
    const key = await ask('Variable key: ');
    const value = await ask('Variable value: ');
    printJson(await request(baseUrl, 'POST', '/env', { body: { projectId, environmentId, key, value } }));
  } else if (choice === '2') {
    const projectId = await ask('Project ID: ');
    const environmentId = await ask('Environment ID: ');
    printJson(await request(baseUrl, 'GET', '/env', { query: { projectId, environmentId } }));
  } else if (choice === '3') {
    const id = await ask('Env Variable ID: ');
    const key = await ask('New key (leave blank to skip): ');
    const value = await ask('New value (leave blank to skip): ');
    const body = {};
    if (key) body.key = key;
    if (value) body.value = value;
    printJson(await request(baseUrl, 'PUT', `/env/${id}`, { body }));
  } else if (choice === '4') {
    printJson(await request(baseUrl, 'DELETE', `/env/${await ask('Env Variable ID: ')}`));
  } else {
    console.log('Invalid option.');
  }
}

async function interactiveMenu() {
  const { rl, ask } = createPrompt();
  let baseUrl = DEFAULT_API_BASE_URL;
  const existingConfig = readConfig() || {};
  try {
    console.log('\n=== Env Service CLI ===');
    console.log(`API URL: ${baseUrl}`);
    const customUrl = await ask('Enter API URL (or just port like 3000) or press Enter: ');
    baseUrl = normalizeBaseUrl(customUrl, baseUrl);
    console.log(`Using API URL: ${baseUrl}`);
    let accessToken = existingConfig.accessToken || process.env.ENVMGMT_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN;
    if (!accessToken) {
      accessToken = await ask('Access token: ');
      if (!accessToken) {
        throw new Error('Access token is required for CLI requests.');
      }
      updateConfig({ accessToken });
    }
    if (!accessToken) {
      throw new Error('Access token is required for CLI requests.');
    }
    process.env.ENVMGMT_ACCESS_TOKEN = accessToken;

    while (true) {
      console.log('\n=== Main Menu ===');
      console.log('1. Projects');
      console.log('2. Environments');
      console.log('3. Environment Variables');
      console.log('0. Exit');
      const choice = await ask('Select option: ');

      try {
        if (choice === '0') break;
        if (choice === '1') await projectMenu(ask, baseUrl);
        else if (choice === '2') await environmentMenu(ask, baseUrl);
        else if (choice === '3') await envVarMenu(ask, baseUrl);
        else console.log('Invalid option.');
      } catch (error) {
        console.error(`Request failed: ${error.message}`);
      }
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.positional[0];

  if (parsed.flags.help || parsed.flags.h) {
    printHelp();
    return;
  }

  if (command === 'setup') {
    await setupCommand(parsed.flags);
    return;
  }

  if (command === 'run') {
    await runCommand(parsed);
    return;
  }

  if (command === 'token') {
    await tokenCommand(parsed);
    return;
  }

  if (command) {
    printHelp();
    throw new Error(`Unknown command: ${command}`);
  }

  await interactiveMenu();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
