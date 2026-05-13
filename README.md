<img width="1254" height="1254" alt="RemoteEnv" src="https://github.com/user-attachments/assets/dcbb291e-2a23-42b2-b26e-7387678cebb8" />
# RemoteEnv

## What is RemoteEnv?

RemoteEnv is a centralized environment variable manager for teams that want secure, runtime-delivered configuration instead of scattered local secret files.

It includes:

- A NestJS + Prisma API for storing and managing environment variables
- A dashboard UI for projects, environments, and variable operations
- CLI tools (`envops` and `env-service`) for scripting and runtime injection

## Why not .env files?

Traditional `.env` files are simple, but they become risky and hard to maintain at scale.

RemoteEnv helps by:

- Keeping secrets in one controlled backend instead of many developer machines
- Reducing accidental leaks in commits, backups, and local file sharing
- Supporting runtime fetch and in-memory injection (no required plaintext secret file on disk)
- Providing environment-level organization (`dev`, `staging`, `production`)

## Installation

Install from npm:

```bash
npm install -g @lithigesh/remoteenv
```

Or use without global install:

```bash
npx @lithigesh/remoteenv --help
```

For local development from source:

```bash
npm install
npm run build
```

## Quick Start

1. Start PostgreSQL (Docker):

```bash
npm run db:up
```

2. Generate Prisma client and migrate:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

3. Start backend API:

```bash
npm run start:dev
```

4. (Optional) Start dashboard:

```bash
npm run ui:install
npm run ui:dev
```

5. Use CLI:

```bash
envops --help
env-service setup
env-service run --project payments-service --env dev -- npm start
```

## Dashboard screenshots

Add product screenshots here before publishing to npm.

Suggested images:

- Project list and creation flow
- Environment selector (`dev` / `staging` / `production`)
- Variable table with create/update/delete actions
- Bulk `.env` import panel

Markdown example:

```md
![Projects Dashboard](./docs/screenshots/projects.png)
![Environment Variables](./docs/screenshots/variables.png)
```

## Encryption architecture

RemoteEnv is designed for secure secret handling:

- Environment values are stored as encrypted records
- Access is API-mediated and token-authenticated
- Runtime consumers request scoped variables for a specific project/environment
- Optional client-side key registration paths are supported via CLI secure commands

High-level model:

1. Secret is submitted to API
2. Secret is encrypted before persistence
3. Runtime client requests scoped env set
4. API returns values for authorized identity and scope

## Runtime sync flow

RemoteEnv supports a Doppler-style runtime flow with `env-service run`:

1. Resolve API URL and access token
2. Fetch environment data from `GET /runtime/env?project=<name>&environment=<name>`
3. Inject variables into child process environment in memory
4. Start target command with injected configuration

Example:

```bash
env-service run --project payments-service --env staging -- npm test
```

## Multi-environment support

Each project can be managed across multiple environments:

- `dev`
- `staging`
- `production`

This separation helps prevent configuration drift and reduces deployment mistakes by making environment scope explicit in both UI and CLI flows.

## Security best practices

- Use short-lived access tokens where possible
- Limit project access by role/team responsibility
- Rotate credentials and secrets regularly
- Avoid printing secret values in logs
- Keep production and non-production secrets strictly separated
- Prefer runtime injection (`env-service run`) instead of writing secrets to local `.env` files
- Run secret-scanning in CI to catch accidental exposures
