/** Sector starter logframes for MERL */

function node(tempId, parentTempId, level, title, description, sortOrder) {
  return { tempId, parentTempId, level, title, description, sortOrder };
}

function ind(resultNodeTempId, name, opts = {}) {
  return {
    resultNodeTempId,
    name,
    description: opts.description || "",
    unit: opts.unit || "number",
    direction: opts.direction || "increase",
    baselineValue: opts.baselineValue ?? 0,
    requiresEvidence: !!opts.requiresEvidence,
  };
}

export const TEMPLATES = [
  {
    key: "ag-smallholder",
    name: "Agriculture — Smallholder productivity",
    sector: "agriculture",
    description:
      "Logframe for farmer groups, vaccination/training outreach, and market access.",
    blueprint: {
      nodes: [
        node("g1", null, "goal", "Improved rural livelihoods through livestock & crop systems", "", 0),
        node("oc1", "g1", "outcome", "Increased livestock productivity and disease resilience", "", 0),
        node("oc2", "g1", "outcome", "Stronger farmer institutions and market participation", "", 1),
        node("op1", "oc1", "output", "Vaccination and animal health services delivered", "", 0),
        node("op2", "oc1", "output", "Farmers trained on improved practices", "", 1),
        node("op3", "oc2", "output", "Cooperatives / farmer groups supported", "", 0),
        node("op4", "oc2", "output", "Input / kit distribution completed", "", 1),
        node("a1", "op1", "activity", "Conduct vaccination campaigns", "", 0),
        node("a2", "op2", "activity", "Deliver farmer training sessions", "", 0),
        node("a3", "op3", "activity", "Register and mentor cooperatives", "", 0),
      ],
      indicators: [
        ind("op1", "Livestock vaccinated (doses)", { baselineValue: 0, requiresEvidence: true }),
        ind("op1", "Priority disease doses (PPR/CBPP/LSD)", { baselineValue: 0 }),
        ind("op1", "Vaccination campaigns completed", { baselineValue: 0, requiresEvidence: true }),
        ind("op2", "Farmer training sessions held", { baselineValue: 0 }),
        ind("op2", "Farmers trained (unique)", { baselineValue: 0 }),
        ind("op3", "Cooperatives registered", { baselineValue: 0, requiresEvidence: true }),
        ind("op3", "Women-majority cooperatives", { baselineValue: 0 }),
        ind("op4", "Tool kits distributed", { baselineValue: 0 }),
        ind("oc1", "Herd mortality rate (%)", {
          unit: "percent",
          direction: "decrease",
          baselineValue: 15,
        }),
        ind("oc2", "Cooperatives with market linkage", { baselineValue: 0 }),
      ],
    },
  },
  {
    key: "health-phc",
    name: "Health — Primary care & outreach",
    sector: "health",
    description:
      "Logframe for facility readiness, outreach coverage, and community health outcomes.",
    blueprint: {
      nodes: [
        node("g1", null, "goal", "Improved health outcomes in target communities", "", 0),
        node("oc1", "g1", "outcome", "Increased utilization of quality primary care", "", 0),
        node("oc2", "g1", "outcome", "Improved community health-seeking behaviour", "", 1),
        node("op1", "oc1", "output", "Facilities equipped and staffed", "", 0),
        node("op2", "oc1", "output", "Outreach / campaign services delivered", "", 1),
        node("op3", "oc2", "output", "Community health workers trained and active", "", 0),
        node("a1", "op1", "activity", "Procure and distribute essential equipment", "", 0),
        node("a2", "op2", "activity", "Run immunization / screening campaigns", "", 0),
        node("a3", "op3", "activity", "Train and supervise CHWs", "", 0),
      ],
      indicators: [
        ind("op1", "Facilities meeting readiness checklist", {
          baselineValue: 0,
          requiresEvidence: true,
        }),
        ind("op1", "Essential kits delivered", { baselineValue: 0 }),
        ind("op2", "People reached via outreach", { baselineValue: 0 }),
        ind("op2", "Immunizations administered", { baselineValue: 0, requiresEvidence: true }),
        ind("op3", "CHWs trained", { baselineValue: 0 }),
        ind("op3", "Active CHWs reporting monthly", { baselineValue: 0 }),
        ind("oc1", "Outpatient visits in target facilities", { baselineValue: 0 }),
        ind("oc1", "Facility delivery rate (%)", {
          unit: "percent",
          baselineValue: 40,
        }),
        ind("oc2", "Households with correct care-seeking (%)", {
          unit: "percent",
          baselineValue: 30,
        }),
      ],
    },
  },
  {
    key: "edu-access",
    name: "Education — Access & learning",
    sector: "education",
    description:
      "Logframe for enrolment, teacher capacity, and learning outcomes.",
    blueprint: {
      nodes: [
        node("g1", null, "goal", "Improved learning outcomes for target learners", "", 0),
        node("oc1", "g1", "outcome", "Increased equitable access to education", "", 0),
        node("oc2", "g1", "outcome", "Improved teaching quality and learning", "", 1),
        node("op1", "oc1", "output", "Learners enrolled and retained", "", 0),
        node("op2", "oc1", "output", "Learning materials distributed", "", 1),
        node("op3", "oc2", "output", "Teachers trained and coached", "", 0),
        node("a1", "op1", "activity", "Community enrolment drives", "", 0),
        node("a2", "op2", "activity", "Procure and distribute materials", "", 0),
        node("a3", "op3", "activity", "Teacher professional development", "", 0),
      ],
      indicators: [
        ind("op1", "Learners enrolled", { baselineValue: 0, requiresEvidence: true }),
        ind("op1", "Girls enrolled (%)", { unit: "percent", baselineValue: 45 }),
        ind("op1", "Retention rate (%)", { unit: "percent", baselineValue: 70 }),
        ind("op2", "Learning kits distributed", { baselineValue: 0 }),
        ind("op3", "Teachers trained", { baselineValue: 0, requiresEvidence: true }),
        ind("op3", "Coaching visits completed", { baselineValue: 0 }),
        ind("oc1", "Net enrolment rate (%)", { unit: "percent", baselineValue: 60 }),
        ind("oc2", "Learners meeting literacy benchmark (%)", {
          unit: "percent",
          baselineValue: 35,
        }),
        ind("oc2", "Learners meeting numeracy benchmark (%)", {
          unit: "percent",
          baselineValue: 30,
        }),
      ],
    },
  },
];
