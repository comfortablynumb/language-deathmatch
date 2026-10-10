/* Data store: loads and caches site/data/*.json through an injected fetchJson(url) → Promise. */
/**
 * fetchJson(url) must resolve with the parsed JSON, resolve with null when the file
 * does not exist (404), and reject on any other failure.
 */
export function createStore(fetchJson, baseUrl = 'data') {
  const cache = new Map();

  function load(path) {
    if (!cache.has(path)) {
      const promise = fetchJson(`${baseUrl}/${path}`).catch((error) => {
        cache.delete(path);
        throw error;
      });
      cache.set(path, promise);
    }

    return cache.get(path);
  }

  function catalog() {
    return load('catalog.json').then((doc) => {
      if (!doc) {
        throw new Error('data/catalog.json is missing — run bin/build.sh');
      }

      return doc;
    });
  }

  /** Resolves null when no benchmark has been run yet. */
  function results() {
    return load('results.json');
  }

  /** Resolves null for an unknown project id. */
  function project(id) {
    return load(`projects/${encodeURIComponent(id)}.json`);
  }

  return { catalog, results, project };
}
