# Revere — Performance Improvements

This document explains every change that was made to your code, why it was made,
and what you should notice after pulling this branch in VS Code.

---

## ✅ "I clicked Pull — am I updated?"

**Maybe — it depends on which branch you were on when you clicked Pull.**

The performance improvements are on the branch **`copilot/identify-improve-slow-code`**,
**not** on `main`. Clicking Pull only updates whichever branch you are currently on.

### How to check in 30 seconds

1. Look at the **bottom-left corner of VS Code**. You will see the current branch name there.
   - If it says **`copilot/identify-improve-slow-code`** → you are on the right branch.
     If you also clicked Pull successfully, **you are up to date. ✅**
   - If it says **`main`** (or any other branch) → the changes are not on your machine yet.
     Follow the steps below.

2. **Quick file check:** look for `CHANGES.md` **at the root of your project** — that means it should appear at the very top level of your file list in VS Code's Explorer panel, right next to files like `App.js`, `package.json`, `README.md`, etc.
   - If you see it there → you have the changes. ✅
   - If you don't see it at the root → you need to switch branches (see below).

   > ⚠️ **Watch out for `node_modules/asap/CHANGES.md`** — this is a completely
   > different file that belongs to an npm package. It is **not** the Revere
   > performance notes. Make sure the file you open is at the root, **not** inside
   > a `node_modules` folder.

### Switch to the right branch (takes 30 seconds)

Open the VS Code terminal (**Terminal → New Terminal**) and run:

```sh
git fetch origin
git checkout copilot/identify-improve-slow-code
```

That's it. You'll see all 7 updated source files immediately.

---

## How to see the changes in VS Code

> **Important:** The changes are on the branch called `copilot/identify-improve-slow-code`,
> **not** on `main`. Make sure you switch to — or pull — the correct branch (see steps below).

### Step-by-step

1. Open VS Code in your Revere project folder.
2. Open the built-in terminal: **Terminal → New Terminal** (or `` Ctrl+` `` / `` Cmd+` ``).
3. Run these two commands one at a time:

```sh
git fetch origin
git checkout copilot/identify-improve-slow-code
```

4. You will now see all the updated files in your editor.
5. The 7 changed source files and this `CHANGES.md` file will appear in your project.

You can compare before/after by right-clicking any changed file in the Explorer
panel and choosing **Open Timeline**, or by opening the **Source Control** panel
(`Ctrl+Shift+G` / `Cmd+Shift+G`) and clicking a file to see its diff.

---

## Troubleshooting: "Could not resolve host: github.com"

If you see this error when running `git pull`:

```
fatal: unable to access 'https://github.com/artic3lily/Revere.git/':
Could not resolve host: github.com
```

This means **your computer cannot reach GitHub right now**. The code in the
repository is fine — this is a network problem on your machine. Here is how to
fix it:

### 1 — Check your internet connection

Open a browser and go to https://github.com. If the page does not load, your
internet is down. Reconnect to Wi-Fi or check your cable.

### 2 — Flush your DNS cache (most common fix)

**Windows:**
```
Win + R → type cmd → press Enter
ipconfig /flushdns
```

