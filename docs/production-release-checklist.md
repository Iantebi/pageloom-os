# PageLoom production release checklist

The intended Firebase project is `pageloom-os-production`. Stop if the active CLI project differs.

1. Run dependency integrity, typecheck, lint, automated tests, policy tests, and the production build.
2. Confirm the Firebase CLI identity can access `pageloom-os-production`.
3. Deploy indexes, then Firestore rules, Storage rules, Functions, and Hosting.
4. Provision the first Owner only after the target and verified Firebase identity are confirmed:

   ```sh
   npm run provision:owner --workspace=@pageloom/functions -- --uid=<firebase-uid> --email=<verified-email>
   npm run provision:owner --workspace=@pageloom/functions -- --uid=<firebase-uid> --email=<verified-email> --apply
   ```

   The first command is a dry run. The apply command sets the immutable `platformRole=owner` claim, writes the auditable `systemAdministrators` registry entry, and revokes old refresh tokens. It never accepts or stores a password.

5. Sign out and back in, then verify Backend Master access and tenant isolation with a dedicated test organization.

Never use a real customer's records for rollback or destructive release testing.
