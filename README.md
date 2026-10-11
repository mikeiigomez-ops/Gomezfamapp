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
Data is saved in the browser on each device (localStorage). It works offline. Use **Settings → Back up** often. You can also send a backup file to another phone and restore it there.

## Hosting
The `.github/workflows/pages.yml` workflow deploys the app to GitHub Pages on every push to `main`.

## Run locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000.
