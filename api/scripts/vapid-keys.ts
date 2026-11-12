// Prints a new Web Push (VAPID) key pair, as lines for /etc/who-when-where/api.env.
//   node scripts/vapid-keys.ts
import { newVapidKeys } from "../src/push.ts";

const { publicKey, privateKey } = newVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
