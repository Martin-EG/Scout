# Contributing

Thanks for looking. Scout is a small project; issues and pull requests are welcome.

- Read `CLAUDE.md` for the layer rules and conventions (small files, no magic numbers,
  Zod on every LLM output, no `any`).
- Before a pull request: `pnpm lint && pnpm typecheck && pnpm test`.
- New pipeline behavior needs a unit test; source adapters get a saved fixture in
  `tests/fixtures/sources/`.
- Product rules are not negotiable: Scout never posts anything, every draft discloses
  that the developer built the app, and no platform write APIs.
- Never commit `.env*` files (other than `.env.example`), keys, or model files.
