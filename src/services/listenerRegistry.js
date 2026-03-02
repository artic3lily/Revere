/**
 * listenerRegistry.js
 *
 * A global registry for Firestore onSnapshot listeners.
 * Call `registerListener(unsub)` whenever you create an onSnapshot.
 * Call `unsubscribeAll()` right before signOut() so no listener
 * fires a permission-denied error after the user is logged out.
 */

const listeners = new Set();

/** Register an unsubscribe function returned by onSnapshot() */
export function registerListener(unsub) {
  if (typeof unsub === 'function') {
    listeners.add(unsub);
  }
}

/** Unregister a single listener (called in useEffect cleanup) */
export function unregisterListener(unsub) {
  listeners.delete(unsub);
}

/** Unsubscribe ALL registered listeners immediately */
export function unsubscribeAll() {
  listeners.forEach((unsub) => {
    try { unsub(); } catch (_) {}
  });
  listeners.clear();
}
