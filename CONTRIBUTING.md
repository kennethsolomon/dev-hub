# Contributing

Thanks for your interest in contributing to DevHub.

## Development Setup

1. Fork and clone the repository
2. Follow the [Setup](#setup) instructions in the README
3. Create a feature branch: `git checkout -b feat/your-feature`

## Code Standards

- **TypeScript**: Strict mode, no `any` types.
- **Components**: Use shadcn/ui primitives. Keep components in `src/components/`.
- **Business Logic**: Core logic goes in `src/lib/`, not API routes or components.
- **Styling**: Tailwind CSS v4. Dark mode must work by default.

Run quality checks before committing:

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(discovery): add Bun project detection
fix(process): resolve port conflict on macOS Sequoia
refactor(db): extract migration runner to separate module
```

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new features and bug fixes
- Update documentation if behavior changes
- All CI checks must pass
