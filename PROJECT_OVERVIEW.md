# ELT Builder - Complete Project Overview

## 🎉 Project Successfully Rebuilt!

This document provides a complete overview of the ELT Builder project after the full rebuild.

---

## 📦 What's Included

### 1. **embedded_elt_builder/** - Core Package
The main Python package for creating and managing ELT pipelines.

**CLI Tool (`elt` command):**
```bash
elt scaffold create <name> --source <type> --destination <type>
elt list
elt delete <name>
elt ui
elt sensors create <name> <pipeline> --type <sensor_type> --config <config>
elt sensors list
elt sensors check
```

**Web UI:**
```bash
elt ui
# Opens at http://127.0.0.1:8000
```

**Features:**
- ✅ 25+ data sources (GitHub, Stripe, Salesforce, Postgres, etc.)
- ✅ 15+ destinations (Snowflake, BigQuery, Redshift, DuckDB, etc.)
- ✅ Smart tool selection (automatically chooses dlt or Sling)
- ✅ Source configuration (beyond credentials - what data to load)
- ✅ Interactive CLI with multiselect, boolean, text prompts
- ✅ Modern web UI with dynamic forms
- ✅ Git integration (auto-commit and push)
- ✅ **Event-driven sensors** for automated pipeline orchestration

### 2. **dagster_elt_project/** - Dagster Orchestration
Automated Dagster integration that discovers and orchestrates your pipelines.

**Features:**
- ✅ Auto-discovery of pipelines from `pipelines/` directory
- ✅ Asset-based architecture
- ✅ Scheduling support (cron expressions)
- ✅ Grouping by asset groups
- ✅ Full observability through Dagster UI

**Usage:**
```bash
cd dagster_elt_project
pip install -e .
dagster dev
# Open http://localhost:3000
```

### 3. **elt_pipelines_example/** - Sample Project
A complete, standalone example project with working pipelines.

**Includes:**
- ✅ GitHub Issues pipeline (dlt)
- ✅ Postgres to DuckDB replication (Sling)
- ✅ Configuration files for Dagster
- ✅ Run script for easy testing
- ✅ Comprehensive README

**Usage:**
```bash
cd elt_pipelines_example
cp .env.example .env
# Edit .env with your credentials
./run_pipeline.sh
```

---

## 🏗️ Architecture

```
embedded_elt_builder/
├── embedded_elt_builder/           # Core package
│   ├── cli/                        # CLI commands
│   │   ├── main.py
│   │   ├── scaffold.py
│   │   ├── list_pipelines.py
│   │   ├── delete.py
│   │   └── ui.py
│   ├── web/                        # Web UI
│   │   ├── app_enhanced.py         # FastAPI backend
│   │   ├── credentials_config.py   # Source/dest configs
│   │   ├── templates/
│   │   │   └── index_enhanced.html
│   │   └── __main__.py
│   └── pipeline_generator.py       # Shared pipeline generation
│
├── dagster_elt_project/            # Dagster orchestration
│   ├── components/
│   │   ├── dlt_component.py        # Auto-discover dlt pipelines
│   │   └── sling_component.py      # Auto-discover Sling replications
│   ├── schemas/
│   │   ├── dagster.yaml.schema
│   │   └── config.yaml.schema
│   └── __init__.py
│
└── elt_pipelines_example/          # Sample project
    ├── pipelines/
    │   ├── dlt/
    │   │   └── github_issues/
    │   │       ├── pipeline.py
    │   │       ├── dagster.yaml
    │   │       └── config.yaml
    │   └── sling/
    │       └── postgres_to_duckdb/
    │           ├── replication.yaml
    │           ├── dagster.yaml
    │           └── config.yaml
    ├── .env.example
    ├── run_pipeline.sh
    └── README.md
```

---

## 🚀 Quick Start Guide

### Step 1: Install the Core Package

```bash
cd embedded_elt_builder
pip install -e .
```

### Step 2: Try the CLI

```bash
# Interactive pipeline creation
elt scaffold create my_pipeline --source github --destination snowflake

# List pipelines
elt list

# Launch web UI
elt ui
```

