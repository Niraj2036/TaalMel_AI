# TaalMel AI — Autonomous Financial Reconciliation Engine

**Razorpay Buildathon · Track 4: Financial Reconciliation Engine**  
**Repository**: [https://github.com/Niraj2036/TaalMel_AI](https://github.com/Niraj2036/TaalMel_AI)

---

## Executive Overview & Documentation Links

**TaalMel AI** is an autonomous, production-grade 3-way financial reconciliation engine designed to reconcile Bank Statement Deposits $\leftrightarrow$ Payment Gateway Settlements $\leftrightarrow$ ERP Invoices with **100% Precision**, **0% False Automation**, and sub-second execution speeds.

The system features:
- **Paise-Level Integer Arithmetic**: BigInt minor unit calculations (`paise = rupees * 100`) preventing floating-point rounding drift.
- **Group-First Settlement Architecture**: Group matching (`N:1`, `1:N`, `N:M`, charge + refund netting) executed prior to 1:1 matching to protect multi-item batch integrity.
- **Evidence Gate & ICFR Guardrails**: Multi-factor confidence scoring ensuring only verified matches are cleared, while unverified AI hypotheses leave exceptions open without fabricating journal entries.
- **Tier-2 Autonomous AI Solver & AI Copilot**: Interactive markdown-formatted copilot and background exception investigator.

---

### 📖 Documentation Sitemap

* 📘 **[Reconciliation Flow & Architecture Specification](reconciliation.md)**  
  Detailed step-by-step breakdown of two-tier normalization, group-first 4-pass engine, evidence gate scoring, and non-blocking background persistence.

* 📊 **[Empirical Ground Truth Benchmark Report](reports.md)**  
  Comprehensive performance metrics across all 4 official benchmark datasets (Level 1, Level 2, Level 3 Nightmare, and Mixed Test).

---

## End-to-End System Flow Summary

```mermaid
flowchart TD
    A["Raw Data Ingestion\n(Bank Statement, Gateway Data, ERP Ledger)"] --> B["1. Two-Tier Normalization & Minor Unit Math\n(Paise conversion & LLM schema inference fallback)"]
    B --> C["2. Pre-Processing & Decoy Filtration\n(Keyword rejection & 45-day date lag window)"]
    C --> D["3. Group-First 4-Pass Matching Engine\n(N:1, 1:N, N:M split settlements & 1:1 exact matching)"]
    D --> E["4. Evidence Gate Scoring\n(UTR, Amount, Reference, Date & Batch checks)"]
    E --> F["5. Exception Controller & Tier-1 Resolver\n(Double-entry self-healing journal proposals)"]
    F --> G["6. Tier-2 AI Solver & ICFR Guardrails\n(Verified vs Tested & Rejected LLM Hypotheses)"]
```

### Brief Step Breakdown
1. **Ingestion & BigInt Normalization**: Parsed CSV data is converted to BigInt minor units (paise). Schema heuristics normalize columns across bank, gateway, and ERP formats with an LLM fallback for non-standard formats.
2. **Pre-Processing & Decoy Filtration**: Semantic text analysis filters out decoy entries (`WRONG REFERENCE`, `FALSE`) and sets date lag windows up to 45 days.
3. **Group-First 4-Pass Matching Engine**:
   - **Pass 1**: Multi-item settlement matching (N:1 aggregate payouts, 1:N installments, N:M split settlements, charge + refund netting).
   - **Pass 2**: Direct 1:1 exact hash-bucket matching.
   - **Pass 3**: ERP invoice to bank credit subset-sum DP solver.
   - **Pass 4**: ERP invoice to matched gateway transaction cross-linking.
4. **Evidence Gate Verification**: Computes a 0–100 confidence score based on UTR match, reference match, sum equality, date proximity, and settlement batch ID.
5. **Exception Resolution & Self-Healing Journals**: Categorizes unmatched entries into specific exception types (`FEE_MISMATCH`, `TDS_ANOMALY`, `MISSING_IN_BANK`, `MISSING_IN_LEDGER`, `AMOUNT_MISMATCH`) and generates balanced double-entry journal proposals ($\sum \text{Debits} == \sum \text{Credits}$).
6. **Tier-2 AI Solver & Guardrails**: Investigates complex exceptions. If hypothesis verification fails, no journal entry is generated, and the **Tested & Rejected LLM Hypothesis** card is displayed with the exact failure reason.

---

## Benchmark Performance Summary

The engine was evaluated across **all 4 benchmark suites** (925 total bank transactions) against ground-truth expected outcomes:

| Evaluation Dataset | Level & Scope | Total Recs | Bank Txns | Exp. Matched | Act. Matched | Match Rate | Precision | Recall | False Auto Rate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dataset Level 1** | Basic 1:1 Suite | 422 | **135** | **132** | **132** | **97.78%** | **100.00%** | **100.00%** | **0.00%** |
| **Dataset Level 2** | Advanced Multi-Batch | 886 | **287** | **263** | **263** | **91.64%** | **100.00%** | **100.00%** | **0.00%** |
| **Dataset Level 3** | **Nightmare Stress Tier** | 1,527 | **441** | **411** | **411** | **93.20%** | **100.00%** | **100.00%** | **0.00%** |
| **Dataset Mixed Test** | Mixed Edge-Case Suite | 214 | **62** | **59** | **59** | **95.16%** | **100.00%** | **100.00%** | **0.00%** |
| **ALL COMBINED** | **Comprehensive Total** | **3,049** | **925** | **865** | **865** | **93.51%** | **100.00%** | **100.00%** | **0.00%** |

*For complete dataset-by-dataset analysis, see [reports.md](reports.md).*

---

## Environment Configuration (`.env.example`)

Before running the application, configure your environment variables based on `.env.example`:

```env
# ─── OpenRouter (LLM Key for Copilot & Schema Inference) ──────────────────────
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# ─── Database (Neon / Supabase / PostgreSQL) ─────────────────────────────────
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# ─── Reconciliation Engine Tolerances & Configuration ───────────────────────
TOLERANCE_MINOR_UNITS=1
MAX_DATE_LAG_DAYS=3
MAX_SLA_HOURS=48

# ─── Feature Flags ───────────────────────────────────────────────────────────
ENABLE_AGENT=true
```

---

## How to Run & Setup

### 1. Prerequisites
- Node.js 18.x or higher
- npm or pnpm
- PostgreSQL database (Local PostgreSQL, Neon DB, or Supabase)

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/Niraj2036/TaalMel_AI.git
cd TaalMel_AI
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to create your local `.env` file:
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `DATABASE_URL`: Your PostgreSQL database URL.
- `DIRECT_URL`: Direct connection string for Prisma migrations (if using connection pooler like Neon/Supabase).
- `OPENROUTER_API_KEY`: Your OpenRouter API key.

### 4. Database Initialization & Prisma Client
Sync the database schema and generate Prisma client:
```bash
npx prisma db push
npx prisma generate
```

### 5. Run Ground Truth Benchmark Evaluation
To execute ground-truth evaluation across all 4 benchmark datasets and print the complete precision/recall metric table:
```bash
npx tsx scripts/evaluate-all-4-datasets.ts
```

### 6. Launch Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Key Features & UI Capabilities

- **1-Click Sample Dataset Autofill**: Select from `Dataset 1 (Basic)`, `Dataset 2 (Advanced)`, `Dataset 3 (Nightmare)`, or `Mixed Test` dropdown to automatically run reconciliation.
- **7-Metric Audit Dashboard**: View Match Rate, Precision, Recall, Throughput, False Automation Rate, Review Rate, and Exception Integrity.
- **Matched Records Audit Trail**: Filter matches by cardinality (`1:1`, `1:N`, `N:1`, `N:M`) with complete audit evidence (`Bank Deposits ↔ Gateway Settlements ↔ ERP Invoices`).
- **Exception Controller & Maker/Checker Workflow**: View SLA aging warnings, review double-entry journal proposals, run Tier-2 AI investigations, and approve journal entries.
- **AI Copilot**: Ask natural language questions with tool-calling capabilities and rich markdown output.
