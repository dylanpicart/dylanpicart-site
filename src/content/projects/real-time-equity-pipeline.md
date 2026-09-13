---
title: "Building a Real-Time School Climate & Equity Analytics Platform"
description: "A production-grade batch and streaming ELT platform investigating whether real-time school climate signals are leading indicators of future social vulnerability — Kafka, Databricks, Snowflake, dbt, and a RAG service that lets district leaders ask equity questions in plain English."
date: 2026-01-15
langs: [Python, SQL, YAML, Bash, JavaScript]
tags: ["Data Engineering", "Data Analysis", "Compliance", "DevSecOps", "Public Health", "Open Data", "Streaming", "RAG", "Equity", "Cloud", "Research"]
published: true
featured: true
section: professional
---

**Stack: Kafka · Dataproc · Databricks · Snowflake · dbt · FastAPI · LangChain · Chroma · React/TypeScript · Power BI · GCP · Terraform · CI/CD**

Understanding what's happening inside a school community requires more than annual reports. School climate — trust, safety, belonging, fairness — changes quickly, and decisions based on stale data can leave the most vulnerable students behind. Worse, traditional reporting keeps climate data and community vulnerability data in separate silos, making it nearly impossible to ask the most important equity question: *are the schools serving the most structurally vulnerable communities also the ones with the weakest climate signals?*

This project is my answer to that question. It's a production-ready, end-to-end data platform that unifies streaming school climate microdata, batch social vulnerability data, a dbt semantic layer, a Power BI dashboard for district leaders, and an AI-assisted analytics service that lets non-technical stakeholders ask complex equity questions in plain English.

---

## 1. The Research Question & Hypotheses

SVI (Social Vulnerability Index) captures **structural** community conditions — income inequality, housing stability, linguistic isolation, disability prevalence. School climate indicators capture **real-time social dynamics** — student safety perceptions, teacher working conditions, parent engagement, institutional trust. These are fundamentally different timescales.

Because SVI is released only every several years, school-climate microdata may reveal **early signals of positive or negative change** that won't appear in structural indicators until the next update cycle. This creates a research opportunity: can we use real-time climate signals to *predict* where structural vulnerability is heading, rather than just describe where it is?

### Primary Hypothesis — Climate as a Leading Indicator

> **Real-time improvements or declines in school climate are leading indicators of future shifts in community-level social vulnerability.**

Specifically: communities showing sustained improvements in school climate between 2023–2025 are more likely to exhibit reduced vulnerability in the next SVI release. Communities with declining climate indicators are more likely to exhibit persistent or worsening structural vulnerability.

The rationale is grounded in existing research: school climate consistently correlates with family stability, youth mental health, neighborhood safety, and social cohesion — all of which mirror the underlying themes of SVI. But climate changes within weeks or months, while structural indicators shift over years. This lag makes climate a **real-time barometer** of community well-being.

### Secondary Hypothesis — Participation as a Hidden Predictor

> **Lower participation rates are predictive of lower SVI and School Climate results among the answers that *are* submitted.**

Schools and districts with lower student, parent, or teacher participation rates will show systematically lower climate scores and correspondingly higher social vulnerability. Participation is not random — it is shaped by trust, safety, communication stability, and family engagement, all of which are deeply intertwined with SVI components.

This positions **participation rate itself as a meta-signal of community vulnerability** — both a confounder and a predictor that must be included in any model aiming to forecast vulnerability movement.

### A Note on SVI 2022 and Why It's Methodologically Sound

The CDC's SVI is released for specific ACS 5-year windows, not annually. The latest available release — **SVI 2022** — represents ACS estimates from 2018–2022, spanning pre-pandemic stability, the acute disruption period, and early recovery. There is no SVI 2023, 2024, or 2025; the next release will likely represent a 2023–2027 window.

This is methodologically appropriate for our analysis for two reasons. First, SVI measures *structural* variables — income distribution, housing stability, vehicle access, linguistic isolation, disability rates — that shift over multi-year trends, not single years. SVI 2022 remains analytically valid as a baseline for 2023, 2024, and 2025 observations. Second, the 2018–2022 window is uniquely valuable because it captures both pre-COVID structural conditions and the lasting impacts of the pandemic: increased housing instability, displacement, uneven recovery, and shifts in employment and healthcare access. SVI 2022 is therefore the correct dataset to contextualize climate observations during the COVID recovery era — not a limitation, but a feature.