### Step 3: Try the Example Project

```bash
cd elt_pipelines_example

# Set up environment
cp .env.example .env
nano .env  # Add your credentials

# Run a pipeline
./run_pipeline.sh
```

### Step 4: Add Dagster Orchestration

```bash
cd dagster_elt_project
pip install -e .
dagster dev
```

Open http://localhost:3000 and see your pipelines as Dagster assets!

---

## 📝 Configuration Files

Every pipeline has three configuration files:

### 1. Pipeline Code/Config
- **dlt**: `pipeline.py` - Python code
- **Sling**: `replication.yaml` - YAML configuration

### 2. dagster.yaml (Dagster Configuration)
```yaml
enabled: true
description: "Pipeline description"
group: "asset_group"

schedule:
  enabled: true
  cron: "0 2 * * *"
  timezone: "UTC"

owners:
  - "team@company.com"

retries: 3
retry_delay: 60
```

### 3. config.yaml (Pipeline Metadata)
```yaml
source_type: "github"
destination_type: "snowflake"

source_configuration:
  repos: "dlt-hub/dlt"
  resources: ["issues", "pull_requests"]

tool: "dlt"
version: "1.0.0"
```

---

## 🎯 Common Workflows

### Create a New Pipeline

**Using CLI (Interactive):**
```bash
elt scaffold create stripe_to_snowflake \
  --source stripe \
  --destination snowflake
```

**Using Web UI:**
```bash
elt ui
# Use the form to create pipelines
```

### Run Pipelines Standalone

**dlt pipeline:**
```bash
cd pipelines/dlt/my_pipeline
python pipeline.py
```

**Sling replication:**
```bash
cd pipelines/sling/my_replication
sling run -r replication.yaml
```

### Run with Dagster

```bash
cd dagster_elt_project
dagster dev
# Materialize assets in the UI
```

---

## 🔧 Supported Sources & Destinations

### Sources (25+)
- **APIs**: GitHub, Stripe, Shopify, Salesforce, HubSpot, Slack, Notion, Zendesk, Jira
- **Databases**: Postgres, MySQL, MongoDB, DuckDB, SQLite
- **Cloud Storage**: S3, GCS, Azure Blob
- **Analytics**: Google Analytics, Mixpanel, Segment
- **Files**: CSV, JSON, Parquet

### Destinations (15+)
- **Cloud Warehouses**: Snowflake, BigQuery, Redshift, Databricks
- **Databases**: Postgres, MySQL, DuckDB, MotherDuck, ClickHouse
- **Local**: SQLite, Filesystem

---

## 🎨 Source Configuration

Beyond credentials, configure **what data** to load:

**GitHub:**
- Which repositories
- Which resources (issues, PRs, commits)

**Stripe:**
- Which resources (customers, invoices, charges)

**Postgres:**
- Which schemas and tables
- Incremental vs full refresh

**And more!**

---

## 📚 Directory Structure

### Your ELT Repository
```
my-elt-pipelines/
├── .env                    # Credentials (git-ignored)
├── pipelines/
│   ├── dlt/
│   │   ├── github_issues/
│   │   ├── stripe_charges/
│   │   └── salesforce_accounts/
│   └── sling/
│       ├── postgres_to_snowflake/
│       └── mysql_to_bigquery/
└── README.md
```

### With Dagster
```
my-elt-pipelines/
├── .env
├── pipelines/              # Your pipelines
├── dagster_elt_project/    # Copy from this repo
└── pyproject.toml
```

---

## 🧪 Testing

### Test the CLI
```bash
# Create a test pipeline
elt scaffold create test_pipeline \
  --source github \
  --destination duckdb \
  --no-interactive

# Verify it was created
elt list

# Delete it
elt delete test_pipeline
```

### Test the Web UI
```bash
# Start the UI
elt ui

# Open http://127.0.0.1:8000
# Create, view, and delete pipelines through the UI
```

