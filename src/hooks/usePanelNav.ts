import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function usePanelNav() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const pendingRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && pendingRef.current) {
      pendingRef.current = false;
      navigate("/panel");
    }
  }, [isAuthenticated, navigate]);

  const goToPanel = useCallback(() => {
    if (isAuthenticated) {
      navigate("/panel");
    } else {
      pendingRef.current = true;
      login();
    }
  }, [isAuthenticated, login, navigate]);

  return { goToPanel };
}
