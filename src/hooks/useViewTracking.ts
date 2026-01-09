import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Session-level set to avoid duplicate view counts
const trackedPosts = new Set<string>();

export function useViewTracking(postId: string, enabled = true) {
  const elementRef = useRef<HTMLElement | null>(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!enabled || !postId || trackedPosts.has(postId)) return;

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Track when post is at least 50% visible
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!hasTracked.current && !trackedPosts.has(postId)) {
            hasTracked.current = true;
            trackedPosts.add(postId);

            // Fire and forget - don't block UI
            supabase.functions
              .invoke("social-write", {
                body: { type: "track_view", postId },
              })
              .catch((err) => {
                console.warn("Failed to track view:", err);
              });
          }
          // Stop observing after tracking
          observer.disconnect();
        }
      },
      {
        threshold: 0.5, // 50% visibility required
        rootMargin: "0px",
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [postId, enabled]);

  return elementRef;
}
