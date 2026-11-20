import crypto from "crypto";
import { hmacSha256, bytesToBase64Url, base64UrlEncode, base64UrlDecode } from "../lib/crypto-portable";

const secret = "dvla-secret-encryption-key-ghana-2026-v2-secure";
const message = JSON.stringify({ userId: "user-123", email: "admin@dvla.gov.gh", role: "ADMINISTRATOR" });

// 1. Node crypto HMAC
const b64UrlNode = Buffer.from(message).toString("base64url");
const sigNode = crypto.createHmac("sha256", secret).update(b64UrlNode).digest("base64url");

// 2. Portable HMAC
const b64UrlPortable = base64UrlEncode(message);
const sigBytes = hmacSha256(secret, b64UrlPortable);
const sigPortable = bytesToBase64Url(sigBytes);

console.log("Payload matches:", b64UrlNode === b64UrlPortable);
console.log("Sig Node:     ", sigNode);
console.log("Sig Portable: ", sigPortable);
console.log("HMAC Signature matches:", sigNode === sigPortable);

const decoded = base64UrlDecode(b64UrlPortable);
console.log("Decoded matches message:", decoded === message);
