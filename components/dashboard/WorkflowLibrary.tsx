"use client";

import { ArrowRight, CircleHelp, Plus, Trash2, Workflow } from "lucide-react";
import type { SavedWorkflow } from "./types";

type Props = {
  workflows: SavedWorkflow[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onOpen: (workflow: SavedWorkflow) => void;
  onDuplicate: (workflow: SavedWorkflow) => void;
  onDelete: (id: string) => void;
};

function SearchIconPlaceholder() {
  return <span aria-hidden="true" style={{ display: "inline-flex" }}><CircleHelp size={16} /></span>;
}

/** Workflow library: browse, search, open, duplicate and delete saved workflows. */
export function WorkflowLibrary({ workflows, search, onSearchChange, onCreate, onOpen, onDuplicate, onDelete }: Props) {
  const visible = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <section className="workflow-library-page">
      <div className="workflow-library-inner">
        <div className="workflow-library-topbar">
          <div>
            <span className="overline">AUTOMATION / WORKFLOWS</span>
            <h1>Workflows</h1>
            <p>Create, organize and open your network automations.</p>
          </div>
          <button className="btn primary workflow-create-btn" type="button" onClick={onCreate}>
            <Plus size={16} /> Create workflow
          </button>
        </div>

        <div className="workflow-library-toolbar">
          <div className="workflow-library-search">
            <span>⌕</span>
            <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search workflows..." />
          </div>
          <span className="workflow-count">{workflows.length} {workflows.length === 1 ? "workflow" : "workflows"}</span>
        </div>

        {!workflows.length ? (
          <div className="workflow-empty-state">
            <div className="workflow-empty-icon"><Workflow size={28} /></div>
            <h2>Start with a blank workflow</h2>
            <p>Your workspace is empty. Build your first network automation from scratch using triggers, conditions and actions.</p>
            <button className="btn primary" type="button" onClick={onCreate}><Plus size={16} /> Create workflow from scratch</button>
          </div>
        ) : !visible.length ? (
          <div className="workflow-no-results"><SearchIconPlaceholder /> No workflows match “{search}”.</div>
        ) : (
          <div className="workflow-grid">
            {visible.map((workflow) => (
              <article className="workflow-card" key={workflow.id}>
                <button className="workflow-card-main" type="button" onClick={() => onOpen(workflow)}>
                  <div className="workflow-card-icon"><Workflow size={19} /></div>
                  <div className="workflow-card-copy">
                    <strong>{workflow.name}</strong>
                    <span>{workflow.nodes.length} {workflow.nodes.length === 1 ? "node" : "nodes"} · Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <ArrowRight size={17} className="workflow-card-arrow" />
                </button>
                <div className="workflow-card-footer">
                  <span className={workflow.published ? "workflow-status published" : "workflow-status"}>
                    <i /> {workflow.published ? "Published" : "Draft"}
                  </span>
                  <div className="workflow-card-actions">
                    <button type="button" onClick={() => onDuplicate(workflow)} title="Duplicate"><Plus size={14} /></button>
                    <button type="button" onClick={() => onDelete(workflow.id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
