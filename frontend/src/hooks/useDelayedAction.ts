import { useState } from "react";

export function useDelayedAction(delay = 500) {
  const [isPending, setIsPending] = useState(false);

  function run(callback: () => void | Promise<void>) {
    setIsPending(true);
    window.setTimeout(() => {
      void Promise.resolve(callback()).finally(() => setIsPending(false));
    }, delay);
  }

  return { isPending, run };
}
