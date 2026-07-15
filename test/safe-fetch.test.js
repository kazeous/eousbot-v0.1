import test from "node:test";
import assert from "node:assert/strict";
import { fetchPublicText } from "../src/utils/safeFetch.js";

test("safe fetch blocks loopback and local hosts before making a request", async () => {
  await assert.rejects(() => fetchPublicText("http://127.0.0.1/feed.xml"), /Private feed IP/);
  await assert.rejects(() => fetchPublicText("http://service.local/feed.xml"), /Private and local/);
});