### The Four SVI Themes

The CDC SVI scores census tracts across four vulnerability themes:

- **Theme 1 — Socioeconomic Status:** poverty, unemployment, housing cost burden
- **Theme 2 — Household Composition & Disability:** elderly, children, disability, single-parent households
- **Theme 3 — Minority Status & Language:** racial minority concentration, linguistic isolation
- **Theme 4 — Housing & Transportation:** multi-unit structures, mobile homes, vehicle access, crowding, no broadband

NYC's annual School Climate Survey captures response rates and engagement signals from **students, teachers, and parents** across every public school. A school in a high-SVI tract — economically stressed, linguistically isolated, housing-insecure — should show different patterns from a school in a low-SVI tract. But the more actionable question is whether those patterns *predict* where the SVI is heading, not just where it's been.

### The Empirical Plan

**Step 1:** Build a multi-year Gold Climate + Participation dataset (2023–2025) with daily/weekly aggregates per school/district — climate scores, participation counts and rates, response completeness, sentiment distributions.

**Step 2:** Join with SVI 2022 baseline using census tract FIPS via a DBN ↔ tract crosswalk.

**Step 3:** Label districts by trajectory — Improving, Stable, Declining, Volatile, or Low-participation underreporting patterns — using clustering across the three-year window.

**Step 4:** Test correlations with SVI themes using Pearson/Spearman correlations, mixed-effects models, participation-weighted regression, temporal slope analysis, and multilevel modeling by tract and district.

**Step 5:** Predict future SVI movement. Inputs: SVI 2022 as baseline, climate slopes as predictors, participation slopes as meta-predictors, tract-level population weighting. Schools with improving climate *and* stable or rising participation should align with tracts that show reduced vulnerability in the next SVI release.

The platform is designed to make each of these steps possible, repeatable, and available to decision-makers who don't write SQL — which is where the architecture and the RAG service connect back to the research design.

---

## 2. The Data Sources

### NYC School Climate Survey (NYC DOE)

Annual survey of students, teachers, and parents across ~1,800 schools. The platform tracks three primary response-rate metrics — **Student Response Rate, Teacher Response Rate, Parent Response Rate** — and the underlying survey questions organized into domains: Safety, Relationships, Engagement, and Communication.

The semantic layer stores every active survey question with its group (Student/Teacher/Parent), domain, and response scale, making it queryable by the RAG service.

### CDC Social Vulnerability Index (SVI)

Census-tract-level vulnerability scores from the CDC, aggregated from ACS data. Each tract gets a composite `SVI_OVERALL_SCORE` (0–1) and four theme scores (`RPL_THEME1`–`RPL_THEME4`). Tracts are bucketed LOW / MEDIUM / HIGH for dashboard filtering.

The platform joins SVI tracts to NYC school districts via census geography, making the correlation between `SVI_OVERALL_BUCKET` and climate response rates queryable at borough, district, and school granularity.

---

## 3. Architecture Overview

![Architecture: streaming, batch, and analytics paths converging into Snowflake Gold and a Power BI dashboard](/images/equity-pipeline-architecture.svg)

```
         ┌─────────────────────────┐     ┌──────────────────────────┐
         │   NYC Climate API        │     │       CDC SVI REST API   │
         │ (Real-time Streaming)    │     │     (Batch Ingestion)    │
         └─────────────┬───────────┘     └──────────────┬───────────┘
                       │                                │
                       ▼                                ▼
                 Kafka (Confluent)             Dataproc Serverless
                       │                         (PySpark)
                       ▼                                │
              Databricks Spark                          ▼
           Structured Streaming               GCS Bronze / Silver
                       │                                │
                       └────────────────┬───────────────┘
                                        ▼
                              dbt → Snowflake Gold
                         (Semantic Models + Metrics Layer)
                                        ▼
              ┌─────────────┬───────────────────────┬──────────────────┐
              ▼             ▼                       ▼                  ▼
         Power BI     FastAPI RAG Service     APIs / Apps     Other Consumers
        Dashboard    (LangChain + Chroma)
```

The medallion architecture is the spine: **Bronze** (raw, minimally processed), **Silver** (typed, cleaned, deduplicated Parquet), **Gold** (dbt-modeled, semantically-enriched Snowflake tables ready for consumption). Every layer is independently queryable and tested.

