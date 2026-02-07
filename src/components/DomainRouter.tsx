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

    // os.tuna.fun → /opentuna
    if (hostname === "os.tuna.fun" && location.pathname === "/") {
      navigate("/opentuna", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
