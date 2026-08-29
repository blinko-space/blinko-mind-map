# Blinko Mind Map

Blinko Mind Map is a sidebar App for creating searchable mind maps inside Blinko.

Each map is stored as an App-owned entity with optimistic concurrency. The title and flattened node text join Blinko keyword search. Optional AI generation uses the account's configured AI provider through the capability-scoped App bridge.

## Development

```bash
bun install
bun run validate
bun run typecheck
bun test
bun run build
```

The interactive editor uses [Mind Elixir](https://github.com/SSShooter/mind-elixir-core), distributed under the MIT license.
