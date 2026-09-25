"use strict";

const SUBJECTS = [
  {
    subject: "physics-basics",
    name: "物理基礎",
    objective: `物体の運動と様々なエネルギーに関わり、理科の見方・考え方を働かせ、見通しをもって観察、実験を行うことなどを通して、物体の運動と様々なエネルギーを科学的に探究するために必要な資質・能力を次のとおり育成することを目指す。

（1）日常生活や社会との関連を図りながら、物体の運動と様々なエネルギーについて理解するとともに、科学的に探究するために必要な観察、実験などに関する基本的な技能を身に付けるようにする。

（2）観察、実験などを行い、科学的に探究する力を養う。

（3）物体の運動と様々なエネルギーに主体的に関わり、科学的に探究しようとする態度を養う。`,
    majorSections: [
      {
        majorSection: "物体の運動とエネルギー",
        units: [
          { unit: "運動の表し方", id: "motion", subItems: ["物理量の測定と扱い方", "運動の表し方", "直線運動の加速度"] },
          { unit: "様々な力とその働き", id: "forces", subItems: ["様々な力", "力のつり合い", "運動の法則", "物体の落下運動"] },
          { unit: "力学的エネルギー", id: "mechanical-energy", subItems: ["運動エネルギーと位置エネルギー", "力学的エネルギーの保存"] }
        ]
      },
      {
        majorSection: "様々な物理現象とエネルギーの利用",
        units: [
          { unit: "波", id: "waves", subItems: ["波の性質", "音と振動"] },
          { unit: "熱", id: "heat", subItems: ["熱と温度", "熱の利用"] },
          { unit: "電気", id: "electricity", subItems: ["物質と電気抵抗", "電気の利用"] },
          { unit: "エネルギーとその利用", id: "energy-use", subItems: ["エネルギーとその利用"] }
        ]
      }
    ]
  },
  {
    subject: "physics",
    name: "物理",
    objective: `物理的な事物・現象に関わり、理科の見方・考え方を働かせ、見通しをもって観察、実験を行うことなどを通して、物理的な事物・現象を科学的に探究するために必要な資質・能力を次のとおり育成することを目指す。

（1）物理学の基本的な概念や原理・法則の理解を深め、科学的に探究するために必要な観察、実験などに関する技能を身に付けるようにする。

（2）観察、実験などを行い、科学的に探究する力を養う。

（3）物理的な事物・現象に主体的に関わり、科学的に探究しようとする態度を養う。`,
    majorSections: [
      {
        majorSection: "様々な運動",
        units: [
          { unit: "平面内の運動と剛体のつり合い", id: "planar-motion-rigid-body", subItems: ["曲線運動の速度と加速度", "放物運動", "剛体のつり合い"] },
          { unit: "運動量", id: "momentum", subItems: ["運動量と力積", "運動量の保存", "衝突と力学的エネルギー"] },
          { unit: "円運動と単振動", id: "circular-motion-oscillation", subItems: ["円運動", "単振動"] },
          { unit: "万有引力", id: "gravitation", subItems: ["惑星の運動", "万有引力"] },
          { unit: "気体分子の運動", id: "molecular-motion", subItems: ["気体分子の運動と圧力", "気体の内部エネルギー", "気体の状態変化"] }
        ]
      },
      {
        majorSection: "波",
        units: [
          { unit: "波の伝わり方", id: "wave-propagation", subItems: ["波の伝わり方とその表し方", "波の干渉と回折"] },
          { unit: "音", id: "sound", subItems: ["音の干渉と回折", "音のドップラー効果"] },
          { unit: "光", id: "light", subItems: ["光の伝わり方", "光の回折と干渉"] }
        ]
      },
      {
        majorSection: "電気と磁気",
        units: [
          { unit: "電気と電流", id: "electricity-current", subItems: ["電荷と電界", "電界と電位", "電気容量", "電気回路"] },
          { unit: "電流と磁界", id: "current-magnetic-field", subItems: ["電流による磁界", "電流が磁界から受ける力", "電磁誘導", "電磁波"] }
        ]
      },
      {
        majorSection: "原子",
        units: [
          { unit: "電子と光", id: "electrons-light", subItems: ["電子", "粒子性と波動性"] },
          { unit: "原子と原子核", id: "atoms-nuclei", subItems: ["原子とスペクトル", "原子核", "素粒子"] }
        ]
      }
    ]
  }
];

