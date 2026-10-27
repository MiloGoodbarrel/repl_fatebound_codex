---
name: Campaign privacy
description: User requirements for sharing the app with friends without exposing campaigns or spoilers.
---

Campaign access must be limited by who is using the app, rather than exposing all campaigns and resources to every user. The app is intended to be useful to the creator's regular D&D group while protecting campaign spoilers.

**Why:** The user explicitly raised user-account separation and campaign confidentiality as requirements before sharing the published app with friends.

**How to apply:** The user approved Google sign-in with private DM workspaces as the first version and wants to test using their own Google account after publishing. Treat sign-in and campaign authorization as separate concerns. Include linked items and NPCs in access controls; linking must not create a way to read another user's private campaign resources. Shared DM/player or co-DM access remains undecided and outside the initial version.

Automatic legacy campaign ownership is reserved for an authenticated account with the creator's explicitly configured, verified email, never the first person who signs in. Do not additionally require linked Google-provider metadata. The user explicitly chose their current signed-in preview account instead for the existing development campaigns; that manual designation does not designate a production identity. Initial resource linking is limited to campaigns with the same owner.

**Why:** The first release is for independent DM workspaces; no permission has been given to expose the creator's existing campaigns or spoilers to other accounts.

**Why provider metadata is not required:** The live account passed both configured-email matching and email verification but reported `google_not_linked`, blocking the intended owner. A verified email from the server-side identity provider proves the configured email identity without relying on a particular sign-in method.

**How to apply:** Preserve server-verified authentication, exact verified-email matching, atomic one-time claims, and refusal to overwrite existing owners. Google remains an available sign-in method, not a separate campaign ownership requirement.

Do not treat saving the owner email or publishing as proof of campaign ownership. Verify the target environment's ownership records; when automatic claiming fails, distinguish the failed identity checks without exposing configured email values or weakening authorization.

**Why:** Preview ownership was assigned successfully while published campaigns remained unclaimed despite successful Google sign-in and repeated owner-setting updates. Silent creator-check rejection made those failures indistinguishable.

**How to apply:** Diagnose the published identity in the published runtime. Do not infer a production email/provider mismatch from a development account, or promise that republishing alone will resolve it.
