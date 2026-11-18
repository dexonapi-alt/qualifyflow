# Connected milestone workspaces

The approved white canvas, Inter hierarchy, cobalt navigation, semantic pending/working/completed colors and compact user-oriented shell remain the foundation. No main-content redesign or new font/palette was introduced.

**Connections** is an operational table with explicit actual connection state and test time. Selecting a row reveals only its relevant controls; credential/simulation/scheduling controls use native disclosures. Credentials and webhook keys stay separate. One-time keys are masked and dismissible. Page-level result feedback survives versioned form refreshes. Current tenant grants determine visible management actions; provisioning-only users do not gain report access.

**Reports** uses the existing compact summary strip and aligned operational table. Its counts come from current engagements and assigned requirements, with meaningful evidence-state pills and a real View file action. A collapsed export control requests an actual scoped job; the download appears only after worker completion and remains permission-checked. There are no decorative metrics or legal qualification percentages.

**Requirement follow-up** reuses the real driver file and Cases workspace. Missing evidence opens a case with its actual driver, engagement and requirement context. It does not fabricate an incoming screening row. Existing source-origin cases keep their original context.

Visual QA covers Connections, Reports and requirement-origin Cases at375/768/1024/1440. Actual provider, schedule, export/download and file/case interactions are exercised by `frontend/scripts/milestone-review.mjs`; results/captures are in [milestone-resumption](milestone-resumption/results.json). Desktop and mobile captures were inspected. Routine actions retain existing keyboard, responsive and reduced-motion rules.

Examples: [Connections desktop](milestone-resumption/connections-1440.png), [Reports desktop](milestone-resumption/reports-1440.png), [requirement case mobile](milestone-resumption/requirement-case-375.png). The initial empty connection capture is retained as `connections-before-1440.png`; it is an empty-to-configured state comparison, not proof of a previous screen redesign.
