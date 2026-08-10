# Prompt system

Agent prompts are version-controlled with their executable definitions in `/agents`. Each prompt receives organization context, least-privilege client context, the task objective, constraints, and typed task input. Output is constrained by the shared `AgentResult` JSON schema.

Prompt changes follow the same review path as code: evaluate against representative tasks, review safety and regression risk, then release with an application version. Production deployments should move stable prompt prefixes to OpenAI reusable prompts and record their prompt version on each task.