---

## 4. Streaming Path: Kafka → Databricks → GCS

NYC Climate microdata flows into a **Confluent Kafka topic** using SASL_SSL authentication with a custom producer that handles dynamic JSON parsing and partitioning for scalability.

**Databricks Spark Structured Streaming** reads from that topic with micro-batch processing:

```python
raw_stream = (
    spark.readStream
    .format("kafka")
    .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
    .option("kafka.sasl.mechanism", "PLAIN")
    .option("kafka.security.protocol", "SASL_SSL")
    .option(
        "kafka.sasl.jaas.config",
        f'org.apache.kafka.common.security.plain.PlainLoginModule required '
        f'username="{KAFKA_KEY}" password="{KAFKA_SECRET}";'
    )
    .option("subscribe", TOPIC)
    .option("startingOffsets", "earliest")
    .load()
)
```

Each micro-batch applies deduplication, timestamp normalization, schema enforcement, and watermarking before writing to **GCS Bronze** as Parquet. The streaming query is named (`queryName("bronze_stream")`) — a lesson I learned after Dataproc metrics serialization silently crashed unnamed queries.

---

## 5. Batch Path: CDC SVI → Dataproc → GCS

The SVI pipeline uses Python to hit the CDC REST API, clean and validate the response, and write raw data to GCS Bronze. A **Dataproc Serverless PySpark** job then runs the Bronze → Silver transformation: casting types, deduplicating on `TRACT_FIPS`, and partitioning the output by state.

```python
# Dataproc Serverless job entry point
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, to_date, trim

spark = SparkSession.builder.appName("svi_silver").getOrCreate()

df = spark.read.parquet(f"gs://{BUCKET}/bronze/svi/")

silver = (
    df.dropDuplicates(["TRACT_FIPS"])
      .withColumn("COUNTY_FIPS", trim(col("COUNTY")))
      .withColumn("LOAD_DATE", to_date(col("LOAD_TS").cast("string")))
      .filter(col("SVI_OVERALL_SCORE").isNotNull())
)

silver.write.mode("overwrite").parquet(f"gs://{BUCKET}/silver/svi/")
```

---

## 6. Snowflake + dbt: The Gold Layer

dbt handles all transformations into Gold: schema alignment between the climate and SVI datasets, referential integrity, automated data tests, and versioned models. Gold materializations include:

- `SCHOOL_CLIMATE_SNAPSHOT` — district-level aggregates of response rates (the Power BI source)
- `DIM_CLIMATE_QUESTION` — every active survey question with group, domain, and response scale
- `DIM_CLIMATE_METRIC_DEFINITION` — metric formulas and plain-language definitions
- `DIM_SVI_DEFINITION` — SVI theme descriptions, metric explanations, and bucket logic
- `GOLD_CLIMATE_VULNERABILITY` — per-tract SVI scores joined to NYC geography

Every model has dbt tests for nullability, uniqueness, and referential integrity. The CI pipeline runs `dbt compile` and `dbt parse` on every pull request against a dummy Snowflake profile — validating the entire DAG without touching the warehouse.

```yaml
# dbt/dbt_project.yml (excerpt)
models:
  school_climate:
    svi:
      bronze:
        +schema: "BRONZE"
        +materialized: view
      silver:
        +schema: "SILVER"
        +materialized: table
      gold:
        +schema: "GOLD"
        +materialized: table
```

---

## 7. The Semantic Layer: Making Data Queryable by Meaning

The most important architectural decision in this project was building a **semantic layer** alongside the numeric Gold tables. dbt seeds populate three dimension tables that describe *what the data means* — not just what the numbers are:

- **`DIM_CLIMATE_QUESTION`** stores every survey question with its plain-language text, survey group (Student/Teacher/Parent), domain (Safety/Relationships/Engagement), and response scale. A district leader can ask "what does the parent safety question actually say?" and get a grounded answer.
- **`DIM_CLIMATE_METRIC_DEFINITION`** stores metric labels, calculation formulas, and definitions in plain English. "Parent Response Rate = (parents who submitted / parents invited) × 100."
- **`DIM_SVI_DEFINITION`** stores the meaning of each SVI theme and metric, including bucket logic: what does a HIGH overall SVI score actually mean for a community?

