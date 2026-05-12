/**
 * usePropertyData — auto re-fetches when user switches property
 *
 * Usage:
 *   const [data, loading, error, refetch] = usePropertyData(
 *     () => api.get('/rooms').then(r => r.data)
 *   );
 *
 * The fetch function is called on mount and whenever 'property-switched' fires.
 * No need to add activeProperty to dependency arrays.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function usePropertyData(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const fetchRef              = useRef(fetchFn);
  fetchRef.current            = fetchFn;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      setData(result);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on mount and dep changes
  useEffect(() => { load(); }, [load]);

  // Re-load on property switch
  useEffect(() => {
    const handler = () => setTimeout(load, 50); // slight delay for localStorage to update
    window.addEventListener('property-switched', handler);
    return () => window.removeEventListener('property-switched', handler);
  }, [load]);

  return [data, loading, error, load];
}

export default usePropertyData;
