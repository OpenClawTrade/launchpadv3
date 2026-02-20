import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function usePanelNav(defaultPath = "/panel") {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const pendingRef = useRef<string | false>(false);

  useEffect(() => {
    if (isAuthenticated && pendingRef.current) {
      const target = pendingRef.current;
      pendingRef.current = false;
      navigate(target);
    }
  }, [isAuthenticated, navigate]);

  const goToPanel = useCallback((pathOrEvent?: string | React.MouseEvent) => {
    const target = typeof pathOrEvent === "string" ? pathOrEvent : defaultPath;
    if (isAuthenticated) {
      navigate(target);
    } else {
      pendingRef.current = target;
      login();
    }
  }, [isAuthenticated, login, navigate, defaultPath]);

  return { goToPanel };
}
