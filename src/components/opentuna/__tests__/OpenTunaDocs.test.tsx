import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import OpenTunaDocs from "@/components/opentuna/OpenTunaDocs";

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

describe("OpenTunaDocs", () => {
  it("renders the docs component", () => {
    const Wrapper = createTestWrapper();
    const { getByText } = render(
      <Wrapper>
        <OpenTunaDocs />
      </Wrapper>
    );
    
    // Should show "Getting Started" as the default section
    expect(getByText("Getting Started")).toBeInTheDocument();
  });

  it("displays all navigation sections", () => {
    const Wrapper = createTestWrapper();
    const { getByText } = render(
      <Wrapper>
        <OpenTunaDocs />
      </Wrapper>
    );
    
    // Check all section titles are rendered
    expect(getByText("DNA System")).toBeInTheDocument();
    expect(getByText("Sonar Modes")).toBeInTheDocument();
    expect(getByText("Deep Memory")).toBeInTheDocument();
    expect(getByText("Fin Market")).toBeInTheDocument();
    expect(getByText("SchoolPay (x402)")).toBeInTheDocument();
    expect(getByText("Security")).toBeInTheDocument();
    expect(getByText("SDK & API")).toBeInTheDocument();
    expect(getByText("FAQ")).toBeInTheDocument();
  });

  it("shows welcome text on getting started section", () => {
    const Wrapper = createTestWrapper();
    const { getByText } = render(
      <Wrapper>
        <OpenTunaDocs />
      </Wrapper>
    );
    
    expect(getByText(/Welcome to OpenTuna/)).toBeInTheDocument();
  });
});
