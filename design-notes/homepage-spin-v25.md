# Interactive rotating homepage jersey

Replaced the Team Shop landing-page front/back pair with the shared live 3D model over the existing stadium backdrop. It tracks the current team, theme, colors and artwork. The original pair remains the WebGL-error fallback. Merch Studio and product-detail views retain their existing behavior.

Auto spin is homepage-only at a modest 30 Hz update cadence. Dragging pauses it, then it resumes after three seconds; view, zoom and keyboard actions also provide inspection time. Pause/Auto spin button, reduced-motion default, off-screen and document-hidden suspension, and complete timer/listener cleanup.

TypeScript and deterministic controller lifecycle checks passed: automatic motion, manual drag pause/resume, explicit pause, off-screen and hidden-tab suspension, stationary editor default, disposal. No browser interaction QA was performed.
