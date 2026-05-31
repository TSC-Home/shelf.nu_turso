import { RelayClient } from "@voidvalue/relay";
import { RELAY_API_KEY, RELAY_SMTP_KEY } from "../utils/env";

let relayClient: RelayClient;

declare global {
  // eslint-disable-next-line no-var
  var __relayClient__: RelayClient;
}

function createRelayClient() {
  return new RelayClient({
    apiKey: RELAY_API_KEY,
    smtpKey: RELAY_SMTP_KEY,
  });
}

if (process.env.NODE_ENV === "production") {
  relayClient = createRelayClient();
} else {
  if (!global.__relayClient__) {
    global.__relayClient__ = createRelayClient();
  }
  relayClient = global.__relayClient__;
}

export { relayClient };
