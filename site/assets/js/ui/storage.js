/* Browser storage adapter for lib/progress.js: localStorage when available, with an in-memory
   copy so a climb still works for the session in private windows or with storage blocked. */

function local() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns { get(key), set(key, value), remove(key) }; never throws. */
export function browserStorage() {
  const memory = new Map();

  return {
    get(key) {
      try {
        const value = local() ? local().getItem(key) : null;
        return value !== null ? value : memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      memory.set(key, value);

      try {
        local()?.setItem(key, value);
      } catch {
        // Quota or access denied: the in-memory copy keeps the session working.
      }
    },
    remove(key) {
      memory.delete(key);

      try {
        local()?.removeItem(key);
      } catch {
        // Nothing to remove.
      }
    },
  };
}
