export const createClient = (url: string, key: string) => {
  if (key === process.env.SUPABASE_INTEGRATION_SERVICE_KEY) {
    globalThis.createdIntegrationClient = true;
  }
  return {
    rpc: async () => ({ data: [], error: null }),
    from: () => ({
      select: async () => ({ data: [], error: null }),
      insert: async () => ({ data: [], error: null }),
    }),
  };
};
