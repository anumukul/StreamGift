const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions {
  method?: string;
  body?: any;
  token?: string;
  params?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let url = `${API_URL}${endpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  streams: {
    create: (data: any, token: string) =>
      request<any>('/api/streams', { method: 'POST', body: data, token }),

    get: (id: string, token?: string) =>
      request<any>(`/api/streams/${id}`, { token }),

    getOutgoing: (token: string, walletAddress: string) =>
      request<any>('/api/streams/user/outgoing', { token, params: { walletAddress } }),

    getIncoming: (token: string, walletAddress: string) =>
      request<any>('/api/streams/user/incoming', { token, params: { walletAddress } }),

    confirm: (id: string, data: any, token: string) =>
      request<any>(`/api/streams/${id}/confirm`, { method: 'PATCH', body: data, token }),
  },

  claim: {
    prepare: (streamId: string, data: any, token: string) =>
      request<any>(`/api/claim/${streamId}/prepare`, { method: 'POST', body: data, token }),

    sponsor: (streamId: string, data: any, token: string) =>
      request<any>(`/api/claim/${streamId}/sponsor`, { method: 'POST', body: data, token }),

    confirm: (streamId: string, data: any, token: string) =>
      request<any>(`/api/claim/${streamId}/confirm`, { method: 'POST', body: data, token }),
  },
};