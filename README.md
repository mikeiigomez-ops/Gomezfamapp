# Gomez Family Hub

A family web app you can install on your iPhone home screen. It has no build step and no server: plain HTML, CSS and JavaScript.

## Features
- **Home**: today's events, tonight's dinner, budget left, bills due, chores, upcoming birthdays and trip countdowns
- **Budget**: monthly category budgets, a spending and income log, and **Recurring** bills and paychecks (monthly, every 2 weeks, weekly or yearly) with a 2-week "coming up" view, safe-to-spend until payday, cash flow, and bulk add by pasting
- **Shopping**: a quick-add list grouped by aisle ("2 lb chicken" works), staples you always buy with stocked/low/out status, and sharing the list by text
- **Calendar**: color-coded by family member, repeating events, birthdays, bill due dates and US holidays
- **Gifts**: people with birthdays, sizes and wish lists; gift ideas tracked idea → bought → wrapped → given; yearly gift budget and Christmas countdown
- **Meal plan**: weekly dinners, meal autocomplete with remembered ingredients, and one tap to send ingredients to the shopping list
- **Recipe box**: ingredients, steps, time and favorites. Plan a recipe for a night and send its ingredients to the list in one tap, or turn past meals into recipes
- **Chores**: assign chores, check them off, and see weekly points with a 👑 leaderboard
- **House projects**: steps with time estimates, materials with costs, a budget and due dates, starter templates, sending materials to the shopping list, and optional logging of purchases to the budget
- **Savings goals**: targets with deposits and withdrawals, a monthly amount needed to hit a date, and 🎉 confetti when you reach one
- **Family binder**: emergency numbers, doctors, insurance, school, Wi-Fi and codes. Private entries stay hidden until tapped, and phone numbers are tap-to-call
- **Home upkeep**: recurring maintenance (filters, smoke detectors, gutters…) with next-due dates, common tasks to pick from, and reminders on Home and the Calendar
- **Search** across everything, plus quick-add buttons on Home
- **Family Wrapped**: a monthly recap told as swipeable stories, with a shareable summary image
- **Privacy lock**: Face ID (passkey) or a 4-digit PIN, set per phone
- **Voice + Siri**: speak to Magic Add, or use a Shortcut that opens `#add=<text>` (add `&go` to save immediately)
- **Family activity feed**: who added, paid or finished what, with each phone set to its owner
- **Shopping together**: a live "Ana is shopping now" banner while someone uses Store Mode
- **30-day cash-flow forecast**: projected balance from your checking balance, paychecks, bills and normal spending
- **Rewards store**: kids redeem chore points for rewards, and a grown-up approves
- **Plan my week**: fills open nights from your recipes and favorites, skipping recent repeats, and shops the ingredients
- **Customize Home**: reorder and hide sections, per phone
- **Kid Mode**: a kid-safe app (chores, routines, points, piggy bank, wishes, badges) that takes a parent PIN to exit
- **Kid accounts**: a kid's login is built from a parent's email (e.g. `you+sofia@gmail.com`). The parent approves it from their inbox, and the kid's device joins by scanning a QR code
- **Simple mode** (per kid, for about ages 4–8): ⭐ stars, one piggy bank or no money, one-step-at-a-time routines, read-aloud, big buttons, a sticker book, and one-tap treats
- **Routines**: morning, bedtime and homework checklists with on-time stars
- **Allowance & piggy bank**: Save / Spend / Give jars, an automatic weekly allowance, cashing in points, and a savings goal
- **Wish lists**: kids add wishes that parents can move into the gift plan without the kid seeing
- **Badges & levels** for kids
- **Fridge board & polls**: notes with reactions and family votes
- **Packing lists**: per-person lists from trip templates
- **Debt payoff planner**: snowball vs avalanche, debt-free date, interest saved
- **Subscription audit**: monthly and yearly totals, streaming overlap, automatic price-change detection, keep/cancel review
- **Family chat**: a group chat with reactions, @mentions and big emoji. Kids can chat too
- **High-fives**: send kudos to anyone. Parents can attach bonus ⭐ for kids, and the person who gets one sees a celebration pop-up
- **Daily check-in**: a mood plus "one good thing today", a family mood board and a week view
- **Shared to-dos**: anyone can add one, and "🙋 I'll do it!" shows who's on it
- **Event RSVPs**: "Who's in?" with Going / Maybe / Can't for each person
- **Family challenges**: team goals (chores, to-dos, check-ins, or tap +1) with a shared reward
- **Inbox 🔔**: new messages, mentions, your turn in a game, RSVPs, to-dos for you and reward requests
- **Game Center**: Connect Four (on your own phones, pass-and-play, or vs. the robot), a daily **Family Word** puzzle with streaks (4-letter words with a hint for Simple-mode kids), **Memory Match** with family bests, and **"How well do you know us?"** trivia
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
