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
    // Prepare stream creation (get message to sign)
    prepareCreate: (data: {
      recipientType: string;
      recipientValue: string;
      amount: string;
      durationSeconds: number;
      message?: string;
      senderAddress: string;
    }, token: string) =>
      request<{
        message: string;
        data: any;
        instructions: string;
      }>('/api/streams/prepare-create', { method: 'POST', body: data, token }),

    // Create stream with signature
    create: (data: {
      recipientType: string;
      recipientValue: string;
      amount: string;
      durationSeconds: number;
      message?: string;
      senderAddress: string;
      signature?: string;
      signedMessage?: string;
    }, token: string) =>
      request<{
        stream: {
          id: string;
          onChainId: number;
          sender: string;
          recipient: string;
          recipientSocial: { type: string; handle: string } | null;
          totalAmount: string;
          claimedAmount: string;
          ratePerSecond: string;
          startTime: string;
          endTime: string;
          message: string | null;
          status: string;
        };
        transaction: {
          hash?: string;
          status: string;
          explorerUrl?: string;
        };
      }>('/api/streams', { method: 'POST', body: data, token }),

    // Get a specific stream
    get: (id: string, token?: string) =>
      request<{
        id: string;
        onChainId: number;
        sender: string;
        recipient: string;
        recipientSocial: { type: string; handle: string } | null;
        totalAmount: string;
        claimedAmount: string;
        claimable: string;
        ratePerSecond: string;
        startTime: string;
        endTime: string;
        message: string | null;
        status: string;
      }>(`/api/streams/${id}`, { token }),

    // Get outgoing streams
    getOutgoing: (token: string, walletAddress: string) =>
      request<{
        streams: Array<{
          id: string;
          onChainId: number;
          sender: string;
          recipient: string;
          recipientSocial: { type: string; handle: string } | null;
          totalAmount: string;
          claimedAmount: string;
          ratePerSecond: string;
          startTime: string;
          endTime: string;
          message: string | null;
          status: string;
        }>;
      }>('/api/streams/user/outgoing', { token, params: { walletAddress } }),

    // Get incoming streams
    getIncoming: (token: string, walletAddress: string, email?: string) => {
      const params: Record<string, string> = { walletAddress };
      if (email) {
        params.email = email;
      }
      return request<{
        streams: Array<{
          id: string;
          onChainId: number;
          sender: string;
          recipient: string;
          recipientSocial: { type: string; handle: string } | null;
          totalAmount: string;
          claimedAmount: string;
          ratePerSecond: string;
          startTime: string;
          endTime: string;
          message: string | null;
          status: string;
        }>;
      }>('/api/streams/user/incoming', { token, params });
    },
  },

  claim: {
  // Prepare claim (get message to sign)
  prepare: (streamId: string, data: { walletAddress: string; email?: string }, token: string) =>
    request<{
      stream: {
        id: string;
        onChainId: number;
        claimable: string;
        totalAmount: string;
        claimedAmount: string;
      };
      authorization: {
        message: string;
        data: any;
      };
      instructions: string;
    }>(`/api/claim/${streamId}/prepare`, { method: 'POST', body: data, token }),

  // Execute claim with signature
  execute: (streamId: string, data: {
    walletAddress: string;
    signature?: string;
    signedMessage?: string;
    email?: string;
  }, token: string) =>
      request<{
        success: boolean;
        claimedAmount: string;
        totalClaimed: string;
        remaining: string;
        status: string;
        transaction: {
          hash?: string;
          onChain: boolean;
          explorerUrl?: string;
        };
      }>(`/api/claim/${streamId}/execute`, { method: 'POST', body: data, token }),

    // Check sponsorship status
    sponsor: (streamId: string, data: any, token: string) =>
      request<{ sponsored: boolean; message: string }>(
        `/api/claim/${streamId}/sponsor`,
        { method: 'POST', body: data, token }
      ),
  },

  // Health check
  health: () => request<{ status: string; timestamp: string }>('/api/health'),
};