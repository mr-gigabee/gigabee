export class GigabeeError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "GigabeeError";
  }
}

export class GigabeeAuthError extends GigabeeError {
  constructor(message = "Authentication required. Call client.withToken(token) first.") {
    super(message, 401, "AUTH_REQUIRED");
    this.name = "GigabeeAuthError";
  }
}

export class GigabeeInsufficientCreditsError extends GigabeeError {
  constructor(message = "Insufficient credits. Top up your balance to continue.") {
    super(message, 402, "INSUFFICIENT_CREDITS");
    this.name = "GigabeeInsufficientCreditsError";
  }
}

export class GigabeeNetworkError extends GigabeeError {
  constructor(cause: Error) {
    super(`Network error: ${cause.message}`, undefined, "NETWORK_ERROR");
    this.name = "GigabeeNetworkError";
  }
}
