import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import OpenTunaAgentSelector from "@/components/opentuna/OpenTunaAgentSelector";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ 
          data: [
            { id: "agent-1", name: "TestAgent", status: "active", agent_type: "trading" }
          ], 
          error: null 
        }),
      }),
    }),
  },
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

describe("OpenTunaAgentSelector", () => {
  it("renders loading state initially", () => {
    const Wrapper = createTestWrapper();
    const { getByText } = render(
      <Wrapper>
        <OpenTunaAgentSelector 
          selectedAgentId={null} 
          onSelect={vi.fn()} 
        />
      </Wrapper>
    );
    
    // Should show loading text
    expect(getByText(/Loading agents/)).toBeInTheDocument();
  });
});
