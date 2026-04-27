# AI Rules for TypeScript, React, and Angular

## General Principles
- Follow existing project patterns before introducing new ones.
- Prefer clarity over cleverness.
- Write production-ready code, not demo code.
- Keep functions focused and small.
- Use descriptive names for variables, functions, components, and types.
- Avoid duplication. Extract reusable logic when it improves readability.
- Do not add dependencies unless necessary.
- Do not leave commented-out code.
- Do not use placeholder implementations unless explicitly requested.
- When changing code, preserve current behavior unless the task requires behavior changes.

## TypeScript Rules
- Always use strict TypeScript-compatible code.
- Never use deprecated APIs, functions, methods, types, or overloads when a supported replacement exists.
- Never use `any` unless explicitly requested.
- Prefer `unknown` over `any` when the type is not yet known.
- Avoid unsafe type assertions. Narrow types properly when possible.
- Prefer explicit types for public APIs, exported functions, and complex return values.
- Use union types, discriminated unions, and type guards where appropriate.
- Prefer `type` for unions and mapped shapes, and `interface` for extendable object contracts when that improves readability.
- Avoid enums unless they are clearly the best fit; prefer union literals.
- Prefer readonly data where mutation is not needed.
- Handle `null` and `undefined` explicitly.
- Avoid non-null assertions (`!`) unless there is a clear guarantee.
- Prefer `async/await` over chained promises.
- Always handle errors intentionally.
- Use `const` only (no `let`, no `var`).
- Use arrow functions only.

## Code Style
- Keep nesting shallow.
- Prefer early returns over large nested conditionals.
- Avoid magic numbers and hardcoded strings; extract constants when meaningful.
- Write self-explanatory code before adding comments.
- Add comments only when the intent is not obvious from the code.
- Do not create overly abstract code for simple logic.
- Keep files cohesive and avoid mixing unrelated responsibilities.

## Function Signature Formatting

- Keep function parameters on a single line when the total length is reasonable (under ~130 characters).
- Do NOT break parameters into multiple lines unless:
  - The line exceeds 130 characters, OR
  - Readability is clearly harmed.

## Imports and Exports
- Remove unused imports.
- Prefer named exports unless the framework strongly favors default export for the file type.
- Keep import order consistent with the existing project style.
- Use path aliases if the project already uses them.
- Do not create circular dependencies.

## Testing Mindset
- Write code that is easy to test.
- Separate rendering logic from business logic when possible.
- Prefer pure functions for transformations and utility logic.
- Mock only what is necessary.
- Do not rewrite working code only to make tests pass.

---

# React Rules

## React Component Design
- Use functional components.
- Use `const` only (no `let`, no `var`).
- No `any`; use explicit types, `unknown`, or typed interfaces.
- Prefer hooks over class components.
- Keep components focused on one responsibility.
- Split large components into smaller components when it improves readability or reuse.
- Keep presentational components simple and predictable.
- Move complex business logic into hooks, utilities, or services.

## Props and State
- Type all props explicitly.
- Keep props minimal and intentional.
- Avoid prop drilling when composition or context is a better fit.
- Keep state as local as possible.
- Do not store derived state unless necessary.
- Compute derived values from props/state instead of duplicating them.
- Prefer controlled components for forms unless there is a clear reason not to.

## Hooks
- Follow the Rules of Hooks strictly.
- Do not call hooks conditionally.
- Use `useMemo` and `useCallback` only when there is a real benefit.
- Do not over-optimize prematurely.
- Use `useEffect` only for side effects.
- Do not use `useEffect` for logic that can be done during render.
- Always include correct dependencies in hooks.
- If dependency handling is tricky, refactor instead of suppressing warnings.

## React Patterns
- Prefer composition over inheritance.
- Avoid deeply nested JSX when extracting components would help.
- Keep event handlers simple and clearly named.
- Avoid inline complex logic inside JSX.
- Prefer semantic HTML and accessible markup.
- Add proper labels, button types, and ARIA attributes when needed.

## React Performance
- Prevent unnecessary re-renders when there is a demonstrated issue.
- Memoize only when it solves a real problem.
- Avoid recreating large objects/functions in hot render paths if it causes issues.
- Use keys correctly in lists; never use array index as key when stable IDs exist.

---

# Angular Rules

