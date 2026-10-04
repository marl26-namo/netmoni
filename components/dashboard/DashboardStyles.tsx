"use client";

/**
 * Global dashboard styles that were previously inlined in the page component.
 * Kept verbatim so the visual design is unchanged; rendered once by the
 * dashboard frame.
 */
export function DashboardStyles() {
  return (
    <style jsx global>{`
        .wf-node-compact {
          position: absolute;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: grab;
          z-index: 3;
          user-select: none;
        }
        .wf-node-compact:active { cursor: grabbing; }

        .wf-node-surface {
          position: relative;
          width: 100%;
          height: 100%;
          border: 2px solid var(--border, rgba(148,163,184,.45));
          background: var(--panel, #242424);
          box-shadow: 0 10px 26px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.025);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
        }
        .wf-node-card .wf-node-surface {
          border-radius: 12px 12px 18px 18px;
        }
        .wf-node-agent .wf-node-surface {
          border-radius: 10px;
          justify-content: flex-start;
          padding: 0 28px;
          gap: 18px;
        }
        .wf-node-compact:hover .wf-node-surface,
        .wf-node-compact.selected .wf-node-surface {
          transform: translateY(-2px);
          border-color: var(--primary, #2563eb);
          box-shadow: 0 0 0 5px rgba(37,99,235,.10), 0 16px 34px rgba(0,0,0,.24);
        }
        .wf-node-icon {
          width: 58px !important;
          height: 58px !important;
          border-radius: 12px;
          background: transparent !important;
          border: 0 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--foreground, currentColor);
        }
        .wf-node-card.type-trigger .wf-node-icon { color: #14b8a6; }
        .wf-node-card.type-logic .wf-node-icon { color: #22c55e; }
        .wf-node-card.type-action .wf-node-icon { color: #38bdf8; }
        .wf-node-agent .wf-node-icon { color: var(--foreground, #fff); flex: 0 0 auto; }
        .wf-node-agent-copy strong, .wf-node-agent-copy small { display: block; }
        .wf-node-agent-copy strong { font-size: 16px; letter-spacing: -.01em; }
        .wf-node-agent-copy small { margin-top: 5px; opacity: .55; font-size: 11px; }
        .wf-node-ports {
          position: absolute;
          left: 34px;
          right: 34px;
          bottom: -20px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--muted-foreground, #94a3b8);
          pointer-events: none;
        }
        .wf-node-compact .handle {
          position: absolute;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          border: 2px solid var(--background, #fff);
          background: var(--muted-foreground, #94a3b8);
          z-index: 8;
        }
        .wf-node-compact .handle-in { left: -5px; top: calc(50% - 5px); }
        .wf-node-compact .handle-out { right: -5px; top: calc(50% - 5px); }
        .wf-node-agent .handle-in { left: -5px; }
        .wf-node-agent .handle-out { right: -5px; }

        .wf-node-label {
          margin-top: 10px;
          max-width: 130px;
          text-align: center;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.25;
          color: var(--foreground, currentColor);
          pointer-events: none;
        }

        .wf-node-hover-card {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 15px);
          transform: translateX(-50%) translateY(5px);
          width: 245px;
          padding: 12px;
          border: 1px solid var(--border, rgba(148,163,184,.25));
          border-radius: 12px;
          background: var(--panel, rgba(15,23,42,.97));
          color: var(--foreground, #fff);
          box-shadow: 0 18px 45px rgba(0,0,0,.30);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity .15s ease, transform .15s ease;
          z-index: 60;
        }
        .wf-node-compact:hover .wf-node-hover-card {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
        .wf-node-hover-top { display: flex; gap: 9px; align-items: center; }
        .wf-node-hover-icon {
          width: 34px; height: 34px; border-radius: 9px;
          display: grid; place-items: center;
          background: rgba(37,99,235,.13);
        }
        .wf-node-hover-card strong, .wf-node-hover-card small { display: block; }
        .wf-node-hover-card small { margin-top: 2px; opacity: .58; font-size: 10px; }
        .wf-node-hover-card p { margin: 9px 0 0; font-size: 11px; line-height: 1.45; opacity: .76; }
        .wf-node-hover-meta { display: block; margin-top: 8px; font-size: 10px; opacity: .65; }

        .node-delete-compact {
          position: absolute !important;
          top: -9px;
          right: -9px;
          opacity: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          z-index: 20;
        }
        .wf-node-compact:hover .node-delete-compact,
        .wf-node-compact.selected .node-delete-compact { opacity: .75; }
        .quick-add-compact {
          position: absolute !important;
          right: -11px;
          bottom: -11px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          z-index: 20;
        }

        .wf-node-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 10px;
          border: 2px solid var(--primary, #2563eb);
          animation: network-node-pulse 1.35s ease-out infinite;
          pointer-events: none;
        }
        .wf-node-card .wf-node-pulse { border-radius: 14px; }
        .wf-node-agent .wf-node-pulse { border-radius: 12px; }
        @keyframes network-node-pulse {
          0% { transform: scale(.97); opacity: .72; }
          100% { transform: scale(1.04); opacity: 0; }
        }

        .network-theme-dark { color-scheme: dark; }
        .network-theme-light { color-scheme: light; }
        .network-theme-light .canvas {
          background-color: var(--background, #f7f8fa);
          background-image: radial-gradient(circle, rgba(100,116,139,.25) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .network-theme-light .canvas::before {
          opacity: .55;
        }
        .network-theme-light .wf-node-surface {
          box-shadow: 0 8px 24px rgba(15,23,42,.10), inset 0 0 0 1px rgba(255,255,255,.55);
        }
        .network-theme-light .wf-node-hover-card {
          box-shadow: 0 18px 45px rgba(15,23,42,.16);
        }
        .theme-toggle { min-width: 82px; justify-content: center; gap: 6px; }

        .ai-credential-card {
          margin: 12px 0 16px;
          padding: 13px;
          border: 1px solid rgba(148,163,184,.2);
          border-radius: 12px;
          background: rgba(127,127,127,.055);
        }
        .ai-credential-head { display: flex; gap: 10px; align-items: center; margin-bottom: 13px; }
        .ai-provider-mark {
          width: 36px; height: 36px; border-radius: 10px;
          display: grid; place-items: center;
          background: rgba(37,99,235,.13);
        }
        .ai-credential-head strong, .ai-credential-head small { display: block; }
        .ai-credential-head small { margin-top: 3px; font-size: 10px; line-height: 1.35; opacity: .6; }
        .ai-secret-label { display: block; }
        .ai-secret-input { display: flex; align-items: center; gap: 7px; }
        .ai-secret-input input { flex: 1; }
        .credential-ok { opacity: .9; }
        /* ================================================================
           WHOLE DASHBOARD THEME
           The mode switch applies to the complete authenticated workspace:
           rail, header, tabs, panels, forms, canvas, inspector, modals,
           cards, controls and workflow nodes.
        ================================================================ */
        .app-shell.network-theme-dark {
          --network-bg: #111315;
          --network-surface: #17191c;
          --network-surface-2: #1d2024;
          --network-surface-3: #24282d;
          --network-border: #30353c;
          --network-border-strong: #424954;
          --network-text: #f3f5f7;
          --network-text-2: #c3c8cf;
          --network-muted: #8d949d;
          --network-canvas: #111315;
          --network-canvas-dot: rgba(255,255,255,.14);
          --network-input: #121417;
          --network-hover: rgba(255,255,255,.055);
          --network-active: rgba(37,99,235,.13);
          --network-shadow: 0 16px 45px rgba(0,0,0,.30);
          --network-shadow-soft: 0 8px 25px rgba(0,0,0,.18);
          color-scheme: dark;
        }

        .app-shell.network-theme-light {
          --network-bg: #f5f7fa;
          --network-surface: #ffffff;
          --network-surface-2: #f8fafc;
          --network-surface-3: #eef2f6;
          --network-border: #d8dee7;
          --network-border-strong: #b9c2ce;
          --network-text: #17202a;
          --network-text-2: #4b5563;
          --network-muted: #6b7280;
          --network-canvas: #f7f9fb;
          --network-canvas-dot: rgba(71,85,105,.22);
          --network-input: #ffffff;
          --network-hover: rgba(15,23,42,.045);
          --network-active: rgba(37,99,235,.09);
          --network-shadow: 0 16px 45px rgba(15,23,42,.12);
          --network-shadow-soft: 0 8px 25px rgba(15,23,42,.08);
          color-scheme: light;
        }

        .app-shell.network-theme-dark,
        .app-shell.network-theme-light {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
          min-height: 100vh;
          transition: background-color .2s ease, color .2s ease;
        }

        .app-shell.network-theme-dark *,
        .app-shell.network-theme-light * {
          scrollbar-color: var(--network-border-strong) transparent;
        }

        /* Left navigation */
        .app-shell.network-theme-dark .app-rail,
        .app-shell.network-theme-light .app-rail {
          background: var(--network-surface) !important;
          border-right: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
          transition: background-color .2s ease, border-color .2s ease;
        }
        .app-shell.network-theme-dark .rail-item,
        .app-shell.network-theme-light .rail-item {
          color: var(--network-muted) !important;
          border-color: transparent !important;
          background: transparent !important;
        }
        .app-shell.network-theme-dark .rail-item:hover,
        .app-shell.network-theme-light .rail-item:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
        }
        .app-shell.network-theme-dark .rail-item.active,
        .app-shell.network-theme-light .rail-item.active {
          color: var(--primary, #2563eb) !important;
          background: var(--network-active) !important;
        }
        .app-shell.network-theme-dark .rail-user,
        .app-shell.network-theme-light .rail-user {
          background: var(--network-surface-3) !important;
          border: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
        }

        /* Main header + tabs */
        .app-shell.network-theme-dark .editor-main,
        .app-shell.network-theme-light .editor-main {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-header,
        .app-shell.network-theme-light .editor-header {
          background: var(--network-surface) !important;
          border-bottom: 1px solid var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-tabs,
        .app-shell.network-theme-light .editor-tabs {
          background: var(--network-surface) !important;
          border-bottom: 1px solid var(--network-border) !important;
        }
        .app-shell.network-theme-dark .editor-tab,
        .app-shell.network-theme-light .editor-tab {
          color: var(--network-muted) !important;
          background: transparent !important;
          border-color: transparent !important;
        }
        .app-shell.network-theme-dark .editor-tab:hover,
        .app-shell.network-theme-light .editor-tab:hover {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .editor-tab.active,
        .app-shell.network-theme-light .editor-tab.active {
          color: var(--network-text) !important;
          border-bottom-color: var(--primary, #2563eb) !important;
        }
        .app-shell.network-theme-dark .crumb,
        .app-shell.network-theme-light .crumb,
        .app-shell.network-theme-dark .save-state,
        .app-shell.network-theme-light .save-state {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .wf-name-input,
        .app-shell.network-theme-light .wf-name-input {
          color: var(--network-text) !important;
          background: transparent !important;
        }

        /* Generic controls */
        .app-shell.network-theme-dark .btn.ghost,
        .app-shell.network-theme-light .btn.ghost,
        .app-shell.network-theme-dark .icon-btn,
        .app-shell.network-theme-light .icon-btn,
        .app-shell.network-theme-dark .reopen-library,
        .app-shell.network-theme-light .reopen-library {
          color: var(--network-text-2) !important;
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark .btn.ghost:hover,
        .app-shell.network-theme-light .btn.ghost:hover,
        .app-shell.network-theme-dark .icon-btn:hover,
        .app-shell.network-theme-light .icon-btn:hover,
        .app-shell.network-theme-dark .reopen-library:hover,
        .app-shell.network-theme-light .reopen-library:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
          border-color: var(--network-border-strong) !important;
        }
        .app-shell.network-theme-dark .btn.primary,
        .app-shell.network-theme-light .btn.primary {
          color: #fff !important;
        }

        /* Workflow workspace */
        .app-shell.network-theme-dark .editor-body,
        .app-shell.network-theme-light .editor-body {
          background: var(--network-bg) !important;
        }
        .app-shell.network-theme-dark .nodes-panel,
        .app-shell.network-theme-light .nodes-panel,
        .app-shell.network-theme-dark .inspector {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-light .inspector {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .nodes-panel-head,
        .app-shell.network-theme-light .nodes-panel-head,
        .app-shell.network-theme-dark .inspector-head,
        .app-shell.network-theme-light .inspector-head {
          border-color: var(--network-border) !important;
          background: var(--network-surface) !important;
        }
        .app-shell.network-theme-dark .nodes-panel-body,
        .app-shell.network-theme-light .nodes-panel-body,
        .app-shell.network-theme-dark .inspector-body,
        .app-shell.network-theme-light .inspector-body {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .nodes-search input,
        .app-shell.network-theme-light .nodes-search input,
        .app-shell.network-theme-dark .field input,
        .app-shell.network-theme-light .field input,
        .app-shell.network-theme-dark .field select,
        .app-shell.network-theme-light .field select,
        .app-shell.network-theme-dark .field textarea,
        .app-shell.network-theme-light .field textarea {
          color: var(--network-text) !important;
          background: var(--network-input) !important;
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark input::placeholder,
        .app-shell.network-theme-light input::placeholder,
        .app-shell.network-theme-dark textarea::placeholder,
        .app-shell.network-theme-light textarea::placeholder {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .node-item,
        .app-shell.network-theme-light .node-item {
          color: var(--network-text-2) !important;
          background: transparent !important;
          border-color: transparent !important;
        }
        .app-shell.network-theme-dark .node-item:hover,
        .app-shell.network-theme-light .node-item:hover {
          color: var(--network-text) !important;
          background: var(--network-hover) !important;
        }
        .app-shell.network-theme-dark .nodes-section-title,
        .app-shell.network-theme-light .nodes-section-title,
        .app-shell.network-theme-dark .field-note,
        .app-shell.network-theme-light .field-note,
        .app-shell.network-theme-dark .expr-hint,
        .app-shell.network-theme-light .expr-hint {
          color: var(--network-muted) !important;
        }
        .app-shell.network-theme-dark .inspector-tabs,
        .app-shell.network-theme-light .inspector-tabs {
          border-color: var(--network-border) !important;
        }
        .app-shell.network-theme-dark .inspector-tabs button,
        .app-shell.network-theme-light .inspector-tabs button {
          color: var(--network-muted) !important;
          background: transparent !important;
        }
        .app-shell.network-theme-dark .inspector-tabs button.active,
        .app-shell.network-theme-light .inspector-tabs button.active {
          color: var(--network-text) !important;
        }

        /* Canvas */
        .app-shell.network-theme-dark .canvas,
        .app-shell.network-theme-light .canvas {
          background-color: var(--network-canvas) !important;
          background-image: radial-gradient(circle, var(--network-canvas-dot) 1px, transparent 1px) !important;
          background-size: 24px 24px !important;
        }
        .app-shell.network-theme-dark .canvas::before,
        .app-shell.network-theme-light .canvas::before {
          opacity: .55;
        }
        .app-shell.network-theme-dark .canvas-controls,
        .app-shell.network-theme-light .canvas-controls,
        .app-shell.network-theme-dark .canvas-workflow-badge,
        .app-shell.network-theme-light .canvas-workflow-badge,
        .app-shell.network-theme-dark .canvas-hint,
        .app-shell.network-theme-light .canvas-hint {
          color: var(--network-text-2) !important;
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          box-shadow: var(--network-shadow-soft) !important;
        }
        .app-shell.network-theme-dark .zoom-readout,
        .app-shell.network-theme-light .zoom-readout {
          color: var(--network-text) !important;
        }

        /* Workflow nodes + hover cards */
        .app-shell.network-theme-dark .wf-node-surface,
        .app-shell.network-theme-light .wf-node-surface {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border-strong) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .wf-node-compact.selected .wf-node-surface,
        .app-shell.network-theme-light .wf-node-compact.selected .wf-node-surface {
          border-color: var(--primary, #2563eb) !important;
        }
        .app-shell.network-theme-dark .wf-node-hover-card,
        .app-shell.network-theme-light .wf-node-hover-card {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
          box-shadow: var(--network-shadow) !important;
        }
        .app-shell.network-theme-dark .wf-node-label,
        .app-shell.network-theme-light .wf-node-label,
        .app-shell.network-theme-dark .wf-node-agent-copy strong,
        .app-shell.network-theme-light .wf-node-agent-copy strong {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .wf-node-agent-copy small,
        .app-shell.network-theme-light .wf-node-agent-copy small,
        .app-shell.network-theme-dark .wf-node-hover-card small,
        .app-shell.network-theme-light .wf-node-hover-card small,
        .app-shell.network-theme-dark .wf-node-hover-card p,
        .app-shell.network-theme-light .wf-node-hover-card p {
          color: var(--network-text-2) !important;
        }


        /* Dashboard pages: Overview, Devices, Alerts, Executions, Settings */
        .app-shell.network-theme-dark .section-panel,
        .app-shell.network-theme-light .section-panel {
          background: var(--network-bg) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner,
        .app-shell.network-theme-light .section-panel-inner {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner h1,
        .app-shell.network-theme-light .section-panel-inner h1,
        .app-shell.network-theme-dark .section-panel-inner h2,
        .app-shell.network-theme-light .section-panel-inner h2,
        .app-shell.network-theme-dark .section-panel-inner strong,
        .app-shell.network-theme-light .section-panel-inner strong {
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .section-panel-inner p,
        .app-shell.network-theme-light .section-panel-inner p,
        .app-shell.network-theme-dark .section-panel-inner small,
        .app-shell.network-theme-light .section-panel-inner small {
          color: var(--network-text-2) !important;
        }
        .app-shell.network-theme-dark .device-registry,
        .app-shell.network-theme-light .device-registry,
        .app-shell.network-theme-dark .device-row,
        .app-shell.network-theme-light .device-row,
        .app-shell.network-theme-dark .dashboard-integration-card,
        .app-shell.network-theme-light .dashboard-integration-card {
          background: var(--network-surface) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
          box-shadow: none;
        }
        .app-shell.network-theme-dark .device-row:hover,
        .app-shell.network-theme-light .device-row:hover,
        .app-shell.network-theme-dark .dashboard-integration-card:hover,
        .app-shell.network-theme-light .dashboard-integration-card:hover {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border-strong) !important;
        }
        .app-shell.network-theme-dark .device-meta span,
        .app-shell.network-theme-light .device-meta span,
        .app-shell.network-theme-dark .device-meta strong,
        .app-shell.network-theme-light .device-meta strong {
          color: var(--network-text-2) !important;
        }
        .app-shell.network-theme-dark .device-main strong,
        .app-shell.network-theme-light .device-main strong,
        .app-shell.network-theme-dark .device-main small,
        .app-shell.network-theme-light .device-main small {
          color: var(--network-text) !important;
        }

        /* AI/API credential area */
        .app-shell.network-theme-dark .ai-node-banner,
        .app-shell.network-theme-light .ai-node-banner,
        .app-shell.network-theme-dark .ai-credential-card,
        .app-shell.network-theme-light .ai-credential-card,
        .app-shell.network-theme-dark .database-choice,
        .app-shell.network-theme-light .database-choice {
          background: var(--network-surface-2) !important;
          border-color: var(--network-border) !important;
          color: var(--network-text) !important;
        }
        .app-shell.network-theme-dark .ai-credential-card span,
        .app-shell.network-theme-light .ai-credential-card span,
        .app-shell.network-theme-dark .database-choice span,
        .app-shell.network-theme-light .database-choice span {
          color: var(--network-text-2) !important;
        }

        /* Modals */
        .app-shell.network-theme-dark .modal-backdrop,
        .app-shell.network-theme-light .modal-backdrop {
          background: rgba(2,6,23,.55) !important;
          backdrop-filter: blur(4px);
        }
        .app-shell.network-theme-dark .device-modal,
        .app-shell.network-theme-light .device-modal {
          background: var(--network-surface) !important;
          color: var(--network-text) !important;
          border-color: var(--network-border) !important;
          box-shadow: var(--network-shadow) !important;
        }
        .app-shell.network-theme-dark .device-modal input,
        .app-shell.network-theme-light .device-modal input,
        .app-shell.network-theme-dark .device-modal select,
        .app-shell.network-theme-light .device-modal select {
          background: var(--network-input) !important;
          color: var(--network-text) !important;
          border-color: var(--network-border) !important;
        }

        .inspector-footer {
          display: flex;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid var(--network-border, rgba(148,163,184,.2));
          background: var(--network-surface, #17191c);
          position: sticky;
          bottom: 0;
        }
        .inspector-footer .btn { flex: 1; justify-content: center; }
        .ui-notice {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 200;
          padding: 11px 14px;
          border: 1px solid var(--network-border, rgba(148,163,184,.25));
          border-radius: 10px;
          background: var(--network-surface, #17191c);
          color: var(--network-text, #f3f5f7);
          box-shadow: var(--network-shadow, 0 16px 45px rgba(0,0,0,.3));
          font-size: 12px;
        }
        .reopen-library { display: inline-flex; align-items: center; gap: 7px; }
        .wf-node-ports { display: none !important; }

        /* Theme button */
        .app-shell.network-theme-dark .theme-toggle,
        .app-shell.network-theme-light .theme-toggle {
          min-width: 88px;
        }

        /* Make the transition apply to the complete dashboard without touching auth */
        .app-shell.network-theme-dark,
        .app-shell.network-theme-light,
        .app-shell.network-theme-dark .app-rail,
        .app-shell.network-theme-light .app-rail,
        .app-shell.network-theme-dark .editor-header,
        .app-shell.network-theme-light .editor-header,
        .app-shell.network-theme-dark .editor-tabs,
        .app-shell.network-theme-light .editor-tabs,
        .app-shell.network-theme-dark .nodes-panel,
        .app-shell.network-theme-light .nodes-panel,
        .app-shell.network-theme-dark .inspector,
        .app-shell.network-theme-light .inspector,
        .app-shell.network-theme-dark .section-panel,
        .app-shell.network-theme-light .section-panel {
          transition: background-color .2s ease, border-color .2s ease, color .2s ease;
        }
    `}</style>
  );
}
