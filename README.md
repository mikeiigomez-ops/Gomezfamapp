# Gomez Family Hub

A family web app you can install on your iPhone home screen. It has no build step and no server: plain HTML, CSS and JavaScript.

## Features
- **Home**: today's events, tonight's dinner, budget left, bills due, chores, upcoming birthdays and trip countdowns
- **Budget**: monthly category budgets, a spending and income log, and **Recurring** bills and paychecks (monthly, every 2 weeks, weekly or yearly) with a 2-week "coming up" view, safe-to-spend until payday, cash flow, and bulk add by pasting
- **Shopping**: a quick-add list grouped by aisle ("2 lb chicken" works), staples you always buy with stocked/low/out status, and sharing the list by text
- **Calendar**: color-coded by family member, repeating events, birthdays, bill due dates and US holidays
- **Gifts**: people with birthdays, sizes and wish lists; gift ideas tracked idea → bought → wrapped → given; yearly gift budget and Christmas countdown
- **Meal plan**: weekly dinners, meal autocomplete with remembered ingredients, and one tap to send ingredients to the shopping list
- **Chores**: assign chores, check them off, and see weekly points with a 👑 leaderboard
- **Settings**: family members, currency, dark mode, and backup/restore

## Install on iPhone
1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.

## Data
Each phone saves its data in the browser (localStorage), and the app works offline. **Settings → Back up** exports a backup file.

## Family sync (optional)
Phones can share one copy of the data through a free Firebase project. Each person signs in with their own email, and only emails on the access list can read the data. Edits made on two phones at the same time are merged.

One-time setup:
1. Go to https://console.firebase.google.com and click **Create a project** (Google Analytics can be off).
2. Open **Build → Authentication → Get started → Email/Password** and turn on **Enable**.
3. Open **Build → Firestore Database → Create database** and pick **production mode**. On the **Rules** tab, replace everything with the rules below and click **Publish**.
4. Open **Project settings (⚙️) → Your apps → Web (`</>`)** and register the app. Copy the `firebaseConfig` it shows.
5. In the app, go to **Settings → Family sync → Set up**, paste the config, create an account, and confirm your email. Then tap **Start sharing**.
6. Under **Who has access**, tap **+ Add person** and enter your partner's email, then tap **Send invite**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{familyId} {
      allow read, update, delete: if request.auth != null
        && request.auth.token.email_verified
        && request.auth.token.email in resource.data.emails;
      allow create: if request.auth != null
        && request.auth.token.email_verified
        && request.auth.token.email in request.resource.data.emails;
    }
  }
}
```

## Hosting
The `.github/workflows/pages.yml` workflow deploys the app to GitHub Pages on every push to `main`.

## Run locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000.
