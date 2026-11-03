const rawBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api').trim();
const API_BASE = rawBase.endsWith('/api') ? rawBase : (rawBase.startsWith('http') ? `${rawBase.replace(/\/$/, '')}/api` : rawBase);

/**
 * Robust authentication token retrieval across potential storage keys
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return (
    localStorage.getItem('tuition_token') ||
    localStorage.getItem('tuition_access_token') ||
    localStorage.getItem('tuition_mobile_access_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    null
  );
}

/**
 * Robust active institute ID retrieval across potential storage keys and cached objects
 */
export function getActiveInstituteId(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  let instituteId = localStorage.getItem('tuition_active_institute_id');

  if (!instituteId) {
    const savedInst = localStorage.getItem('tuition_active_institute') || localStorage.getItem('tuition_mobile_institute');
    if (savedInst) {
      try {
        const parsed = JSON.parse(savedInst);
        if (parsed?.id) {
          instituteId = parsed.id;
          localStorage.setItem('tuition_active_institute_id', parsed.id);
        }
      } catch {
        // ignore parse error
      }
    }
  }

  if (!instituteId) {
    const savedUser = localStorage.getItem('tuition_user') || localStorage.getItem('tuition_mobile_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const instId =
          parsed?.instituteId ||
          parsed?.memberships?.[0]?.instituteId ||
          parsed?.memberships?.[0]?.institute?.id;
        if (instId) {
          instituteId = instId;
          localStorage.setItem('tuition_active_institute_id', instId);
        }
      } catch {
        // ignore parse error
      }
    }
  }

  return instituteId || null;
}

// In-memory request cache and in-flight promise deduplicator
const inFlightRequests = new Map<string, Promise<any>>();
const apiCache = new Map<string, { data: any; expiry: number }>();

export interface ApiFetchOptions extends RequestInit {
  skipCache?: boolean;
  cacheTtlMs?: number;
}

/**
 * Invalidates cached API responses matching a pattern or completely.
 * Automatically called on POST, PUT, PATCH, DELETE operations.
 */
export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) {
      apiCache.delete(key);
    }
  }
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = getAuthToken();
  const instituteId = getActiveInstituteId();

  // On data-mutating requests, invalidate cached data to ensure freshness
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    invalidateApiCache();
  }

  // Cache key scoped to tenant and user token
  const cacheKey = `${token ? token.slice(-10) : 'anon'}:${instituteId || 'global'}:${method}:${endpoint}`;

  // For GET requests, check in-memory cache if not skipped
  const isCacheable = method === 'GET' && !options.skipCache && !endpoint.includes('/auth/login');
  if (isCacheable) {
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }

    // Request deduplication: if identical GET request is in flight, reuse its promise
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (!endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
      console.warn(`[apiFetch] Warning: Invoking ${endpoint} without an authorization token in localStorage.`);
    }

    if (instituteId) {
      headers['x-institute-id'] = instituteId;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (netErr: any) {
      if (netErr.name === 'AbortError') {
        throw netErr;
      }
      console.error(`[apiFetch] Network failure for ${endpoint}:`, netErr);
      throw new Error('Digital Guru Franchise Backend server is unreachable. Please verify the backend server is running on port 5000 (npm run dev:server).');
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      if (response.status >= 500) {
        console.error(`[apiFetch] HTTP ${response.status} 500 Server Error for ${endpoint}`);
        throw new Error('Digital Guru Franchise Backend is not responding (port 5000 unreachable). Run `npm run dev:server` in terminal.');
      }
      console.error(`[apiFetch] Failed to parse JSON response for ${endpoint} (HTTP ${response.status})`);
      throw new Error(`Server returned unexpected response (HTTP ${response.status})`);
    }

    if (!response.ok) {
      console.error(`[apiFetch] Request rejected (HTTP ${response.status}) on ${endpoint}:`, data);
      const errMessage = data?.message || data?.error || `HTTP ${response.status}: Request failed`;
      const customErr = new Error(errMessage);
      (customErr as any).status = response.status;
      (customErr as any).data = data;
      throw customErr;
    }

    // Cache successful GET results
    if (isCacheable) {
      const ttl = options.cacheTtlMs ?? (endpoint.includes('/batches') || endpoint.includes('/dashboard') ? 20000 : 8000);
      apiCache.set(cacheKey, { data, expiry: Date.now() + ttl });
    }

    return data as T;
  })();

  if (isCacheable) {
    inFlightRequests.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  return fetchPromise;
}

/**
 * Generates an authenticated download / inline view URL for learning materials.
 * Appends token and instituteId query parameters so browser tabs/links authenticate smoothly.
 */
export function getMaterialDownloadUrl(materialId: string, forceDownload = false): string {
  const token = getAuthToken();
  const instId = getActiveInstituteId();
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  if (instId) query.set('instituteId', instId);
  if (forceDownload) query.set('download', 'true');
  const qStr = query.toString();
  return '/api/materials/' + materialId + '/download' + (qStr ? '?' + qStr : '');
}

/**
 * Generates an authenticated download / inline view URL for student homework submissions.
 */
export function getSubmissionDownloadUrl(submissionId: string, forceDownload = false): string {
  const token = getAuthToken();
  const instId = getActiveInstituteId();
  const query = new URLSearchParams();
  if (token) query.set('token', token);
  if (instId) query.set('instituteId', instId);
  if (forceDownload) query.set('download', 'true');
  const qStr = query.toString();
  return '/api/homework/submissions/' + submissionId + '/download' + (qStr ? '?' + qStr : '');
}

/**
 * Initiates a direct file download that saves the file directly to the user's device disk.
 */
export async function downloadFileToDevice(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename || 'document';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  }, 200);
}