## Angular Architecture
- Follow Angular best practices and existing project structure.
- Prefer standalone components if the project uses them.
- Keep components focused and small.
- Put business logic in services when appropriate.
- Keep templates readable; avoid large amounts of logic in templates.
- Prefer smart separation between container logic and UI rendering when helpful.

## TypeScript in Angular
- Fully type inputs, outputs, services, models, and observables/signals.
- Use `const` only (no `let`, no `var`).
- No `any`; use explicit types, `unknown`, or typed interfaces.
- Expose only what the template needs.

## Components and Templates
- Use clear naming for components, inputs, outputs, and methods.
- Prefer `computed` values or class-level derived state over repeated logic in templates.
- Avoid calling expensive methods directly from templates.
- Keep templates declarative.
- Use semantic HTML and accessibility-friendly markup.
- Prefer built-in Angular control flow/features if the project already uses them.

## Signals and RxJS
- Prefer project-consistent state patterns.
- If the project uses Signals, prefer Signals for local reactive state.
- If the project uses RxJS heavily, integrate cleanly instead of mixing patterns randomly.
- Do not subscribe manually unless necessary.
- Prefer `async` pipe or framework-friendly reactive patterns.
- Clean up subscriptions properly when manual subscription is required.
- Avoid unnecessary conversions between Signals and Observables.

## Services
- Services should have a clear responsibility.
- Do not place UI concerns inside data/services unless intentional.
- Keep API interaction logic separate from presentation logic.
- Type HTTP requests and responses explicitly.
- Handle loading and error states intentionally.

## Forms
- Prefer reactive forms for complex forms.
- Type form models where possible.
- Keep validation explicit and centralized.
- Show clear validation messages.
- Do not duplicate validation logic across template and component without reason.

## Angular Performance
- Prefer `OnPush` change detection when aligned with the project.
- Avoid unnecessary recomputation in templates.
- Track list items properly in loops.
- Lazy load feature areas when appropriate.

---

# Styling Rules
- Reuse existing design system, component library, and tokens first.
- Prefer consistent spacing, sizing, and naming.
- Avoid one-off styles when reusable styles already exist.
- Keep styles scoped and maintainable.
- Do not use overly specific selectors unless necessary.
- Prefer accessible color contrast and keyboard-friendly interactions.
- Store SVG files under the relevant `assets` folder and reference them by URL imports or asset URLs instead of inline SVG markup.

---

# API and Data Handling
- Validate external data at boundaries.
- Put environment variables in `.env` and document them in `.env.example`.
- Always validate environment variables with Zod before use.
- Environment variables should be required by default; only make them optional when there is a clear, intentional reason.
- Never trust API responses blindly.
- Normalize data only when it improves code clarity or consistency.
- Handle loading, empty, error, and success states explicitly.
- Avoid silent failures.
- When returning `INTERNAL_SERVER_ERROR` from a route handler, include the caught error details in the response payload.

---

# File Organization
- Keep related files together according to project conventions.
- Do not create new folders or abstractions without a clear reason.
- Name files consistently with the framework conventions already used in the repo.
- Keep utility functions out of components when they are reusable or non-UI-specific.
- Put feature-specific utility/helper functions in a sibling `*.utils.ts` file next to the feature that uses them.
- Put feature-specific constants in a sibling `*.consts.ts` file next to the file that uses them.
- Put feature-specific types in a sibling `*.types.ts` file next to the file that uses them.
- This also applies to implementation-local type aliases and interfaces in handlers, routers, services, hooks, and components when they describe reusable or named contracts for that feature.
- This also applies to implementation-local helper functions in handlers, routers, services, hooks, and components when they are not the file's primary exported behavior.
- Do not leave exported shared constants or exported shared types inside implementation files when a sibling `*.consts.ts` or `*.types.ts` file is appropriate.
- Name sibling type files after the feature or module, for example `chat.router.ts` should use `chat.types.ts`.

---

# What to Avoid
- Do not use `any`.
- Do not ignore TypeScript errors.
- Do not suppress lint rules without a real reason.
- Do not introduce inconsistent patterns.
- Do not mix React and Angular conventions.
- Do not mutate state directly.
- Do not create giant components or giant services.
- Do not add code that is not required for the task.

---

# Expected Output Behavior
- Generate code that fits the current codebase style.
- When multiple valid approaches exist, choose the simplest maintainable one.
- Explain tradeoffs briefly when making a non-obvious choice.
- If assumptions are required, state them clearly.
- If a requested implementation conflicts with these rules, explain the conflict and choose the safest maintainable approach.
