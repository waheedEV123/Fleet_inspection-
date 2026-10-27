# Vehicle Return Inspection

A mobile web app for fleet coordinators to inspect vehicles returned by staff. Each coordinator signs in with their own account, completes the checklist, photographs any damage, and saves a report that is emailed to the fleet manager. Reports can be searched by fleet number and date range, printed, or downloaded as PDF.

Built with Next.js (hosted on Vercel) and Supabase (database, logins and photo storage).

## What's in the project

| Path | What it is |
|---|---|
| `supabase/schema.sql` | Creates the tables, security rules and photo storage. Run once. |
| `scripts/data/vehicles.csv` | Your fleet list (1,094 vehicles), ready to load. |
| `scripts/data/inspectors.csv` | The 12 inspectors, plus an admin row for you to fill in. Contains phone numbers: never commit it to GitHub (it's already excluded in `.gitignore`). |
| `app/` | The app pages: sign in, new inspection, history, report, settings. |

## Setup

### 1. Create the Supabase project
1. Sign up at supabase.com and create a new project (choose a region close to the UAE, e.g. Mumbai or Frankfurt).
2. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
3. Open **Authentication > Sign In / Providers > Email** and turn **off** "Allow new users to sign up" and "Confirm email". Only accounts you create can sign in.

### 2. Add your keys
1. In Supabase, open **Project Settings > API** and copy the Project URL, the `anon` public key and the `service_role` secret key.
2. Copy `.env.example` to `.env.local` and paste the three values in.

### 3. Load the inspectors and vehicles
1. In `scripts/data/inspectors.csv`, replace the first row with your own name, e& email and mobile number (keep the role as `admin`).
2. Run:
   ```
   npm install
   npm run create-inspectors
   npm run import-vehicles
   ```

### 4. Try it on your computer
```
npm run dev
```
Open http://localhost:3000 and sign in with your email and mobile number.

### 5. Put it online with Vercel
1. Push this folder to a **private** GitHub repository.
2. In Vercel, **Add New > Project**, import the repository.
3. Under **Environment Variables**, add the same values as in `.env.local`, and set `NEXT_PUBLIC_SITE_URL` to the Vercel address.
4. Click **Deploy**. Share the Vercel address (or your own domain) with the inspectors.

### 6. (Optional) Automatic emails to the fleet manager
1. Sign up at resend.com and verify a domain you own (for example fleetaxis.ae). Resend can only send to other people's addresses from a verified domain.
2. Add `RESEND_API_KEY` and `EMAIL_FROM` (for example `Vehicle Inspection <inspections@fleetaxis.ae>`) in Vercel, then redeploy.
3. In the app, open **Settings** and enter the fleet manager email.

Without this step everything else works, and each report has an **Email** button that opens a ready-filled email on the phone.

## Day-to-day admin (in the app, Settings tab)
- **Vehicles:** import an updated Excel/CSV register, or add one vehicle.
- **Inspectors:** add someone, reset a password (re-add them with the new number), or switch off access.
- **Report recipients:** fleet manager email and CC.

## Security notes
- Every inspection is stamped with the signed-in inspector's name, email and region by the database itself, so it can't be saved under someone else's name.
- Inspectors can read all inspections and add new ones, but can't edit or delete them. Only admins can change vehicles, inspectors and settings.
- Passwords are mobile numbers, which are easy to guess. For stronger security, ask inspectors to change to a proper password later (Supabase supports password reset), or put the app behind your company's single sign-on.
- Data is stored in Supabase, outside e& systems. Confirm with IT before rolling out company-wide.
