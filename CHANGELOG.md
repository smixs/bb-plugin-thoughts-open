# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-20

### Changed

- The wide **Thoughts: open** header button is replaced by a brain icon the size of bb's own header icons. A dot on it means Thoughts are open; a dimmed brain means folded. Press feedback, color and dot motion follow Emil Kowalski's interface rules.
- The thread menu gets **Fold thoughts** / **Show thoughts**, placed before Archive and Delete.

## [1.0.1] - 2026-11-20

### Changed

- Plugin description and README lead with what the plugin is for: read where an agent is heading and stop or steer it in time.
- One screenshot replaces the two.

## [1.0.0] - 2026-11-20

### Added

- A thread header button, **Thoughts: open** / **Thoughts: folded**, and a command palette command flip every Thought between open and folded. The mode is saved on the bb server and follows every window.
- Every Thought (reasoning) row opens on its own, for every provider.
- Work groups that hold a Thought open; groups without one close again. A group is checked again when its header changes.
- The 20rem height cap on Thought text is lifted.
- A Thought or group the user toggles by hand is left alone until the mode changes.
- A row the host folds back three times is left alone, so no click loop can start.

[1.1.0]: https://github.com/smixs/bb-plugin-thoughts-open/releases/tag/v1.1.0
[1.0.1]: https://github.com/smixs/bb-plugin-thoughts-open/releases/tag/v1.0.1
[1.0.0]: https://github.com/smixs/bb-plugin-thoughts-open/releases/tag/v1.0.0
