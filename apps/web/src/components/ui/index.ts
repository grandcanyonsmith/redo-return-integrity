// Keep existing `../components/ui` imports stable while allowing shadcn-style
// primitives to live in this directory. The explicit `.js` specifier resolves
// to the sibling `ui.tsx` source under TypeScript/Vite ESM resolution.
export { Badge, EmptyNotice, MetricCard, PageIntro } from "../ui.js";
export * from "./collapsible.js";
export * from "./empty.js";
