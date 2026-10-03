# Repository layout

The original `ForgeLinc_Groc_Handoff.zip` placed the application in `source/`.
For GitHub and builder imports, those files now live at the repository root.
The remaining handoff documents, proposed contracts, examples, prompts and
provenance files are preserved in this `handoff/` directory.

- `source/<path>` in the original handoff maps to `<path>` at the repository root.
- Original top-level handoff files map to `handoff/<path>`.
- The original application README is preserved as `ORIGINAL_SOURCE_README.md`.
- The repository README supersedes that older README's integration summary.
- `.gitignore` now permits the empty `.env.example` and excludes local secret files.
- Application code, `package.json`, the lockfile, migrations, and bundled artwork
  are unchanged from the exported baseline.

`PACKAGE_MANIFEST.sha256` is the original handoff archive's checksum manifest. Its
paths and hashes describe that original archive, not the rearranged repository or
the updated root README and `.gitignore`.
