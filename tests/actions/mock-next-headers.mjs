export async function cookies() {
  return {
    getAll: () => globalThis.mockCookies || [],
    set: () => {},
    get: (name) => (globalThis.mockCookies || []).find(c => c.name === name),
  };
}
