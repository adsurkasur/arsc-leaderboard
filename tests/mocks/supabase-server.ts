export const createClient = async () => {
  return {
    auth: {
      getUser: async () => ({
        data: { user: globalThis.mockUser },
        error: globalThis.mockUserError,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => ({
            maybeSingle: async () => {
              if (table === 'user_roles') {
                if (globalThis.mockProfile && globalThis.mockProfile.role === val2) {
                  return { data: globalThis.mockProfile, error: globalThis.mockProfileError };
                }
                return { data: null, error: globalThis.mockProfileError };
              }
              return { data: null, error: new Error("Unknown table") };
            },
          }),
        }),
      }),
    }),
    rpc: async (fnName: string, args: unknown) => {
      (globalThis as Record<string, unknown>).mockRpcLastArgs = { fnName, args };
      return { data: { success: true }, error: null };
    }
  };
};
