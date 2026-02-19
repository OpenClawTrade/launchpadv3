import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Domain-based routing component
 * Redirects specific subdomains to their corresponding pages
 */
export function DomainRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;

    // os.clawmode.fun → /opentuna
    if (hostname === "os.clawmode.fun" && location.pathname === "/") {
      navigate("/sdk", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
