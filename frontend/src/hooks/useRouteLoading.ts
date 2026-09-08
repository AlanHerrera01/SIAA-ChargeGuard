import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function useRouteLoading(delay = 400) {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timerId = window.setTimeout(() => setIsLoading(false), delay);
    return () => window.clearTimeout(timerId);
  }, [delay, location.pathname]);

  return isLoading;
}
