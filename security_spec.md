# MemeChowk Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Integrity**: Every `users_public/{userId}`, `users_private/{userId}`, and `public_assets/{assetId}` write must have an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`), and `uploaderUid` / `uid` must strictly equal `request.auth.uid`.
2. **PII Split Isolation**: `users_public/{userId}` never stores `email` or phone numbers. `users_private/{userId}` stores `email` and is readable strictly by `isOwner(userId) || isAdmin()`.
3. **Role Escalation Prevention**: Normal users cannot self-assign `role: "ADMIN"` on `users_public` creation or update unless their verified email matches the bootstrapped admin (`pantsubash30@gmail.com`) or their UID exists in `/admins/{uid}`.
4. **Public Asset Discovery & Moderation**: `public_assets` list/get queries only return documents where `resource.data.moderationStatus == 'APPROVED_PUBLIC'` or `resource.data.uploaderUid == request.auth.uid` or `isAdmin()`.
5. **Terminal State Lock**: Once `moderationStatus == 'TAKEDOWN_REMOVED'`, non-admin users cannot update or revive the asset.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection**: Creating `public_assets` with an extra undeclared field `{"isVerifiedHack": true}` -> Rejected by `hasOnly()`.
2. **Identity Spoofing on Create**: Creating `public_assets` with `uploaderUid: "other-user-uid"` -> Rejected by `data.uploaderUid == request.auth.uid`.
3. **Self-Assigned Admin Role**: Creating `users_public` with `role: "ADMIN"` from a non-admin account -> Rejected by role guard.
4. **Unverified Admin Email Spoof**: Accessing admin actions with `email == "pantsubash30@gmail.com"` but `email_verified == false` -> Rejected by `request.auth.token.email_verified == true`.
5. **PII Blanket Read**: Authenticated non-owner reading `/users_private/victim-uid` -> Rejected by `isOwner(userId) || isAdmin()`.
6. **ID Poisoning (2KB ID)**: Writing to `/public_assets/<2000-char-junk>` -> Rejected by `isValidId(assetId)`.
7. **Value Poisoning on Update**: Updating `likeCount` with a string `"999999"` -> Rejected by `isValidPublicAsset(incoming())`.
8. **Client Timestamp Forgery**: Creating `public_assets` with a past/future `createdAt` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
9. **Immutable Field Mutation**: Updating `uploaderUid` or `createdAt` on an existing asset -> Rejected by immutability checks.
10. **Terminal State Bypass**: Owner attempting to update an asset whose `moderationStatus == 'TAKEDOWN_REMOVED'` -> Rejected by terminal state lock.
11. **Quarantine Scraping**: Listing `public_assets` where `moderationStatus == 'TAKEDOWN_REMOVED'` as a public user -> Rejected by `resource.data.moderationStatus == 'APPROVED_PUBLIC'`.
12. **Unbounded String Exhaustion**: Sending a 50KB `title` or `englishContextNote` -> Rejected by `.size() <= maxLength` checks.