const CRITERIA = [
  {
    key: "knowledge",
    heading: "知識・技能",
    generate: ({ unit, subItems }) => `${unit}について、${subItems.join("、")}を理解するとともに、それらの観察、実験などに関する技能を身に付けている。`
  },
  {
    key: "thinking",
    heading: "思考・判断・表現",
    generate: ({ unit }) => `${unit}について、観察、実験などを通して探究し、規則性や関係性を見いだして表現している。`
  },
  {
    key: "attitude",
    heading: "主体的に学習に取り組む態度",
    generate: ({ unit }) => `${unit}に主体的に関わり、科学的に探究しようとしている。`
  }
];

const subjectSelect = document.querySelector("#subject-select");
const unitSelect = document.querySelector("#unit-select");
const subitemsList = document.querySelector("#subitems-list");
const subjectObjective = document.querySelector("#subject-objective");
const copyObjectiveButton = document.querySelector("#copy-objective");
const criteriaGrid = document.querySelector("#criteria-grid");
const copyAllButton = document.querySelector("#copy-all");
const toast = document.querySelector("#toast");
let toastTimer;

const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
const ANNUAL_STORAGE_KEY = "rika-annual-hours-v1";
const criteriaTab = document.querySelector("#criteria-tab");
const annualTab = document.querySelector("#annual-tab");
const criteriaView = document.querySelector("#criteria-view");
const annualView = document.querySelector("#annual-view");
const annualSubject = document.querySelector("#annual-subject");
const creditsInput = document.querySelector("#credits");
const weeklyHoursInput = document.querySelector("#weekly-hours");
const monthInputs = document.querySelector("#month-inputs");

function selectedSubject() {
  return SUBJECTS.find(({ subject }) => subject === subjectSelect.value) || SUBJECTS[0];
}

function selectedUnit() {
  const subject = selectedSubject();
  const units = subject.majorSections.flatMap(({ majorSection, units }) =>
    units.map((unit) => ({ ...unit, majorSection }))
  );
  return units.find(({ id }) => id === unitSelect.value) || units[0];
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
  const groups = subject.majorSections.map(({ majorSection, units }) => {
    const group = document.createElement("optgroup");
    group.label = majorSection;
    group.replaceChildren(...units.map(({ id, unit }) => new Option(unit, id)));
    return group;
  });
  unitSelect.replaceChildren(...groups);
  render();
}