This semantic layer is what makes the RAG service possible. Without it, the AI layer would only have numeric values to reason over.

---

## 8. Power BI Dashboard

<div class="scroll-x">
  <img src="/images/equity-powerbi-dashboard.jpg" alt="NYC School Climate Snapshot Dashboard — Powered by Kafka → Databricks → Snowflake → Power BI, showing average student, parent, and teacher response rates by borough and district, a distribution histogram, and school-level rankings" />
</div>

**NYC School Climate Snapshot Dashboard** — Kafka → Databricks → Snowflake → Power BI

The dashboard surfaces three headline metrics per borough and district: **Average Student Response Rate (0.82)**, **Average Parent Response Rate (0.47)**, and **Average Teacher Response Rate (0.84)**. Slicers let stakeholders filter by borough (Bronx, Brooklyn, Manhattan, Queens, Staten Island) and by district number, drilling from the aggregate table down to individual school rankings.

The color-coded matrix highlights outliers: rows flagged red indicate parent response rates below the borough average — exactly the schools where outreach may be falling short in high-SVI communities. The histogram shows that while most schools cluster between 0.8–1.0 on student response rate, a long left tail of low-responding schools exists that aggregate borough averages mask entirely.

This dashboard answers the operational question. The RAG service answers the *interpretive* question.

---

## 9. The RAG Service: AI-Assisted Equity Analytics

The RAG layer transforms the pipeline from a traditional ELT system into a **decision-support tool** — one that lets district leaders ask complex equity questions in plain English and receive grounded, contextual answers backed by validated Gold data.

### Architecture

```
FastAPI → LangChain Retriever → Chroma Vector DB (5K+ docs)
       → Snowflake Gold (live metrics)
       → GPT-4.1-mini
       → Structured response (narrative + bullets + citations)
```

The Chroma index is built from the four semantic sources in the Gold layer — climate questions, metric definitions, SVI definitions, and per-tract vulnerability summaries. Each document is tagged with its `source_type` so the retriever can contextualize its answer:

```python
def format_docs_for_prompt(docs: List[Document]) -> str:
    for d in docs:
        source_type = d.metadata.get("source_type", "unknown")
        prefix_map = {
            "climate_question": "[CLIMATE_QUESTION]",
            "climate_metric":   "[CLIMATE_METRIC]",
            "svi_definition":   "[SVI_DEFINITION]",
            "svi_tract":        "[SVI_TRACT]",
        }
        prefix = prefix_map.get(source_type, "[CONTEXT]")
```

### The Four Query Modes

The API accepts a `mode` field that selects the appropriate prompt template:

**`district_risk_overview`** — Connect SVI vulnerability themes to climate metrics for a specific district. Example: *"What are the top risk indicators for District 29?"* The response includes a plain-language paragraph for leadership and 3–5 structured bullets mapping each SVI theme to a specific climate metric.

**`explain_metric`** — Explain a climate metric in depth. Example: *"What does Parent Response Rate actually measure, and why does it matter for equity?"* The response defines the metric, explains its formula, and connects it to SVI patterns.

**`explain_question`** — Deep-dive on a specific survey question. Example: *"What does the parent safety question mean for communities with high housing instability?"* The response draws from `DIM_CLIMATE_QUESTION` and `DIM_SVI_DEFINITION` to ground the interpretation.

**`compare_districts`** — Side-by-side district comparison. Example: *"Compare Districts 29 and 30 using SVI and climate metrics."* The response surfaces similarities, differences, and caveats about response bias or missing data.

```python
# POST /api/rag/query
{
  "question": "What are the top risk indicators for District 29?",
  "district_id": 29,
  "year": 2024,
  "mode": "district_risk_overview"
}

# Response
{
  "answer": "District 29...",
  "high_level_bullets": [
    "Theme: Socioeconomic Status (Theme 1) – Metric: Student Response Rate – ...",
    "Theme: Housing & Transportation (Theme 4) – Metric: Parent Response Rate – ..."
  ],
  "metrics": [
    { "metric_name": "Average Parent Response Rate", "value": 0.42, "source": "SCHOOL_CLIMATE.GOLD.SCHOOL_CLIMATE_SNAPSHOT" }
  ],
  "citations": [
    { "id": "svi_tract::36081000100", "source_type": "svi_tract", "source_id": "36081000100" }
  ]
}
```

