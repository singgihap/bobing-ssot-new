import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function usePortal() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

export function Portal({ children }) {
  const mounted = usePortal();

  if (!mounted) return null;

  return createPortal(children, document.body);
}
