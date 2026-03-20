# Manual Smoke Checklist

Use this checklist after conservative stabilization changes. The goal is to confirm the current working workflows still behave the same for valid UI-driven usage.

## Before you start

- Populate `.env.local` from `.env.example`
- Confirm the database is reachable
- Confirm required third-party keys are present
- Start the app with `npm run dev`

## Smoke checks

### 1. App shell loads
- Open `http://localhost:3000`
- Confirm the main app loads without a startup error
- Confirm the sidebar and top-level views render

### 2. Existing articles load
- Open the Articles/library view
- Confirm existing article rows appear
- Open one existing article and confirm the content/editor state loads

### 3. New article outline generation
- Open New Article
- Enter a valid title, keyword, and collection/category
- Run outline generation
- Confirm the outline review step loads with sections instead of an API error

### 4. Article save/update
- Create or open an article draft
- Save it
- Make a small content edit and confirm update succeeds
- Reload the article list and confirm the draft still exists

### 5. Revamp analysis
- Open Revamp Article
- Paste a sample article or use the existing workflow input
- Run analysis
- Confirm the analysis step returns data instead of a validation/runtime error

### 6. Diagnostics and logs
- Open Connections
- Confirm diagnostics load without exposing raw secrets
- Open Logs
- Confirm entries load and metadata appears redacted where appropriate

### 7. Publish validation
- Exercise the publish flow with a deliberately incomplete payload and confirm the route returns a clear validation error
- If using a safe test article, confirm a valid publish request still reaches Shopify successfully

### 8. Migration guard
- Call `/api/migrate` in a non-enabled environment
- Confirm it returns a clear 403 explaining how to enable it intentionally

## Regression focus

- No UI routing changes
- No autosave behavior changes
- No changed article/revamp workflow sequencing
- No new required environment variables for normal operation
- No successful publish-path behavior change for valid existing requests
