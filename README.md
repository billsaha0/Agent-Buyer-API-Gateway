# Agent-Buyer API Gateway

**Razorpay Buildathon 2026 · Track 01: AI Growth & Agentic Commerce**

> **A secure API gateway that lets autonomous AI agents discover products, reason about purchases, and execute Razorpay payments — within strict spending and safety boundaries.**

---

## The Problem

Traditional e-commerce is built for humans: React pages, buttons, carts, and visual product catalogs.

An autonomous AI buyer needs something different — a **machine-readable commerce interface** that allows it to:

* Discover available tools
* Search products using natural language
* Check inventory
* Operate within a predefined budget
* Execute payments safely
* Retry without duplicate charges
* Leave a complete audit trail

The **Agent-Buyer API Gateway** provides this missing layer.

---

## How It Works

```text
AI Buyer
   │
   ▼
/api/v1/agent/tools
   │
   ▼
Semantic Product Search
   │
   ▼
AI Product Selection
   │
   ▼
┌──────────────────────┐
│   Security Gates     │
│ Rate Limit           │
│ Budget               │
│ Inventory            │
│ Idempotency          │
└──────────┬───────────┘
           │
           ▼
     Razorpay Order
           │
           ▼
      Audit Trail
```

The key principle is:

> **The AI can make the decision, but the gateway controls whether the action is allowed.**

---

## Built Around the Track Requirements

### Bounded & Gated

Every checkout request passes through:

* **Rate Limiter** — 15 requests/minute
* **Inventory Gate** — prevents out-of-stock purchases
* **Budget Gate** — enforces the agent's approved spending limit

### Explainable & Auditable

Every successful or rejected machine decision is stored in PostgreSQL and surfaced through the Next.js admin dashboard.

### Graceful Failure

Checkout requires a **UUIDv4 idempotency key**. If an agent retries the same purchase after a network failure, the duplicate transaction is rejected instead of creating another charge/order.

### Agent-Readable Catalog

`/api/v1/agent/tools` exposes OpenAI/Gemini-compatible JSON schemas so an external agent can discover the available tools dynamically.

---

## Semantic Search

The gateway uses **PostgreSQL + pgvector** for semantic product search.

Instead of requiring exact keywords, an agent can submit natural-language intent such as:

```text
"Find me something suitable for long work-from-home sessions."
```

Gemini embeddings are used to find relevant products, after which the buyer agent reasons over the results and selects a product.

---

## Payment Flow

```text
Intent
  ↓
Tool Discovery
  ↓
Semantic Search
  ↓
Product Selection
  ↓
Budget + Inventory Checks
  ↓
Idempotency Check
  ↓
Razorpay Order
  ↓
Audit Log
```

Payments currently use the **Razorpay Node SDK in Test Mode**.

---

## Tech Stack

* **Framework:** Next.js 15 (App Router)
* **Database:** PostgreSQL + pgvector
* **ORM:** Prisma
* **AI:** Google Gemini
* **Payments:** Razorpay Node SDK
* **Runtime:** Node.js / TypeScript

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure `.env`

```env
DATABASE_URL="postgres://user:password@host:port/defaultdb?sslmode=require"

RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

GEMINI_API_KEY="your_gemini_key"
AGENT_GATEWAY_SECRET="your_internal_gateway_secret"
ADMIN_SECRET="your_admin_password"
```

### 3. Initialize Database

```bash
npx prisma db push
npx tsx --env-file=.env scripts/seed.ts
```

### 4. Start

```bash
npm run dev
```

---

## Endpoints

| Endpoint              | Purpose               |
| --------------------- | --------------------- |
| `/`                   | Admin Audit Dashboard |
| `/inventory`          | Human Inventory View  |
| `/api/v1/agent/tools` | Agent Tool Discovery  |

---

## Run the Autonomous Buyer Demo

With the server running:

```bash
npx tsx --env-file=.env scripts/simulate-external-buyer.ts
```

The simulation demonstrates:

1. **Protocol Discovery** — discovers the gateway tools
2. **Authentication** — obtains a short-lived, budget-bound session
3. **Semantic Search** — searches the catalog using natural language
4. **AI Reasoning** — selects a product and generates an idempotency key
5. **Guarded Checkout** — passes the security gates and creates a Razorpay order
6. **Audit** — records the transaction and Razorpay Order ID

---

## Why It Matters

This isn't just an AI shopping chatbot.

It explores the infrastructure required when **the buyer itself becomes an autonomous AI agent**.

The goal is simple:

> **Let AI act autonomously — without giving AI unrestricted control over money.**

**Built for Razorpay Buildathon 2026 · Track 01**
