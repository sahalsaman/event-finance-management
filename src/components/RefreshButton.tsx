'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false);

  function refreshPage() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <button
      type="button"
      className="button ghost refresh-button"
      aria-label="Refresh page"
      title="Refresh page"
      onClick={refreshPage}
      disabled={refreshing}
    >
      <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'refresh-icon spinning' : 'refresh-icon'} />
    </button>
  );
}