### Test Example Pipelines
```bash
cd elt_pipelines_example
cp .env.example .env
# Add GITHUB_TOKEN to .env
cd pipelines/dlt/github_issues
python pipeline.py
```

---

## 🎓 Learning Resources

### dlt (Python ELT)
- [dlt Documentation](https://dlthub.com/docs)
- [Verified Sources](https://dlthub.com/docs/dlt-ecosystem/verified-sources)
- [Custom Sources Tutorial](https://dlthub.com/docs/tutorial/load-data-from-an-api)

### Sling (YAML-based Replication)
- [Sling Documentation](https://docs.slingdata.io)
- [Connectors](https://docs.slingdata.io/connections)
- [Replication Config](https://docs.slingdata.io/sling-cli/run)

### Dagster (Orchestration)
- [Dagster Docs](https://docs.dagster.io)
- [Software-Defined Assets](https://docs.dagster.io/concepts/assets/software-defined-assets)
- [Schedules & Sensors](https://docs.dagster.io/concepts/partitions-schedules-sensors/schedules)

---

## 🚨 Troubleshooting

### CLI Not Found
```bash
pip install -e embedded_elt_builder/
```

### Web UI Port Conflict
```bash
elt ui --port 3000
```

### Dagster Not Finding Pipelines
- Ensure `enabled: true` in `dagster.yaml`
- Check that all required files exist
- Refresh Dagster UI (reload definitions)

### Pipeline Failing
- Verify credentials in `.env`
- Check pipeline-specific logs
- Test data source connection manually

---

## 🎉 What Makes This Special

1. **Unified Interface** - CLI and Web UI share the same pipeline generation logic
2. **Smart Tool Selection** - Automatically chooses dlt or Sling based on source/destination
3. **Beyond Credentials** - Configure what data to load, not just how to connect
4. **Dagster Ready** - Pipelines work standalone but are better with orchestration
5. **Production Ready** - Git integration, scheduling, monitoring, error handling
6. **Comprehensive** - 25+ sources, 15+ destinations, fully documented

---

## 📄 Files Reference

### Key Files in embedded_elt_builder/
- `embedded_elt_builder/pipeline_generator.py` - Core pipeline generation logic
- `embedded_elt_builder/cli/scaffold.py` - Interactive CLI pipeline creation
- `embedded_elt_builder/web/app_enhanced.py` - FastAPI backend
- `embedded_elt_builder/web/credentials_config.py` - Source/destination configs
- `embedded_elt_builder/web/templates/index_enhanced.html` - Web UI frontend

### Key Files in dagster_elt_project/
- `dagster_elt_project/__init__.py` - Main Dagster definitions
- `dagster_elt_project/components/dlt_component.py` - dlt pipeline discovery
- `dagster_elt_project/components/sling_component.py` - Sling replication discovery

### Key Files in elt_pipelines_example/
- `elt_pipelines_example/pipelines/dlt/github_issues/pipeline.py` - Example dlt pipeline
- `elt_pipelines_example/pipelines/sling/postgres_to_duckdb/replication.yaml` - Example Sling config
- `elt_pipelines_example/run_pipeline.sh` - Quick run script

---

## 🎯 Next Steps

1. **Explore the example project** - Run the sample pipelines
2. **Create your first pipeline** - Use CLI or Web UI
3. **Set up Dagster** - Get orchestration and monitoring
4. **Customize for your needs** - Add your data sources
5. **Deploy to production** - Use Dagster Cloud or self-hosted

---

## 💡 Pro Tips

- Use the **Web UI** for visual pipeline creation
- Use the **CLI** for automation and scripting
- Use **Dagster** for production orchestration
- Store credentials in `.env` files (never commit!)
- Use `dagster.yaml` to control scheduling
- Group related pipelines with `group` field
- Add `owners` for accountability
- Enable only the pipelines you need

---

## 🙏 Support

For questions or issues:
- Check the README files in each directory
- Review the example pipelines
- Check dlt/Sling/Dagster documentation
- Inspect configuration schemas

---

**Happy data engineering! 🚀**
