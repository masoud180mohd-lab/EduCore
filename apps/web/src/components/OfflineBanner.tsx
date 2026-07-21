'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOffline(!navigator.onLine);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="banner banner-warn" role="status" style={{ margin: 0, borderRadius: 0 }}>
      You are offline — attendance queue is not enabled yet. Connect to save marks.
    </div>
  );
}
