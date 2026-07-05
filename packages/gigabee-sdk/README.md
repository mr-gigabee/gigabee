# gigabee-sdk

Official JavaScript / TypeScript SDK for the [Gigabee](https://gigabee.app) decentralized AI inference network.

## Install

```bash
npm install gigabee-sdk
# or
pnpm add gigabee-sdk
```

## Quick start

```ts
import { GigabeeClient } from "gigabee-sdk";

const client = new GigabeeClient();

// Public endpoints — no auth required
const stats = await client.getStats();
console.log(`${stats.workersOnline} workers, ${stats.tokensGenerated} tokens generated`);

// Authenticated endpoints
const authed = client.withToken("your-api-token");

const balance = await authed.getBalance();
console.log(`Balance: ${balance.credits} credits ($${balance.usdValue.toFixed(2)})`);

const response = await authed.chat({
  messages: [{ role: "user", content: "What is Gigabee?" }],
  model: "bee-hover",
});
console.log(response.content);
```

## API

### `new GigabeeClient(options?)`

| Option    | Type     | Default                       | Description              |
|-----------|----------|-------------------------------|--------------------------|
| `baseUrl` | `string` | `https://gigabee.app/api`     | API base URL             |
| `token`   | `string` | `process.env.GIGABEE_TOKEN`   | Bearer token for auth    |

Environment variables: `GIGABEE_API_URL`, `GIGABEE_TOKEN`

### Methods

| Method                      | Auth | Description                           |
|-----------------------------|------|---------------------------------------|
| `getStats()`                | No   | Live network statistics               |
| `getCreditPackages()`       | No   | Available credit packages             |
| `getBalance()`              | Yes  | Your credit balance                   |
| `chat(options)`             | Yes  | Send a message, get a response        |
| `listJobs()`                | Yes  | Recent chat jobs                      |
| `withToken(token)`          | —    | Returns a new authenticated client    |

### Models

| Model       | Credits | Best for                    |
|-------------|---------|------------------------------|
| `bee-nano`  | 5       | Quick, lightweight tasks     |
| `bee-hover` | 10      | Fast everyday chat           |
| `bee-glide` | 15      | Harder reasoning             |

### Error handling

```ts
import { GigabeeClient, GigabeeAuthError, GigabeeInsufficientCreditsError } from "gigabee-sdk";

try {
  const res = await client.chat({ messages: [{ role: "user", content: "Hello" }] });
} catch (err) {
  if (err instanceof GigabeeAuthError) {
    console.error("Not authenticated — call .withToken() first");
  } else if (err instanceof GigabeeInsufficientCreditsError) {
    console.error("Not enough credits — top up at gigabee.app");
  }
}
```

## License

MIT
