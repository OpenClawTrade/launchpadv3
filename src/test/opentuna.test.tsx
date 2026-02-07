import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

// Mock Privy
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    authenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
  }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    functions: {
      invoke: () => Promise.resolve({ data: {}, error: null }),
    },
  },
}));

// Mock OpenTuna Context
vi.mock("@/components/opentuna/OpenTunaContext", () => ({
  OpenTunaProvider: ({ children }: { children: React.ReactNode }) => children,
  useOpenTunaContext: () => ({
    agents: [],
    isLoadingAgents: false,
    selectedAgentId: null,
    setSelectedAgentId: vi.fn(),
    walletAddress: null,
    refetchAgents: vi.fn(),
  }),
}));

// Create test wrapper
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe("OpenTuna Test Suite", () => {
  it("should pass basic sanity check", () => {
    expect(true).toBe(true);
  });

  it("should have test wrapper configured correctly", () => {
    const Wrapper = createTestWrapper();
    const { getByTestId } = render(
      <Wrapper>
        <div data-testid="test">Hello OpenTuna</div>
      </Wrapper>
    );
    expect(getByTestId("test")).toBeInTheDocument();
  });
});
