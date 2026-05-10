import type { SSGInstance, BuildResult } from "../types";

export interface WebhookHandlerOptions {
  /** SSG instance to trigger builds */
  ssg: SSGInstance;
  /** Callback when build is triggered */
  onTrigger?: (collection: string, result: BuildResult) => void | Promise<void>;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface WebhookRequest {
  /** Collection name from URL path */
  collection: string;
  /** Request body */
  body: unknown;
  /** Request headers */
  headers: Record<string, string>;
}

export interface WebhookResponse {
  status: number;
  body: string;
}

/**
 * Create a webhook handler for triggering SSG builds
 */
export function createWebhookHandler(
  options: WebhookHandlerOptions,
): (req: WebhookRequest) => Promise<WebhookResponse> {
  const { ssg, onTrigger, onError } = options;

  return async (req: WebhookRequest): Promise<WebhookResponse> => {
    try {
      const { collection } = req;

      // Trigger incremental build for the collection
      const result = await ssg.build({
        incremental: true,
        collections: [collection],
      });

      // Call trigger callback
      if (onTrigger) {
        await onTrigger(collection, result);
      }

      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          paths: result.paths,
          stats: result.stats,
        }),
      };
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }

      return {
        status: 500,
        body: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      };
    }
  };
}

/**
 * Verify webhook signature (for secure webhooks)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  // Simple HMAC verification
  // In production, use crypto.timingSafeEqual
  const crypto = require("crypto");
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return signature === `sha256=${expectedSignature}`;
}
