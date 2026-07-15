/** Shape attached to request.apiKey by ApiKeyGuard. */
export interface RequestApiKey {
  id: string;
  websiteId: string;
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: RequestApiKey;
    }
  }
}
