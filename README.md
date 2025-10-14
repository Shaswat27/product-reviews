# **SignalLens: A customer voice to product & GTM insights agent**

### **Overview**

This project is an AI-powered tool that turns unstructured **customer reviews** into **actionable product & go-to-market (GTM) insights**. It's built as a demonstration of how founders and product managers can use AI to distill noisy user feedback into clear priorities for their roadmap, pricing strategy, and market positioning.

👉 **Live demo:** [_https://signallens.vercel.app/](https://signallens.vercel.app/)

---

### **AI Pipeline & How It Works**

The application fetches, processes, and synthesizes reviews in a multi-stage AI pipeline to generate insights. To improve performance and reduce costs, results from the pipeline are cached in a database.

1.  **Ingestion**: Fetches the latest product reviews from Trustpilot using the **Outscraper API**.
2.  **Extraction**: An AI model (**Anthropic's Claude 3.5 Haiku**) reads each review and extracts key **aspect-opinion pairs** (e.g., "UI" -> "confusing", "customer support" -> "very responsive").
3.  **Clustering**: The extracted aspect-opinion pairs are converted into numerical representations (embeddings) using **OpenAI's `text-embedding-3-small`** model and then grouped into clusters using the **HDBSCAN** algorithm. This groups semantically similar pieces of feedback together.
4.  **Theme Labeling**: (**Anthropic's Claude 3.5 Haiku**) analyzes each cluster to generate a concise **theme name**, a summary of the underlying issue or compliment, and a **severity score**.
5.  **Synthesis**: Finally, **OpenAI's GPT-5 mini** model generates concrete, actionable **product and GTM recommendations** for each identified theme, complete with estimated impact and effort scores.

---

### **Features**

-   **Public Access**: The application is publicly accessible, with no authentication required.
-   **Dashboard**: A clean dashboard that displays the top customer themes, severity scores, and the number of reviews that support each theme.
-   **Actionable Insights**: Each theme includes recommended **product & GTM actions** with scores for impact and effort, helping teams prioritize.
-   **Trustpilot Integration**: Search for any company on Trustpilot to analyze their reviews in real-time.

---

### **Tech Stack**

-   **Frontend:** Next.js, Tailwind CSS, shadcn/ui
-   **Backend/DB:** Supabase (Postgres + pgvector for embeddings)
-   **Deployment:** Vercel Hobby (free tier)
-   **AI Models:** Anthropic Claude 3.5 Haiku, OpenAI GPT-5 mini, OpenAI text-embedding-3-small
-   **Data Scraping:** Outscraper API for Trustpilot reviews
-   **Caching:** Pipeline results are cached in the Supabase database.

---

### **📊 Data Model (simplified)**

The AI pipeline populates and accesses a data model stored in Supabase Postgres.

-   **Review Embeddings**: Stores the raw vector, product name, and date of each customer review.
-   **Theme**: Represents a cluster of feedback, containing a generated name, summary, severity, and evidence count. This table is also used for caching theme-related results from the AI pipeline.
-   **Action**: Stores the generated recommendations, including a description, type (product or GTM), impact/effort scores, and a link to its parent theme. It also serves as a cache for synthesized actions.
-   **Manifests**: Stores a log when reviews where fetched for the particular product to limit repeat fetches within a quarter.

---

### **🔮 Roadmap**

**MVP (this repo):**

-   Live review ingestion from Trustpilot via Outscraper.
-   Dashboard with AI-generated themes and actions.
-   Deployed on Vercel.

**Next Iterations:**

-   Integrate additional review sources like G2 or App/Play Store.
-   Implement user accounts to save and track analyses over time.
-   Add trend analysis to see how themes evolve quarter-over-quarter.
-   Slack/Notion integration for automatically publishing insights to internal team channels.

---

### **🎯 Why This Project Matters**

In a competitive market, understanding the customer's voice is critical, but the process is often manual, time-consuming, and expensive. Product and marketing teams spend hours sifting through reviews, support tickets, and survey responses to identify patterns.

SignalLens addresses this by automating the entire workflow. It provides a direct line from raw, unstructured customer feedback to strategic, prioritized actions. While many tools can aggregate feedback, this project focuses on the last mile: generating opinionated product and GTM recommendations that a startup or product team can debate and act on immediately. It aims to democratize access to the kind of deep, actionable insights that are often locked behind enterprise-grade SaaS platforms, making it easier for any team to build a truly customer-centric roadmap.

---

### **📂 Repo Structure**

/src
├── /app
│   ├── /api          → API routes for the AI pipeline stages
│   └── /dashboard    → The main application dashboard
├── /components       → Reusable UI components
├── /data             → Mock data files for development
├── /lib              → Core application logic, AI functions, caching
└── /prompts          → The prompts used for the AI models
/README.md


---

### **📧 Contact**

Built by Shaswat Datta – MBA ’26 at HBS, ex-VC & consulting, building at the intersection of AI × product strategy.