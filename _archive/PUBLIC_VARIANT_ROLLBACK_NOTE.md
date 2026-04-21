# Public Variant Archive (Safe Rollback)

Date: 2026-04-20
Reason: Duplicate page/runtime files existed in both root and public paths after consolidation.
Action: Kept root files as active source of truth and archived public variants.

Archived files:
- public/index.html
- public/certificate.html
- public/assets/js/api-fetch-patch.js
- public/assets/js/auth.js
- public/assets/js/firebase.js

Rollback (restore archived variants back to public):

```powershell
Set-Location "C:\Users\ganes\OneDrive\Desktop\Clinch"
Copy-Item ".\_archive\public-variant-duplicates\public\*" ".\public\" -Recurse -Force
```

Notes:
- This is non-destructive cleanup. Files are archived, not permanently deleted.
- Root files remain unchanged and continue to be used by current routes and references.
