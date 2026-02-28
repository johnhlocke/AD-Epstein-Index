/**
 * REMOVED SECTION 4.5: Intelligence Infrastructure
 *
 * Saved from MethodologySection.tsx on 2026-02-27.
 * This section documented the six intelligence subsystems (episodic memory,
 * reflection, self-improvement, bulletin board, world model, curiosity)
 * and included Figs. 18-21.
 *
 * To restore: paste this JSX back into MethodologySection.tsx between
 * sections 4.4 and 4.5 (formerly 4.6), and renumber sections accordingly.
 * Requires: CodeBox, SectionTransition, SectionHeader, Sidenote components
 * and shared style constants (MONO, BG, BORDER, TEXT_LIGHT, TEXT_MID, etc.)
 */

// ── BEGIN REMOVED SECTION ──────────────────────────────────────────────────

/*
        <SectionTransition num="4.5" name="intelligence_infrastructure" />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4.5: INTELLIGENCE INFRASTRUCTURE
        ══════════════════════════════════════════════════════════════════ * /}
        <div id="section-4-5" className="mt-8 scroll-mt-24">
          <SectionHeader
            num="4.5"
            title="INTELLIGENCE INFRASTRUCTURE"
            subtitle="The agents don't just execute tasks. They remember, reflect, communicate, and improve."
            intro={[
              "Beyond the task pipeline, each agent has access to six shared intelligence subsystems that enable coordination without human intervention. These subsystems were designed to address seven specific capability gaps identified in early testing: the agents needed memory, reflection, self-improvement, planning, curiosity, a world model, and inter-agent communication.",
              "The episodic memory system stores every agent's experiences as searchable vector embeddings (384-dimensional, using ONNX all-MiniLM-L6-v2). When an agent encounters a new task, it retrieves semantically similar past episodes to inform its approach. Reflection runs every 10 minutes — each agent reviews its recent work, identifies patterns, and distills lessons. Self-improvement proposals surface every 30 minutes, suggesting methodology changes with explicit rationale.",
              "The inter-agent communication layer is a shared bulletin board where agents post warnings, discoveries, and status updates. A world model provides a structured snapshot of the entire pipeline — refreshed every 30 seconds — so agents can detect bottlenecks and adjust priorities. The curiosity system drives cross-agent pattern exploration every 15 minutes, surfacing connections that no single agent would find working alone.",
            ]}
            summary="The six intelligence subsystems transform a collection of isolated task-executors into a coordinated system that learns from its own experience, communicates across agents, and proposes its own improvements."
          />

          ... (Fig. 18: Agent Internal Architecture)
          ... (Fig. 19: Data Pipeline)
          ... (Fig. 20: Memory & Learning Architecture)
          ... (Fig. 21: Six Subsystems Grid)
        </div>
*/

// ── END REMOVED SECTION ────────────────────────────────────────────────────
// Full JSX preserved in git history at commit cef6d18.
