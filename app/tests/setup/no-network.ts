// TAC-001-03: unit and integration tests never reach the network.
// Tests that need an endpoint response replace `fetch` with a replay of a real capture
// (vi.stubGlobal / injected mocks); anything unhandled fails loudly here.
const blockedFetch: typeof fetch = async (input) => {
  const target = input instanceof Request ? input.url : String(input);
  throw new Error(`Network access is disabled in tests (attempted: ${target})`);
};

globalThis.fetch = blockedFetch;
