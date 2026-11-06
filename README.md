# Cloudbook Desk

Practice management for **Cloudbook Associates LLP**, a small accounting, tax and compliance firm. It tracks every client job from start to cash:

- **Dashboard**: work finished but not invoiced, receivables and ageing, collections, margin, overdue jobs, team load, and what is due in the next 14 days.
- **Jobs**: one record per piece of client work, with owner, due date, status, fee, budget hours, government fees to recover, and a repeat pattern (monthly GST, quarterly TDS, yearly ROC).
- **Job costing**: hours logged × each person's cost rate gives the real cost of every job, its margin, what each hour earned, and realisation against bill rates. Until time is logged, cost is estimated from budget hours.
- **Timesheet**: weekly hours by person and day, with quick entry.
- **Invoices and payments**: raise an invoice from finished jobs (fee + GST + reimbursements), record payments, and record TDS deducted by clients separately.
- **Deadlines**: open jobs by due date, plus a calendar of standard Indian due dates (GST, TDS, advance tax, ITR, LLP and ROC filings).
- **Reports**: profitability by client and by service, team utilisation, and a monthly summary. Each report exports to CSV.
- **Clients**, **Team and services** (cost rates, bill rates, standard fees), and **Settings and data** (firm details, backup, restore).

It is plain HTML, CSS and JavaScript, so there is no build step, no server and no database to run.

## Run it on your computer

Open `index.html` in Chrome or Edge. To use a local web server instead:

```bash
cd cloudbook-desk
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish it with GitHub Pages (free)

1. Create a new repository on GitHub, for example `cloudbook-desk`. A **private** repository is best for a firm tool, though GitHub Pages on a private repository needs a paid GitHub plan. On a free plan, use a public repository: the code holds no client data.
2. Upload the files, either by dragging this folder into the repository's **Add file → Upload files** page, or with git:

   ```bash
   cd cloudbook-desk
   git init
   git add .
   git commit -m "Cloudbook Desk first version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/cloudbook-desk.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then branch `main` and folder `/ (root)`. Save.
4. After a minute, the site is live at `https://<your-username>.github.io/cloudbook-desk/`.

## Where your data lives

- Everything you enter is saved in **your browser on that computer** (localStorage). Nothing is sent to GitHub or to any server.
- The code in the repository contains **no client data**. Only the sample firm in `assets/demo-data.js`, which is fictional.
- **Never commit a backup file** (`*.json`) to the repository. `.gitignore` blocks the usual names, but check before you push.
- Take a backup every week from **Settings and data → Download backup**. Use the same file to move to another computer or browser (**Restore or import**).
- Clearing browser data, or using a private window, removes what is stored in that browser. Keep backups.

## Getting started with real data

1. Open the site and choose **Start with my own data**, or import the prepared file `cloudbook-desk-my-data.json` from **Settings and data → Restore or import**.
2. Set each person's **cost rate** under **Team and services**: (monthly salary + share of rent, software and overheads) ÷ productive hours per month.
3. Check the **standard fees and budget hours** for each service.
4. Log time daily. Job margins become real as soon as time is logged.
5. When a job is done, mark it **Filed / Done**, raise the invoice (use the same number as in Zoho Books), and record payments as they arrive.
6. At the start of each month, use **Jobs → Roll forward recurring** to open next period's GST, TDS and bookkeeping jobs.

## Files

```
index.html            App shell and navigation
assets/app.css        Styles (light and dark themes)
assets/app.js         Data store, calculations, pages and forms
assets/demo-data.js   Fictional sample firm for exploring
```

## Ideas for later

- Sign-in and a shared online database (for example Supabase or Firebase), so several people can use the same data from different devices.
- Reading invoices and payments straight from Zoho Books.
- Email reminders for overdue invoices and upcoming deadlines.
