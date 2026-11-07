# Cloudbook Desk

Practice management for **Cloudbook Associates LLP**, a small accounting, tax and compliance firm. It tracks every client job from start to cash:

- **Dashboard**: work finished but not invoiced, receivables and ageing, collections, margin, overdue jobs, team load, and what is due in the next 14 days.
- **Jobs**: one record per piece of client work, with owner, due date, status, fee, budget hours, government fees to recover, and a repeat pattern (monthly GST, quarterly TDS, yearly ROC).
- **Job costing**: hours logged × each person's cost rate gives the real cost of every job, its margin, what each hour earned, and realisation against bill rates. Until time is logged, cost is estimated from budget hours.
- **Timesheet**: weekly hours by person and day, with quick entry.
- **Invoices and payments**: raise an invoice from finished jobs (fee + GST + reimbursements), record payments, and record TDS deducted by clients separately.
- **Compliance**: a grid of every company, LLP and TDS client against the filings you handle (AGM, AOC-4, MGT-7, ADT-1, DIR-3 KYC, DPT-3, MSME-1, INC-20A, FLA, LLP Form 8 and 11, ITR-5/6, tax audit, GSTR-9, quarterly TDS), with due dates, overdue days, the client's late fee so far, SRN, and your fee. Marking a filing as filed creates a job that goes straight to “Ready to bill”.
- **Growth**: your fee target for the year against billed work and the pipeline (ready to bill, open jobs, compliance not yet opened, recurring work to come), the monthly run-rate needed, a ranked list of ways to earn more (bill, collect, compliance packages, GSTR-9, repricing, retainers), and each client's yearly retainer value.
- **Expenses**: every amount paid for a client (government and MCA fees, GST/TDS late fees, taxes paid for the client, DSC, stamp paper, auditor's fee, travel, courier), with the challan/CPIN/SRN, who paid it, and whether it is recovered from the client or absorbed by the firm. Recoverable expenses are offered on the client's next invoice as reimbursements at cost; absorbed ones are added to the job's cost.
- **Deadlines**: open jobs and client filings by due date, plus a calendar of standard Indian due dates (GST, TDS, advance tax, ITR, LLP and ROC filings).
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

## Excel backup

- **Automatic (Chrome or Edge on a computer):** Settings & data → **Choose backup folder**. Pick a folder inside Google Drive or OneDrive. From then on, about 3 seconds after every change, the app saves `Cloudbook-Desk-latest.xlsx` and one dated copy per day (`Cloudbook-Desk-YYYY-MM-DD.xlsx`). The browser asks for permission again once per visit: click **Resume Excel backup** on the banner.
- **Manual (any browser):** Settings & data → **Download Excel backup**.
- The Excel file has readable sheets (Summary, Clients, Jobs, Timesheet, Invoices, Payments, Expenses, Filings, Team, Services) plus a hidden `_backup` sheet. To restore, choose the .xlsx file under **Restore or import**. Don't edit the `_backup` sheet.

## Where your data lives

- Everything you enter is saved in **your browser on that computer** (localStorage). Nothing is sent to GitHub or to any server.
- The code in the repository contains **no client data**. Only the sample firm in `assets/demo-data.js`, which is fictional.
- **Never commit a backup file** (`*.json`) to the repository. `.gitignore` blocks the usual names, but check before you push.
- Take a backup every week from **Settings and data → Download backup**. Use the same file to move to another computer or browser (**Restore or import**).
- Clearing browser data, or using a private window, removes what is stored in that browser. Keep backups.

## Security

- **No third-party requests.** Fonts (IBM Plex, SIL Open Font License) and the Excel writer (SheetJS 0.18.5, Apache 2.0) are hosted in this repository. A strict Content-Security-Policy allows scripts, styles, fonts and images only from the site itself, and blocks all network connections, so data cannot be sent anywhere even if something went wrong.
- **Imports are validated.** Every record id must be plain letters, digits, `-` or `_`; files with anything else are refused. All fields are type-checked and unknown statuses or filing codes are dropped, so a damaged or tampered backup can neither inject code nor crash the app.
- **Excel restore never runs a spreadsheet parser on your file.** It reads only the app's own hidden `_backup` sheet with a small built-in reader, which avoids the known file-parsing vulnerabilities in SheetJS 0.18.5 (CVE-2023-30533, CVE-2024-22363). SheetJS is used only to write backups.
- **CSV exports** neutralise cells starting with `= + - @` so they can't run as formulas in Excel.
- **Backups are protected from accidents.** Before "Replace everything" or "Delete all data", a snapshot is saved to the backup folder, and automatic backup never overwrites a good file with empty data.
- **Your data stays on your computer**, in this browser's storage and your backup folder, unencrypted. Use the app only on your own computer account, lock your screen, and keep the backup folder private.
- **Recommended:** turn on two-factor authentication on GitHub, and don't publish other GitHub Pages sites on the same account, because sites under `aravindas27.github.io` share browser storage. Better still, serve the app from its own subdomain (for example `desk.cloudbookassociates.com`).

## Getting started with real data

1. Open the site and choose **Start with my own data**, or import the prepared file `cloudbook-desk-my-data.json` from **Settings and data → Restore or import**.
2. When importing on top of existing data, choose **Add new items** to keep what you entered and add only new records.
3. Set each person's **cost rate** under **Team and services**: (monthly salary + share of rent, software and overheads) ÷ productive hours per month.
4. Check the **standard fees and budget hours** for each service.
5. Log time daily. Job margins become real as soon as time is logged.
6. When a job is done, mark it **Filed / Done**, raise the invoice (use the same number as in Zoho Books), and record payments as they arrive.
7. At the start of each month, use **Jobs → Roll forward recurring** to open next period's GST, TDS and bookkeeping jobs.

## Files

```
index.html            App shell, navigation and security policy
assets/app.css        Styles (Cloudbook navy and slate, light and dark themes)
assets/app.js         Data store, validation, calculations, pages and forms
assets/demo-data.js   Fictional sample firm for exploring
assets/logo*.png      Cloudbook Associates logo (light and dark)
assets/fonts/         IBM Plex Sans and Mono (self-hosted)
assets/vendor/        SheetJS for writing Excel backups
```

## Ideas for later

- Sign-in and a shared online database (for example Supabase or Firebase), so several people can use the same data from different devices.
- Reading invoices and payments straight from Zoho Books.
- Email reminders for overdue invoices and upcoming deadlines.