Every response includes citations pointing back to the source documents in Chroma and the Snowflake Gold tables — so a stakeholder can always trace an AI-generated insight back to the underlying data.

### Dev vs. Prod Mode

The service ships with a `FakeChatLLM` that returns structured, realistic-looking responses without any API calls — critical for development, CI testing, and demos that can't incur OpenAI costs. Switching to production is two environment variables:

```bash
USE_FAKE_EMBEDDINGS=false
USE_FAKE_LLM=false
```

---

## 10. Engineering Challenges I Solved

This is the section most pipeline write-ups skip. These are the real problems — the ones that aren't in any tutorial.

**Dataproc CPU Quota was 0.** GCP trial projects start with zero CPU quota for Dataproc, meaning no job can start. Fix: enable billing, then request quota increases for `CPUS_ALL_REGIONS` and `DISKS_TOTAL_GB` through the GCP console.

**Spark couldn't find the Kafka connector.** `Failed to find data source: kafka`. Fix: add `spark-sql-kafka-0-10_2.12` matching the exact Spark runtime version. Version mismatches here are completely silent until runtime.

**Kafka JAAS authentication failed.** Spark's SASL_SSL configuration for Confluent requires an explicit JAAS config string passed as a `.option()` — not just bootstrap server and protocol. Took longer to find the exact format than to fix it.

**Dataproc metrics serialization NPE.** Unnamed streaming queries caused a null pointer exception in Dataproc's internal metrics serializer. Fix: add `.queryName("bronze_stream")` to every streaming write. This one cost the most time relative to the simplicity of the fix.

**Databricks Serverless couldn't access GCS.** Cross-cloud restrictions, disabled DBFS and `/tmp`, and missing Hadoop connector configs meant Databricks couldn't read directly from GCS. Solution: export a representative Silver Parquet sample, upload manually to Databricks, generate a Delta table, use Databricks for exploration and prototype modeling only. This shaped the architecture — Databricks became the sandbox, not the production compute layer.

**Cloud Shell dropped environment variables.** Cloud Shell resets after idle periods. Every session required re-exporting credentials. Fix: wrap credential exports in a shell script committed to the repo (secrets stored separately in Secret Manager, referenced not committed).

**GCS networking was broken — required a full VPC reset.** The hardest debugging session. Dataproc couldn't write to GCS despite correct IAM configuration. Logs showed `Unable to resolve storage.googleapis.com` and `Connection reset by peer`. Root cause: the default VPC and subnets were corrupted during earlier networking experiments.

```bash
# The fix
gcloud compute networks delete default
gcloud compute networks create default --subnet-mode=auto
```

GCS writes succeeded immediately after. The lesson: networking failures in GCP almost always masquerade as IAM errors. Check the VPC before spending hours on service account permissions.

---

## 11. CI/CD and DevSecOps

The repository implements a full DevSecOps pipeline with segregated CI (validate only) and CD (manual apply).

**CI** runs on every push and PR: `pre-commit` hooks (whitespace, YAML, `detect-secrets`, `black`, `ruff`, `flake8`), `pytest`, `dbt deps` + `dbt parse` against a dummy CI profile, and `terraform fmt -check` + `terraform validate`. **No secrets are used in CI — the entire validation chain runs clean.**

**CD** is a manual `workflow_dispatch` workflow that can run `dbt` against Snowflake or Databricks, or apply Terraform, with credentials loaded from GitHub Secrets at runtime. Deployments are explicit, auditable, and require human intent.

**Terraform** provisions the entire infrastructure from scratch across GCP (GCS buckets, IAM, Dataproc configs, networking), Snowflake (warehouse, database, roles), and Databricks (secret scopes, cluster config). Provider versions are pinned to prevent supply-chain drift. Zero credentials in version control — `detect-secrets` runs on every commit to enforce this.

---

## 12. What This Demonstrates

Beyond the technical stack, this project demonstrates something harder to quantify: **the ability to hold a research question, an engineering architecture, and a stakeholder communication layer in mind simultaneously, and make them reinforce each other.**

The research question drove the data model. The data model drove the semantic layer. The semantic layer made the RAG service possible. The RAG service made the research question answerable by people who will never write a SQL query.

That's the pipeline that matters most — the one from raw data to human understanding.

**[View the repository on GitHub](https://github.com/dylanpicart/rt-sch-cli-equity-pipeline)**
