# eltPulse

**eltPulse** is the product name for this repo: an ELT builder and (growing) hosted control plane. The open-source core is the Python **embedded_elt_builder** package (CLI + FastAPI UI). The **SaaS shell** lives in **`web/`** — a [Next.js](https://nextjs.org/) app with the same shape as ServicePulse (App Router, Clerk, Prisma, Stripe, Resend, Vercel). Public source: [github.com/eltpulsehq/eltpulse](https://github.com/eltpulsehq/eltpulse).

## Repo layout

| Path | What it is |
|------|------------|
| `embedded_elt_builder/` | Python package: `elt` CLI, pipeline generator, FastAPI/Jinja web UI |
| `web/` | eltPulse marketing site + authenticated dashboard (Neon/Postgres via Prisma) |
| `integrations/` | **[github.com/eltpulsehq/integrations](https://github.com/eltpulsehq/integrations)** — `agent/` (gateway source + GHCR image) and `gateways/` (Docker, K8s, ECS, Terraform) |

### SaaS stack (`web/`)

- **Auth:** [Clerk](https://clerk.com) — middleware + `/api/webhooks/clerk`
- **Database:** [Neon](https://neon.tech) (or any Postgres) — Prisma
- **Billing:** [Stripe](https://stripe.com) — `/api/webhooks/stripe`
- **Email:** [Resend](https://resend.com) — `lib/email/resend.ts`
- **AI:** [Anthropic](https://www.anthropic.com) — `lib/ai/anthropic.ts`
- **Deploy:** [Vercel](https://vercel.com) — see `web/vercel.json`

```bash
cd web
cp .env.example .env.local   # fill Clerk, DATABASE_URL, etc.
npm install
npm run db:push               # or db:migrate once you add migrations
npm run dev                   # http://localhost:3000
```

### ELT Builder in the browser (`/builder`)

The **Next.js app** includes a native ELT Builder (React + API routes + Prisma). Pipeline definitions and generated `pipeline.py` / `replication.yaml` / workspace metadata text are stored in **Neon** — no FastAPI process required. One command: `cd web && npm run dev`, then open **http://localhost:3000/builder** (after signing in). Run **`npx prisma db push`** after pulling so the `EltPipeline` table exists.

The original **Python** package (`embedded_elt_builder/`) remains available for **`elt` CLI** users and as the reference implementation for generators; parity with every CLI feature is incremental.

---

# Embedded ELT Builder (Python package)

A powerful tool for creating, managing, and deploying ELT pipelines using [dlt](https://dlthub.com/) and [Sling](https://slingdata.io/). Features both a CLI and a modern web UI with dark mode support.

## Screenshot

![ELT Pipeline Manager Web UI](embedded_elt_builder/assets/web-ui-screenshot.png)

*The Web UI showing the pipeline management interface with search, filtering, and bulk operations*

## Features

### 🎨 Web UI
- **Interactive Pipeline Creation** - Visual form-based pipeline configuration
- **Metadata Management** - Edit tags, kinds, owners, and schedules
- **Git Integration** - Commit, push, and sync with GitHub repositories
- **Dark Mode** - Full dark theme support for comfortable viewing
- **Icon Mode** - Compact icon-based interface option
- **Credential Testing** - Test database and API connections before deployment
- **Bulk Operations** - Enable, disable, or delete multiple pipelines at once
- **Advanced Filtering** - Search and filter pipelines by tool, source, destination, status
- **Repository Browser** - Browse and select pipeline directories

### 💻 CLI
- **Scaffold Pipelines** - Generate new dlt or Sling pipelines from templates
- **List Pipelines** - View all configured pipelines
- **Delete Pipelines** - Remove pipelines from your repository
- **Launch Web UI** - Start the web interface from the command line
- **Manage Sensors** - Create and manage event-driven sensors for pipeline orchestration

### 🔧 Supported Tools
- **dlt (Data Load Tool)** - Python-based data pipeline framework
  - REST API sources
  - Database sources (PostgreSQL, MySQL, etc.)
  - SaaS connectors (Stripe, Salesforce, GitHub, etc.)
  - Custom Python sources

- **Sling** - Fast data replication tool
  - Database-to-database replication
  - Incremental loading
  - Schema inference

### 📡 Sensors (Event-Driven Orchestration)
- **S3 File Count Sensor** - Monitor AWS S3 buckets for file count thresholds
- **GCS File Count Sensor** - Monitor Google Cloud Storage buckets for file count thresholds
- **ADLS File Count Sensor** - Monitor Azure Data Lake Storage for file count thresholds
- **CSV Row Count Sensor** - Monitor CSV files for row count thresholds
- **Kafka Message Count Sensor** - Monitor Kafka topics for message count thresholds
- **SQS Message Count Sensor** - Monitor AWS SQS queues for message count thresholds
- **Extensible Architecture** - Easy to add new sensor types for different monitoring scenarios

## Installation

```bash
# Clone the repository
git clone https://github.com/eltpulsehq/eltpulse.git
cd eltpulse

# Install dependencies (using uv or pip)
uv pip install -e .
# or
pip install -e .
```

## Quick Start

### Web UI

Launch the web interface to visually create and manage pipelines:

```bash
# Start the web UI
python -m embedded_elt_builder.web

# Or use the CLI command
elt ui
```

The web UI will open at `http://localhost:8000`

**Features:**
- Create new pipelines with interactive forms
- Configure sources and destinations
- Set up credentials and test connections
- Manage pipeline metadata (tags, kinds, owners)
- Git operations (commit, push, sync)
- Dark mode and icon mode in Settings

### CLI

The CLI provides powerful commands for managing pipelines from the terminal with rich formatted output.

#### Repository Status

Check git status and pipeline summary:

```bash
elt status
```

Shows:
- Current branch and remote
- Uncommitted changes and files
- Commits ahead/behind remote
- Pipeline counts by tool and status

#### List Pipelines

List all pipelines with filtering options:

```bash
# List all pipelines
elt list

# Filter by tool type
elt list --tool dlt
elt list --tool sling

# Filter by status
elt list --enabled
elt list --disabled
```

#### Show Pipeline Details

Display comprehensive pipeline information:

```bash
elt show my_pipeline
```

Shows:
- Basic info (name, tool, source, destination, group)
- Schedule configuration
- Owners and tags
- Asset kinds
- Retry policy

#### Create New Pipeline

Interactively create pipelines with auto tool selection:

```bash
# Create with interactive configuration
elt scaffold create github_to_snowflake \
  --source github \
  --destination snowflake

# Create with schedule
elt scaffold create stripe_daily \
  --source stripe \
  --destination duckdb \
  --schedule "0 2 * * *"

# Skip interactive prompts
elt scaffold create pg_to_bq \
  --source postgres \
  --destination bigquery \
  --no-interactive

# Specify custom options
elt scaffold create my_pipeline \
  --source rest_api \
  --destination duckdb \
  --description "My custom pipeline" \
  --group my_group \
  --no-git-commit
```

#### Enable/Disable Pipelines

Toggle pipeline execution:

```bash
# Enable a pipeline
elt enable my_pipeline

# Disable a pipeline
elt disable my_pipeline

# Skip git operations
elt enable my_pipeline --no-git-commit
```

#### Validate Pipelines

Check all pipeline configurations for errors:

```bash
elt validate
```

Validates:
- Required files exist (workspace metadata file `dagster.yaml` where applicable, `pipeline.py` / `replication.yaml`)
- YAML syntax is valid
- Required fields are present
- Cron schedules are valid
- Pipeline code has run() function (dlt)

#### Delete Pipeline

Remove a pipeline:

```bash
elt delete my_pipeline

# Skip git operations
elt delete my_pipeline --no-git-commit
```

#### Launch Web UI

Start the web interface:

```bash
# Default port (8000)
elt ui

# Custom port
elt ui --port 8080

# Specify repository path
elt ui --repo-path /path/to/pipelines
```

## Project Structure

```
embedded_elt_builder/
├── cli/                    # Command-line interface
│   ├── main.py            # CLI entry point
│   ├── scaffold.py        # Pipeline scaffolding
│   ├── list_pipelines.py  # List command (with rich tables)
│   ├── show.py            # Show pipeline details
│   ├── toggle.py          # Enable/disable commands
│   ├── validate.py        # Validate configurations
│   ├── status.py          # Repository status
│   ├── delete.py          # Delete command
│   └── ui.py              # Launch web UI
├── web/                    # Web interface
│   ├── app_enhanced.py    # FastAPI backend
│   ├── templates/         # HTML templates
│   └── credentials_config.py  # Credential schemas
├── pipeline_generator.py   # Core pipeline generation logic
└── schemas/               # Data models

pipelines/                  # Generated pipelines (gitignored)
├── dlt/
│   └── {pipeline_name}/
│       ├── pipeline.py    # Pipeline code
│       ├── config.yaml    # dlt configuration
│       └── dagster.yaml   # Workspace / orchestration hints (legacy filename; see below)
└── sling/
    └── {replication_name}/
        ├── replication.yaml  # Sling replication config
        └── dagster.yaml      # Workspace / orchestration hints (legacy filename; see below)
```

> **Independence:** eltPulse is **not** affiliated with, endorsed by, or part of any third-party orchestration product. The `dagster.yaml` filename is historical in this codebase; it stores **eltPulse workspace metadata** (scheduling, groups, tags), not an integration with another vendor’s software.

## Pipeline Configuration

### Workspace metadata (`dagster.yaml`)

Each generated pipeline may include a `dagster.yaml` file containing **eltPulse** workspace metadata (scheduling, ownership, tags, etc.):

```yaml
enabled: true
description: "Pipeline description"
group: "pipeline_group"

kinds:
  - "dlt"              # Tool type
  - "rest_api"         # Source
  - "duckdb"           # Destination

owners:
  - "team@company.com"

schedule:
  enabled: true
  cron_schedule: "0 */6 * * *"  # Every 6 hours
  timezone: "UTC"

tags:
  team: "data-engineering"
  environment: "production"

retries: 3
retry_delay: 60
```

## Web UI Features

### Dark Mode
Toggle dark mode in **Settings** for a comfortable viewing experience in low-light environments. All modals, tables, and forms are fully styled for dark mode.

### Icon Mode
Enable icon mode in **Settings** to display compact monochrome icons instead of text labels on action buttons:
- `✎` Edit
- `⋮` Metadata
- `×` Delete
- `+` New Pipeline
- `$` Environment Variables
- `⎇` Git
- `◈` Credentials
- `⚙` Settings

### Git Integration
- **Commit & Push** - Version control your pipeline configurations
- **GitHub Sync** - Pull latest changes when your local repo is behind
- **Status Monitoring** - View uncommitted changes and branch status

### Credential Management
Test database and API connections before creating pipelines:
- Snowflake (username/password or keypair authentication)
- PostgreSQL
- MySQL
- BigQuery
- Stripe
- Salesforce
- And more...

### Advanced Filtering
- Filter by tool type (dlt/Sling)
- Filter by enabled/disabled status
- Search across pipeline names, sources, destinations
- Sortable columns
- Customizable column visibility
- Pagination support

## Configuration

### Environment Variables

Set credentials in a `.env` file in your pipelines directory:

```bash
# Database connections
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=mydb

# Snowflake
SNOWFLAKE_ACCOUNT=myaccount
SNOWFLAKE_USER=user
SNOWFLAKE_PASSWORD=password
SNOWFLAKE_WAREHOUSE=warehouse
SNOWFLAKE_DATABASE=database

# API Keys
STRIPE_API_KEY=sk_test_...
GITHUB_TOKEN=ghp_...
```

### Repository Path

Configure the repository path in the Web UI:
1. Click **Settings** (⚙)
2. Browse or enter your pipelines directory path
3. Click **Apply & Reload**

## Development

### Running Locally

```bash
# Install in development mode
pip install -e .

# Start web UI with auto-reload
uvicorn embedded_elt_builder.web.app_enhanced:app --reload --port 8050

# Or use the CLI
python -m embedded_elt_builder.web
```

### Project Dependencies

- **FastAPI** - Web framework
- **Jinja2** - Template rendering
- **GitPython** - Git operations
- **Pydantic** - Data validation
- **click** - CLI framework
- **rich** - Beautiful terminal formatting

## License

MIT License

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Support

For questions or issues:
- Open an issue on GitHub

---

Built with ❤️ using Claude Code
