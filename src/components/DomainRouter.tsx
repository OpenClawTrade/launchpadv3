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

    // os.clawsai.fun → /sdk
    if (hostname === "os.clawsai.fun" && location.pathname === "/") {
      navigate("/sdk", { replace: true });
    }

    // punchlaunch.fun → sandbox to /punch-test only
    const isPunchDomain = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";
    if (isPunchDomain) {
      const allowed = ["/punch-test", "/launchpad/"];
      const isAllowed = allowed.some(p => location.pathname.startsWith(p));
      if (!isAllowed) {
        navigate("/punch-test", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
}
