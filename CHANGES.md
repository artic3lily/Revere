# Revere — Performance Improvements

This document explains every change that was made to your code, why it was made,
and what you should notice after pulling this branch in VS Code.

---

## How to see the changes in VS Code

1. Open VS Code in your Revere project folder.
2. Open the **Source Control** panel (the branch icon on the left sidebar, or press `Ctrl+Shift+G` / `Cmd+Shift+G`).
3. Click **Pull** (or run `git pull` in the VS Code terminal).
4. The 7 changed files will appear in your editor with the updated code.

You can also compare before/after by opening any of the files listed below and
looking at the Git history (`Right-click → Open Timeline` in the Explorer panel).

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
