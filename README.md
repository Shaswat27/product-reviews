# **Signal Lens: A customer voice to product & GTM insights agent**

### **Overview**

This project is an AI-powered SaaS-style tool that turns **customer reviews** into **actionable product & GTM insights**.\
&#x20;Built as a demo for how founders/PMs can use AI to distill noisy user feedback into **roadmap priorities, pricing tweaks, and positioning ideas**.

👉 Live demo: _(add Vercel link once deployed)_

### **Features**

- **Auth & Accounts** – email login (Supabase)

- **Dashboard** – Top 3–5 customer themes, with severity + trend indicators (week-over-week)

- **Theme Cards** – each includes recommended **product & GTM actions**, with evidence counts

- **Insights Archive** – historical “Founder 1-pagers” (saved weekly reports)

- **Settings Page** – manage account + placeholder for data source connections

- **UI Polish** – modern SaaS look using Next.js, Tailwind, shadcn/ui, and Recharts


### **Tech Stack**

- **Frontend:** Next.js, Tailwind, shadcn/ui

- **Backend/Auth/DB:** Supabase (Postgres + pgvector)

- **Charts:** Recharts

- **Deployment:** Vercel Hobby (free tier)

- **AI Pipeline (future):**

  - **Stage-1 (extraction):** Claude 3.5 Haiku / GPT-4o-mini → aspect/opinion pairs

  - **Stage-2 (synthesis):** GPT-4o / Claude Sonnet → product & GTM insights


### **📊 Data Model (simplified)**

    User(id, email, password_hash)  
    Review(id, source, text, rating, date)  
    Theme(id, name, severity, trend, evidence_count)  
    Action(id, description, type, impact_score, effort_score, theme_id)  
    InsightReport(id, date, summary, linked_themes)


### **🔮 Roadmap**

**MVP (this repo):**

- Mock review ingestion (JSON file in `/data`)

- Dashboard + Insights pages (with dummy trends & actions)

- Ready for deployment on Vercel

**Next Iterations:**

- Connect to **Trustpilot free API** for live review ingestion

- Add small **sample of G2 reviews via Apify/Outscraper** for depth

- Implement **bi-weekly email briefing** (send summary to founders/execs)

- Multi-language review support

- Slack/Notion integration for auto-publishing insights


### **🎯 Why This Project Matters**

- **Recruiter Signal:** Demonstrates end-to-end product thinking (framing → scoping → shipping).

- **Technical Proof:** Shows ability to vibe-code a SaaS product with auth, dashboard, and AI integration.

- **Business Acumen:** Focuses on **product & GTM strategy**, not just raw NLP.


### **📂 Repo Structure (expected)**

    /app/(protected)  
      /dashboard    → main insights dashboard  
      /insights     → historical reports  
      /settings     → account + data connections  
      /api          → placeholder API routes  
    /data  
      mock_reviews.json  
      mock_themes.json  
    /README.md  

### **📧 Contact**

Built by Shaswat Datta – MBA ’26 at HBS, ex-VC & consulting, building at the intersection of AI × product strategy.