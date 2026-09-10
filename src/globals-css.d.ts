// Next generates this declaration during `next dev`/`next build`; declaring it
// here keeps a standalone `tsc --noEmit` (and CI) working before a build runs.
declare module '*.css'
