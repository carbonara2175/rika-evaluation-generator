"use strict";

const SUBJECTS = [
  {
    subject: "physics-basics",
    name: "物理基礎",
    majorSections: [
      { unit: "motion", majorSection: "運動の表し方", subItems: ["物理量の測定と扱い方", "運動の表し方", "直線運動の加速度"] },
      { unit: "forces", majorSection: "様々な力とその働き", subItems: ["様々な力", "力のつり合い", "運動の法則", "物体の落下運動"] },
      { unit: "mechanical-energy", majorSection: "力学的エネルギー", subItems: ["運動エネルギーと位置エネルギー", "力学的エネルギーの保存"] },
      { unit: "waves", majorSection: "波", subItems: ["波の性質", "音と振動"] },
      { unit: "heat", majorSection: "熱", subItems: ["熱と温度", "熱の利用"] },
      { unit: "electricity", majorSection: "電気", subItems: ["物質と電気抵抗", "電気の利用"] },
      { unit: "energy-use", majorSection: "エネルギーとその利用", subItems: ["エネルギーとその利用"] }
    ]
  }
];

const CRITERIA = [
  {
    key: "knowledge",
    heading: "知識・技能",
    generate: ({ majorSection, subItems }) => `${majorSection}について、${subItems.join("、")}を理解するとともに、それらの観察、実験などに関する技能を身に付けている。`
  },
  {
    key: "thinking",
    heading: "思考・判断・表現",
    generate: ({ majorSection }) => `${majorSection}について、観察、実験などを通して探究し、規則性や関係性を見いだして表現している。`
  },
  {
    key: "attitude",
    heading: "主体的に学習に取り組む態度",
    generate: ({ majorSection }) => `${majorSection}に主体的に関わり、科学的に探究しようとしている。`
  }
];

const subjectSelect = document.querySelector("#subject-select");
const unitSelect = document.querySelector("#unit-select");
const subitemsList = document.querySelector("#subitems-list");
const criteriaGrid = document.querySelector("#criteria-grid");
const copyAllButton = document.querySelector("#copy-all");
const toast = document.querySelector("#toast");
let toastTimer;

function selectedSubject() {
  return SUBJECTS.find(({ subject }) => subject === subjectSelect.value) || SUBJECTS[0];
}

function selectedUnit() {
  const subject = selectedSubject();
  return subject.majorSections.find(({ unit }) => unit === unitSelect.value) || subject.majorSections[0];
}

function generatedCriteria(unit = selectedUnit()) {
  return CRITERIA.map((criterion) => ({ ...criterion, text: criterion.generate(unit) }));
}

function populateSubjects() {
  subjectSelect.replaceChildren(...SUBJECTS.map(({ subject, name }) => new Option(name, subject)));
  populateUnits();
}

function populateUnits() {
  const subject = selectedSubject();
  unitSelect.replaceChildren(...subject.majorSections.map(({ unit, majorSection }) => new Option(majorSection, unit)));
  render();
}

function render() {
  const unit = selectedUnit();
  subitemsList.replaceChildren(...unit.subItems.map((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    return li;
  }));

  criteriaGrid.replaceChildren(...generatedCriteria(unit).map(({ key, heading, text }, index) => {
    const card = document.createElement("article");
    card.className = "criterion-card";
    card.innerHTML = `
      <div class="card-accent" aria-hidden="true"></div>
      <h3 data-index="VIEWPOINT ${String(index + 1).padStart(2, "0")}">${heading}</h3>
      <p class="criterion-text"></p>
      <button class="copy-button" type="button" data-key="${key}" aria-label="${heading}をコピー">コピー</button>
    `;
    card.querySelector(".criterion-text").textContent = text;
    return card;
  }));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  showToast();
}

function showToast() {
  window.clearTimeout(toastTimer);
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

subjectSelect.addEventListener("change", populateUnits);
unitSelect.addEventListener("change", render);
criteriaGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".copy-button");
  if (!button) return;
  const criterion = generatedCriteria().find(({ key }) => key === button.dataset.key);
  copyText(criterion.text);
});
copyAllButton.addEventListener("click", () => {
  const combined = generatedCriteria().map(({ heading, text }) => `${heading}\n${text}`).join("\n\n");
  copyText(combined);
});

populateSubjects();
