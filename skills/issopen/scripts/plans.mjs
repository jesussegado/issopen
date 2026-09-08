export const planSections = {
  objective: "Objetivo",
  scope: "Alcance",
  outOfScope: "Fuera de alcance",
  decisions: "Decisiones vigentes y referencias de preguntas",
  design: "Diseño técnico",
  steps: "Pasos de implementación",
  acceptance: "Criterios de aceptación",
  dependencies: "Dependencias y condición de desbloqueo",
  verification: "Verificación",
  priority: "Prioridad y motivo",
  nextStep: "Siguiente paso",
};

export function renderPlan(plan) {
  const sections = Object.entries(planSections).map(([key, heading]) => {
    if (typeof plan[key] !== "string" || !plan[key].trim())
      throw new Error(`Missing plan section: ${key}`);
    return `## ${heading}\n\n${plan[key].trim()}`;
  });
  const description = sections.join("\n\n");
  if (description.length > 50000)
    throw new Error(
      "Plan exceeds 50000 characters; split by functional outcome, never truncate",
    );
  return description;
}
