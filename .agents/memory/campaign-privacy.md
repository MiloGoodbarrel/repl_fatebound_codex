---
name: Campaign privacy
description: User requirements for sharing the app with friends without exposing campaigns or spoilers.
---

Campaign access must be limited by who is using the app, rather than exposing all campaigns and resources to every user. The app is intended to be useful to the creator's regular D&D group while protecting campaign spoilers.

**Why:** The user explicitly raised user-account separation and campaign confidentiality as requirements before sharing the published app with friends.

**How to apply:** The user approved Google sign-in with private DM workspaces as the first version and wants to test using their own Google account after publishing. Treat sign-in and campaign authorization as separate concerns. Include linked items and NPCs in access controls; linking must not create a way to read another user's private campaign resources. Shared DM/player or co-DM access remains undecided and outside the initial version.

Existing campaign ownership is reserved for the creator's explicitly configured, verified Google identity, never the first person who signs in. Initial resource linking is limited to campaigns with the same owner.

**Why:** The first release is for independent DM workspaces; no permission has been given to expose the creator's existing campaigns or spoilers to other accounts.