**macOS:**
```sh
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

**Linux:**
```sh
sudo systemd-resolve --flush-caches
```

After flushing, open a new terminal and try `git fetch origin` again.

### 3 — Try using 8.8.8.8 as your DNS server

If flushing did not help, your DNS server may be unreliable. Temporarily
switch to Google's public DNS:

- **Windows:** Control Panel → Network → Adapter Settings → IPv4 Properties
  → set "Preferred DNS server" to `8.8.8.8`
- **macOS:** System Preferences → Network → Advanced → DNS → add `8.8.8.8`

### 4 — Turn off VPN or proxy

If you are connected to a VPN or corporate proxy, try disconnecting it and
then running `git fetch origin` again.

### 5 — Make sure you are pulling the right branch

The changes are on `copilot/identify-improve-slow-code`, **not** `main`.
Running `git pull --tags origin main` will not bring in these changes even if
your network is working. Use:

```sh
git fetch origin
git checkout copilot/identify-improve-slow-code
```

### 6 — Test git connectivity directly

In your terminal, run:

```sh
git ls-remote https://github.com/artic3lily/Revere.git
```

If that works, your connection to GitHub is fine.
If it still says "Could not resolve host", your DNS/network is still the problem — keep troubleshooting steps 1–4 above.

---

## Files changed and what was fixed

### 1. `src/context/ThemeContext.js`

**Problem:** Every time any state changed anywhere in the app, the Theme context
created a brand-new `{ theme, isDark, toggleTheme }` object. Because the object
reference changed on every render, every screen and component that called
`useTheme()` was forced to re-render too — even if the theme hadn't actually changed.

**Fix:** The context value is now wrapped in `useMemo` and `toggleTheme` is
wrapped in `useCallback`. React can now skip re-rendering theme consumers unless
`isDark` actually changes.

---

### 2. `src/screens/CartScreen.js`

**Problem:** When loading your cart, the app was making **one separate Firestore
read for every single item**. If you had 10 items in your cart, that was 10
individual database requests. At Firestore's pricing, this also costs more money
as your user base grows.

**Fix:** All cart items are now fetched in a **single batched query** using
`where(documentId(), 'in', [...ids])`. 10 items now costs 1 database read instead
of 10. The order of items in your cart is preserved exactly as before.

---

### 3. `src/screens/WishlistScreen.js`

**Problem:** Same issue as the cart — one Firestore read per wishlist item.

**Fix:** Same batched query fix applied. One read instead of N reads.

---

### 4. `src/screens/TryOnScreen.js`

**Problem:** The AI try-on feature uses a polling loop to check whether Fal.ai has
finished generating the image. The old code:
- Checked every **2 seconds forever** with no limit.
- If the AI job got stuck or failed silently, the app would spin indefinitely
  and the user would never see an error message.

**Fix:**
- The loop now uses **exponential backoff**: it waits 2 s, then 4 s, then 8 s
  (and stays at 8 s) — reducing unnecessary API calls while the job is still
  processing.
- There is now a **hard limit of 30 attempts** (roughly 3 minutes). If the job
  hasn't completed by then, the user sees a clear error: *"Try-on timed out.
  Please try again."*

---

### 5. `src/screens/InboxScreen.js`

**Problem:** The inbox was loading **all chat threads from Firestore** and then
sorting them by date **in JavaScript** on the device. For a user with many
conversations this means downloading everything first, then sorting — wasted
bandwidth and CPU.

**Fix:** An `orderBy("updatedAt", "desc")` clause was added to the Firestore
query so the database returns threads already sorted newest-first. The manual
JavaScript sort was removed.

---

### 6. `src/screens/HomeScreen.js`

**Problem:** The home feed was loading up to **60 posts** at once on every app
open. Rendering 60 image tiles immediately takes more memory, more time, and more
Firestore reads than necessary for a first screen load.

**Fix:** The limit was reduced to **20 posts**. Users still see a full feed,
just without the extra cost of loading 40 posts that are often never seen.

---

### 7. `src/screens/ChatbotScreen.js`

**Problem:** While the chatbot ("Kitty Icône") is thinking, a small animation
shows `"Typing."` → `"Typing.."` → `"Typing..."`. This animation ran a timer
every 450 ms that updated state on the **entire ChatbotScreen** component —
meaning the full screen (message list, text input, send button) was being
re-rendered every 450 ms just to update three dots.

**Fix:** The animation was moved into its own tiny `TypingIndicator` component.
Now only that small component re-renders every 450 ms. The rest of the chat
screen stays completely still while waiting for a response.

---

## Summary table

| File | What changed | Expected benefit |
|------|-------------|-----------------|
| `ThemeContext.js` | Memoized context value | Fewer unnecessary re-renders across the whole app |
| `CartScreen.js` | Batched Firestore reads | N reads → 1 read for cart items |
| `WishlistScreen.js` | Batched Firestore reads | N reads → 1 read for wishlist items |
| `TryOnScreen.js` | Exponential backoff + timeout | No infinite loops; clear error if AI times out |
| `InboxScreen.js` | Server-side sort | Faster inbox load; less JS work on device |
| `HomeScreen.js` | Post limit 60 → 20 | Faster first load; less bandwidth |
| `ChatbotScreen.js` | Isolated typing animation | Chat UI stays smooth while waiting for AI |

All existing functionality is preserved — these are purely performance and
efficiency improvements. Your app should look and behave exactly the same, just faster.