function render() {
  const unit = selectedUnit();
  subjectObjective.replaceChildren(...selectedSubject().objective.split("\n\n").map((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    return p;
  }));
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
copyObjectiveButton.addEventListener("click", () => copyText(selectedSubject().objective));

function selectView(view) {
  const showAnnual = view === "annual";
  annualView.hidden = !showAnnual;
  criteriaView.hidden = showAnnual;
  annualTab.classList.toggle("active", showAnnual);
  criteriaTab.classList.toggle("active", !showAnnual);
  annualTab.setAttribute("aria-selected", String(showAnnual));
  criteriaTab.setAttribute("aria-selected", String(!showAnnual));
}

function annualState() {
  return {
    subject: annualSubject.value,
    credits: Math.min(10, Math.max(1, Math.trunc(Number(creditsInput.value) || 1))),
    weeklyHours: Math.max(0, Number(weeklyHoursInput.value) || 0),
    days: [...monthInputs.querySelectorAll("input")].map((input) => Math.max(0, Math.trunc(Number(input.value) || 0)))
  };
}

function saveAnnualState(state) {
  try { localStorage.setItem(ANNUAL_STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage may be disabled by the browser. */ }
}

function renderAnnual() {
  const state = annualState();
  const annualHours = calculateAnnualHours(state.credits);
  const totalDays = state.days.reduce((sum, value) => sum + value, 0);
  const expected = calculateExpectedHours(totalDays, state.weeklyHours);
  const allocations = allocateByLargestRemainder(annualHours, state.days);
  const allocated = allocations.reduce((sum, value) => sum + value, 0);
  document.querySelector("#standard-hours").value = `${annualHours}時間`;
  document.querySelector("#summary-standard").textContent = `${annualHours}時間`;
  document.querySelector("#summary-days").textContent = `${totalDays}日`;
  document.querySelector("#summary-expected").textContent = `${expected.toFixed(1)}時間`;
  document.querySelector("#summary-rounded").textContent = `（約${Math.round(expected)}時間）`;
  document.querySelector("#summary-allocation").textContent = `${allocated} / ${annualHours}時間`;
  document.querySelector("#annual-table-body").replaceChildren(...MONTHS.map((month, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<th scope="row">${month}</th><td>${state.days[index]}日</td><td>${calculateExpectedHours(state.days[index], state.weeklyHours).toFixed(1)}h</td><td><strong>${allocations[index]}h</strong></td>`;
    return row;
  }));
  document.querySelector("#annual-table-foot").innerHTML = `<tr><th scope="row">合計</th><td>${totalDays}日</td><td>${expected.toFixed(1)}h</td><td>${allocated}h</td></tr>`;
  saveAnnualState(state);
}

function allocationText() {
  const state = annualState();
  const annualHours = calculateAnnualHours(state.credits);
  const allocations = allocateByLargestRemainder(annualHours, state.days);
  return `${MONTHS.map((month, index) => `${month}：${allocations[index]}時間`).join("\n")}\n\n合計：${allocations.reduce((sum, value) => sum + value, 0)}時間`;
}

function initializeAnnual() {
  monthInputs.replaceChildren(...MONTHS.map((month, index) => {
    const label = document.createElement("label");
    label.className = "month-field";
    label.innerHTML = `<span>${month}</span><span class="number-with-unit"><input type="number" min="0" step="1" inputmode="numeric" data-month="${index}" value="0" aria-label="${month}の授業可能日数"><small>日</small></span>`;
    return label;
  }));
  try {
    const saved = JSON.parse(localStorage.getItem(ANNUAL_STORAGE_KEY));
    if (saved) {
      annualSubject.value = saved.subject || "";
      creditsInput.value = saved.credits || 2;
      weeklyHoursInput.value = saved.weeklyHours ?? saved.credits ?? 2;
      [...monthInputs.querySelectorAll("input")].forEach((input, index) => { input.value = saved.days?.[index] ?? 0; });
    }
  } catch { localStorage.removeItem(ANNUAL_STORAGE_KEY); }
  renderAnnual();
}

criteriaTab.addEventListener("click", () => selectView("criteria"));
annualTab.addEventListener("click", () => selectView("annual"));
document.querySelector("#annual-view").addEventListener("input", renderAnnual);
monthInputs.addEventListener("change", (event) => {
  if (event.target.matches("input")) event.target.value = Math.max(0, Math.trunc(Number(event.target.value) || 0));
  renderAnnual();
});
creditsInput.addEventListener("change", () => { weeklyHoursInput.value = creditsInput.value; renderAnnual(); });
document.querySelector("#copy-allocation").addEventListener("click", () => copyText(allocationText()));
document.querySelector("#copy-annual-result").addEventListener("click", () => {
  const state = annualState();
  const annualHours = calculateAnnualHours(state.credits);
  const totalDays = state.days.reduce((sum, value) => sum + value, 0);
  copyText(`科目：${state.subject || "未入力"}\n単位数：${state.credits}単位\n標準年間時数：${annualHours}時間\n授業可能日数：${totalDays}日\n実働見込み：${calculateExpectedHours(totalDays, state.weeklyHours).toFixed(1)}時間（約${Math.round(calculateExpectedHours(totalDays, state.weeklyHours))}時間）\n\n月別配当\n${allocationText()}`);
});
document.querySelector("#reset-annual").addEventListener("click", () => {
  localStorage.removeItem(ANNUAL_STORAGE_KEY);
  annualSubject.value = ""; creditsInput.value = 2; weeklyHoursInput.value = 2;
  monthInputs.querySelectorAll("input").forEach((input) => { input.value = 0; });
  renderAnnual();
});

populateSubjects();
initializeAnnual();
