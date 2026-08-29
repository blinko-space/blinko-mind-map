# Blinko App rules

Use only the public @blinko-cloud/cli/sdk, @blinko-cloud/cli/ui, and @blinko-cloud/cli/custom-view interfaces. Never import host stores, tRPC, server, database, or undeclared network clients. The signed Custom View may use DOM, React, CSS, and Mind Elixir only inside its sandbox. Keep manifest permissions minimal and all visible text localized. Store each mind map as a versioned App Entity, preserve optimistic concurrency, and never fall back to state storage for map documents. AI generation is optional, user-triggered, bounded, and must never run in the background.
