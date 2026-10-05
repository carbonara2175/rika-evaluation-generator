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
const SCHOOLS = {
  sanno: { name: "三本木農業恵拓高校", courses: { physicsBasic: { name: "物理基礎", credits: 2, weeklyHours: 2 } } },
  santo: { name: "三戸高校", courses: { physics: { name: "物理", credits: 4, weeklyHours: 4 } } },
  gosho: { name: "五所川原工科高校", courses: { inquiryPhysics: { name: "探究物理", credits: 2, weeklyHours: 2 } } },
  ajigasawa: { name: "鰺ヶ沢高校", courses: { inquiryPhysics: { name: "探究物理", credits: 4, weeklyHours: 4 } } },
  other: { name: "その他", courses: { custom: { name: "任意の科目", credits: 2, weeklyHours: 2 } } }
};
const ANNUAL_SELECTION_KEY = "rika-annual-hours-selection-v3";
const ANNUAL_STORAGE_PREFIX = "annualHours_";
const LEGACY_ANNUAL_STORAGE_KEY = "rika-annual-hours-v1";
const PREVIOUS_ANNUAL_STORAGE_KEY = "rika-annual-hours-v2";
const criteriaTab = document.querySelector("#criteria-tab");
const annualTab = document.querySelector("#annual-tab");
const criteriaView = document.querySelector("#criteria-view");
const annualView = document.querySelector("#annual-view");
const unitPlanTab = document.querySelector("#unit-plan-tab");
const unitPlanView = document.querySelector("#unit-plan-view");
const annualEventsTab = document.querySelector("#annual-events-tab");
const annualEventsView = document.querySelector("#annual-events-view");
const annualSchool = document.querySelector("#annual-school");
const annualSubject = document.querySelector("#annual-subject");
const customSchoolName = document.querySelector("#custom-school-name");
const customSubjectName = document.querySelector("#custom-subject-name");
const creditsInput = document.querySelector("#credits");
const weeklyHoursInput = document.querySelector("#weekly-hours");
const actualHoursInput = document.querySelector("#actual-hours");
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

function showToast(message = "コピーしました", isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
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
  const showUnitPlan = view === "unit-plan";
  const showAnnualEvents = view === "annual-events";
  annualView.hidden = !showAnnual;
  unitPlanView.hidden = !showUnitPlan;
  annualEventsView.hidden = !showAnnualEvents;
  criteriaView.hidden = showAnnual || showUnitPlan || showAnnualEvents;
  annualTab.classList.toggle("active", showAnnual);
  unitPlanTab.classList.toggle("active", showUnitPlan);
  annualEventsTab.classList.toggle("active", showAnnualEvents);
  criteriaTab.classList.toggle("active", !showAnnual && !showUnitPlan && !showAnnualEvents);
  annualTab.setAttribute("aria-selected", String(showAnnual));
  unitPlanTab.setAttribute("aria-selected", String(showUnitPlan));
  annualEventsTab.setAttribute("aria-selected", String(showAnnualEvents));
  criteriaTab.setAttribute("aria-selected", String(!showAnnual && !showUnitPlan && !showAnnualEvents));
  if (showAnnual) renderAnnual();
  if (showAnnualEvents) renderAnnualEvents();
}

function stableCustomId(value, fallback) {
  const text = value.trim();
  if (!text) return fallback;
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `custom${(hash >>> 0).toString(36)}`;
}

function annualIds() {
  const custom = annualSchool.value === "other";
  return {
    schoolId: custom ? stableCustomId(customSchoolName.value, "customSchool") : annualSchool.value,
    courseId: custom ? stableCustomId(customSubjectName.value, "customCourse") : annualSubject.value
  };
}

function annualStorageKey() {
  const { schoolId, courseId } = annualIds();
  return `${ANNUAL_STORAGE_PREFIX}${schoolId}_${courseId}`;
}

function annualPreset() {
  const school = SCHOOLS[annualSchool.value] || SCHOOLS.sanno;
  return school.courses[annualSubject.value] || Object.values(school.courses)[0];
}

function annualState() {
  const { schoolId, courseId } = annualIds();
  const actualHours = unitHoursTotal(schoolId, courseId);
  return {
    schoolId: annualSchool.value,
    courseId: annualSubject.value,
    schoolName: annualSchool.value === "other" ? customSchoolName.value.trim() : SCHOOLS[annualSchool.value].name,
    courseName: annualSchool.value === "other" ? customSubjectName.value.trim() : annualPreset().name,
    credits: Math.min(10, Math.max(1, Math.trunc(Number(creditsInput.value) || 1))),
    weeklyHours: Math.max(0, Number(weeklyHoursInput.value) || 0),
    actualHours,
    days: [...monthInputs.querySelectorAll("input")].map((input) => Math.max(0, Math.trunc(Number(input.value) || 0)))
  };
}

function loadStoredAnnualState() {
  try { return JSON.parse(localStorage.getItem(annualStorageKey())); } catch { return null; }
}

function saveAnnualState(state) {
  try {
    localStorage.setItem(annualStorageKey(), JSON.stringify(state));
    localStorage.setItem(ANNUAL_SELECTION_KEY, JSON.stringify({
      schoolId: state.schoolId, courseId: state.courseId, schoolName: state.schoolName, courseName: state.courseName
    }));
  } catch { /* Storage may be disabled by the browser. */ }
}

function populateAnnualCourses(courseId) {
  const courses = SCHOOLS[annualSchool.value].courses;
  annualSubject.replaceChildren(...Object.entries(courses).map(([id, course]) => new Option(course.name, id)));
  if (courseId && courses[courseId]) annualSubject.value = courseId;
  const custom = annualSchool.value === "other";
  document.querySelector("#custom-school-field").hidden = !custom;
  document.querySelector("#custom-subject-field").hidden = !custom;
}

function applyAnnualState(resetToPreset = false) {
  const preset = annualPreset();
  const saved = resetToPreset ? null : loadStoredAnnualState();
  creditsInput.value = saved?.credits ?? preset.credits;
  weeklyHoursInput.value = saved?.weeklyHours ?? preset.weeklyHours;
  [...monthInputs.querySelectorAll("input")].forEach((input, index) => { input.value = saved?.days?.[index] ?? 0; });
}

function renderAnnual() {
  const state = annualState();
  const annualHours = calculateAnnualHours(state.credits);
  const totalDays = state.days.reduce((sum, value) => sum + value, 0);
  const rawProjectedHours = calculateExpectedHours(totalDays, state.weeklyHours);
  const rawDifference = calculateOperationalDifference(rawProjectedHours, state.actualHours);
  const allocations = allocateByLargestRemainder(annualHours, state.days);
  const allocated = allocations.reduce((sum, value) => sum + value, 0);
  const marginHours = annualHours - state.actualHours;
  document.querySelector("#standard-hours").value = `${annualHours}時間`;
  actualHoursInput.value = `${state.actualHours}時間`;
  document.querySelector("#summary-standard").textContent = `${annualHours}時間`;
  document.querySelector("#summary-actual").textContent = `${state.actualHours}時間`;
  document.querySelector("#summary-margin").textContent = `${marginHours}時間`;
  document.querySelector("#summary-days").textContent = `${totalDays}日`;
  document.querySelector("#summary-expected").textContent = `${Math.round(rawProjectedHours)}時間`;
  document.querySelector("#summary-difference-label").textContent = rawDifference < 0 ? "不足見込み" : "余裕見込み";
  document.querySelector("#summary-difference").textContent = `${Math.round(Math.abs(rawDifference))}時間`;
  document.querySelector("#difference-card").classList.toggle("shortage", rawDifference < 0);
  document.querySelector("#summary-allocation").textContent = `${allocated} / ${annualHours}時間`;
  document.querySelector("#annual-table-body").replaceChildren(...MONTHS.map((month, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<th scope="row">${month}</th><td>${state.days[index]}日</td><td>${calculateExpectedHours(state.days[index], state.weeklyHours).toFixed(1)}h</td><td><strong>${allocations[index]}h</strong></td>`;
    return row;
  }));
  document.querySelector("#annual-table-foot").innerHTML = `<tr><th scope="row">合計</th><td>${totalDays}日</td><td>${rawProjectedHours.toFixed(1)}h</td><td>${allocated}h</td></tr>`;
  saveAnnualState(state);
}

function allocationText() {
  const state = annualState();
  const allocations = allocateByLargestRemainder(calculateAnnualHours(state.credits), state.days);
  return `${MONTHS.map((month, index) => `${month}：${allocations[index]}時間`).join("\n")}\n\n合計：${allocations.reduce((sum, value) => sum + value, 0)}時間`;
}

function migrateAnnualData() {
  if (localStorage.getItem("annualHours_sanno_physicsBasic")) return;
  try {
    const previous = JSON.parse(localStorage.getItem(PREVIOUS_ANNUAL_STORAGE_KEY));
    const legacy = JSON.parse(localStorage.getItem(LEGACY_ANNUAL_STORAGE_KEY));
    const mappings = { "physics-basics": ["sanno", "physicsBasic"], physics: ["santo", "physics"] };
    Object.entries(previous?.subjects || {}).forEach(([oldId, state]) => {
      const ids = mappings[oldId];
      if (ids) localStorage.setItem(`${ANNUAL_STORAGE_PREFIX}${ids[0]}_${ids[1]}`, JSON.stringify({ ...state, actualHours: calculateAnnualHours(state.credits) }));
    });
    if (!previous && legacy) {
      const ids = legacy.subject === "物理" ? mappings.physics : mappings["physics-basics"];
      localStorage.setItem(`${ANNUAL_STORAGE_PREFIX}${ids[0]}_${ids[1]}`, JSON.stringify({ ...legacy, actualHours: calculateAnnualHours(legacy.credits) }));
    }
  } catch { /* Invalid legacy data is ignored without deleting it. */ }
}

function initializeAnnual() {
  annualSchool.replaceChildren(...Object.entries(SCHOOLS).map(([id, school]) => new Option(school.name, id)));
  monthInputs.replaceChildren(...MONTHS.map((month, index) => {
    const label = document.createElement("label");
    label.className = "month-field";
    label.innerHTML = `<span>${month}</span><span class="number-with-unit"><input type="number" min="0" step="1" inputmode="numeric" data-month="${index}" value="0" aria-label="${month}の授業可能日数"><small>日</small></span>`;
    return label;
  }));
  migrateAnnualData();
  let selection;
  try { selection = JSON.parse(localStorage.getItem(ANNUAL_SELECTION_KEY)); } catch { /* Use defaults. */ }
  if (!selection) {
    try {
      const previous = JSON.parse(localStorage.getItem(PREVIOUS_ANNUAL_STORAGE_KEY));
      const migratedSelection = { "physics-basics": ["sanno", "physicsBasic"], physics: ["santo", "physics"] }[previous?.selectedSubject];
      if (migratedSelection) selection = { schoolId: migratedSelection[0], courseId: migratedSelection[1] };
    } catch { /* Use defaults. */ }
  }
  annualSchool.value = SCHOOLS[selection?.schoolId] ? selection.schoolId : "sanno";
  customSchoolName.value = selection?.schoolName || "";
  customSubjectName.value = selection?.courseName || "";
  populateAnnualCourses(selection?.courseId);
  applyAnnualState();
  renderAnnual();
}

criteriaTab.addEventListener("click", () => selectView("criteria"));
annualTab.addEventListener("click", () => selectView("annual"));
unitPlanTab.addEventListener("click", () => selectView("unit-plan"));
annualEventsTab.addEventListener("click", () => selectView("annual-events"));
annualSchool.addEventListener("change", () => { populateAnnualCourses(); applyAnnualState(); renderAnnual(); });
annualSubject.addEventListener("change", () => { applyAnnualState(); renderAnnual(); });
[creditsInput, weeklyHoursInput, customSchoolName, customSubjectName].forEach((input) => input.addEventListener("input", renderAnnual));
monthInputs.addEventListener("input", renderAnnual);
monthInputs.addEventListener("change", (event) => {
  if (event.target.matches("input")) event.target.value = Math.max(0, Math.trunc(Number(event.target.value) || 0));
  renderAnnual();
});
document.querySelector("#copy-allocation").addEventListener("click", () => copyText(allocationText()));
document.querySelector("#copy-annual-result").addEventListener("click", () => {
  const state = annualState();
  const annualHours = calculateAnnualHours(state.credits);
  const totalDays = state.days.reduce((sum, value) => sum + value, 0);
  const rawProjectedHours = calculateExpectedHours(totalDays, state.weeklyHours);
  const rawDifference = calculateOperationalDifference(rawProjectedHours, state.actualHours);
  const differenceLabel = rawDifference < 0 ? "不足見込み" : "余裕見込み";
  copyText(`学校：${state.schoolName}\n科目：${state.courseName}\n単位数：${state.credits}単位\n標準年間時数：${annualHours}時間\n単元指導計画時数：${state.actualHours}時間\n授業実施見込み：${Math.round(rawProjectedHours)}時間\n${differenceLabel}：${Math.round(Math.abs(rawDifference))}時間\n授業可能日数：${totalDays}日\n標準時数との差：${annualHours - state.actualHours}時間（実施上の余裕ではありません）\n\n月別配当\n${allocationText()}`);
});
document.querySelector("#reset-annual").addEventListener("click", () => {
  localStorage.removeItem(annualStorageKey());
  applyAnnualState(true);
  renderAnnual();
});

// Courses and units deliberately live below each school. In particular, the two
// inquiry-physics entries are independent even though their display names match.
const SCHOOL_COURSES = {
  sanno: { physicsBasic: { name: "物理基礎", subjectId: "physics-basics" } },
  santo: { physics: { name: "物理", subjectId: "physics" } },
  gosho: { inquiryPhysics: { name: "探究物理", units: [], manualUnit: true } },
  ajigasawa: { inquiryPhysics: { name: "探究物理", units: [], manualUnit: true } },
  other: { custom: { name: "任意の科目", units: [], manualUnit: true } }
};
const PLAN_SELECTION_KEY = "rika-unit-plan-selection-v2";
const LEGACY_PLAN_SELECTION_KEY = "rika-unit-plan-selection-v1";
const PLAN_STORAGE_PREFIX = "rika-unit-plan-v2:";
const LEGACY_PLAN_STORAGE_PREFIX = "rika-unit-plan-v1:";
const PLAN_LAST_UNIT_PREFIX = "rika-unit-plan-last-unit-v2:";
const PLAN_USER_INFO_KEY = "rika-unit-plan-user-info-v1";
const planSchool = document.querySelector("#plan-school");
const planSubject = document.querySelector("#plan-subject");
const planUnit = document.querySelector("#plan-unit");
const planCustomUnit = document.querySelector("#plan-custom-unit");
const allocatedHoursInput = document.querySelector("#allocated-hours");
const affiliationInput = document.querySelector("#affiliation");
const teacherNameInput = document.querySelector("#teacher-name");
const lessonRows = document.querySelector("#lesson-rows");
const evaluationValues = ["", "formative", "summative"];

function planSubjectData() {
  const course = SCHOOL_COURSES[planSchool.value]?.[planSubject.value] || Object.values(SCHOOL_COURSES.sanno)[0];
  const preset = SUBJECTS.find(({ subject }) => subject === course.subjectId);
  const schoolUnits = course.units?.length ? [{ majorSection: "学校設定単元", units: course.units }] : [];
  return preset ? { ...preset, courseId: planSubject.value } : { subject: planSubject.value, courseId: planSubject.value, name: course.name, majorSections: course.majorSections || schoolUnits };
}

function planUnits(subject = planSubjectData()) {
  return subject.majorSections.flatMap(({ majorSection, units }) => units.map((unit) => ({ ...unit, majorSection })));
}

function planUnitData() {
  const preset = planUnits().find(({ id }) => id === planUnit.value) || planUnits()[0];
  if (preset) return preset;
  const name = planCustomUnit.value.trim() || "単元名未設定";
  return { id: stableCustomId(name, "manualUnit"), unit: name, subItems: ["設定した学習内容"] };
}

function planStorageKey() {
  return `${PLAN_STORAGE_PREFIX}${planSchool.value}__${planSubject.value}__${planUnitData().id}`;
}

function unitHoursTotal(schoolId, courseId) {
  const prefix = `${PLAN_STORAGE_PREFIX}${schoolId}__${courseId}__`;
  const plans = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try { plans.push(JSON.parse(localStorage.getItem(key))); }
      catch { /* Ignore only the invalid entry; keep all other saved plans. */ }
    }
  } catch { /* Storage may be disabled by the browser. */ }
  return calculateUnitHoursTotal(plans);
}

function renderUnitHoursTotal() {
  document.querySelector("#unit-total-hours").textContent = `${unitHoursTotal(planSchool.value, planSubject.value)}時間`;
}

function blankLesson(hour) {
  return { hour, activity: "", evaluation: { knowledge: "", thinking: "", attitude: "" }, method: "" };
}

function normalizedPlan(raw = {}) {
  const allocatedHours = Math.max(1, Math.trunc(Number(raw.allocatedHours) || 8));
  const rows = Array.from({ length: allocatedHours }, (_, index) => {
    const saved = raw.rows?.[index] || {};
    return { ...blankLesson(index + 1), ...saved, hour: index + 1, evaluation: { ...blankLesson(0).evaluation, ...saved.evaluation } };
  });
  return { schoolId: planSchool.value, courseId: planSubject.value, unitId: planUnitData().id, unitName: planUnitData().unit, allocatedHours, rows };
}

function loadPlan() {
  try { return normalizedPlan(JSON.parse(localStorage.getItem(planStorageKey())) || {}); }
  catch { return normalizedPlan(); }
}

function currentPlan() {
  const allocatedHours = Math.max(1, Math.trunc(Number(allocatedHoursInput.value) || 1));
  const rows = [...lessonRows.querySelectorAll("tr")].map((row, index) => ({
    hour: index + 1,
    activity: row.querySelector('[data-field="activity"]').value,
    evaluation: Object.fromEntries(["knowledge", "thinking", "attitude"].map((key) => [key, row.querySelector(`[data-evaluation="${key}"]`).dataset.value || ""])),
    method: row.querySelector('[data-field="method"]').value
  }));
  return { schoolId: planSchool.value, courseId: planSubject.value, unitId: planUnitData().id, unitName: planUnitData().unit, allocatedHours, rows };
}

function savePlan() {
  try {
    localStorage.setItem(planStorageKey(), JSON.stringify(currentPlan()));
    localStorage.setItem(PLAN_SELECTION_KEY, JSON.stringify({ schoolId: planSchool.value, courseId: planSubject.value, unitId: planUnitData().id, unitName: planUnitData().unit }));
    localStorage.setItem(`${PLAN_LAST_UNIT_PREFIX}${planSchool.value}__${planSubject.value}`, JSON.stringify({ unitId: planUnitData().id, unitName: planUnitData().unit }));
  } catch { /* Storage may be disabled by the browser. */ }
  renderUnitHoursTotal();
}

function userInfo() {
  return { affiliation: affiliationInput.value, teacherName: teacherNameInput.value };
}

function loadUserInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_USER_INFO_KEY)) || {};
    affiliationInput.value = typeof saved.affiliation === "string" ? saved.affiliation : "";
    teacherNameInput.value = typeof saved.teacherName === "string" ? saved.teacherName : "";
  } catch {
    affiliationInput.value = "";
    teacherNameInput.value = "";
  }
}

function saveUserInfo() {
  try { localStorage.setItem(PLAN_USER_INFO_KEY, JSON.stringify(userInfo())); }
  catch { /* Storage may be disabled by the browser. */ }
}

function evaluationMark(value) {
  return value === "formative" ? "○" : value === "summative" ? "◎" : "";
}

function renderLessonRows(plan) {
  lessonRows.replaceChildren(...plan.rows.map((lesson) => {
    const row = document.createElement("tr");
    row.innerHTML = `<th scope="row"><span>${lesson.hour}</span><small>時間目</small></th><td><label><span class="mobile-label">学習活動（学習内容）</span><textarea data-field="activity" rows="3" aria-label="${lesson.hour}時間目の学習活動"></textarea></label></td>${["knowledge", "thinking", "attitude"].map((key) => `<td class="evaluation-cell"><button type="button" class="evaluation-toggle" data-evaluation="${key}" data-value="${lesson.evaluation[key]}" aria-label="${lesson.hour}時間目の${key === "knowledge" ? "知識・技能" : key === "thinking" ? "思考・判断・表現" : "主体的態度"}の評価">${evaluationMark(lesson.evaluation[key])}</button></td>`).join("")}<td><label><span class="mobile-label">評価の観点及び方法</span><textarea data-field="method" rows="3" aria-label="${lesson.hour}時間目の評価の観点及び方法"></textarea></label></td>`;
    row.querySelector('[data-field="activity"]').value = lesson.activity;
    row.querySelector('[data-field="method"]').value = lesson.method;
    return row;
  }));
  document.querySelector("#hours-progress").textContent = `${plan.rows.length} / ${plan.allocatedHours}時間`;
}

function unitGoals(unit = planUnitData()) {
  return [
    `${unit.unit}について、${unit.subItems.join("、")}を理解するとともに、それらの観察、実験などに関する技能を身に付けること。`,
    `${unit.unit}について、観察、実験などを通して探究し、科学的に考察し、表現すること。`,
    `${unit.unit}に主体的に関わり、科学的に探究しようとする態度を養うこと。`
  ];
}

function renderUnitPlan() {
  const unit = planUnitData();
  const plan = loadPlan();
  allocatedHoursInput.value = plan.allocatedHours;
  document.querySelector("#unit-goals").replaceChildren(...unitGoals(unit).map((text, index) => {
    const article = document.createElement("article");
    article.innerHTML = `<strong>（${index + 1}）${["知識及び技能", "思考力・判断力・表現力等", "学びに向かう力、人間性等"][index]}</strong><p></p>`;
    article.querySelector("p").textContent = text;
    return article;
  }));
  document.querySelector("#unit-criteria").replaceChildren(...generatedCriteria(unit).map(({ heading, text }) => {
    const article = document.createElement("article");
    article.className = "criterion-card";
    article.innerHTML = `<div class="card-accent" aria-hidden="true"></div><h3>${heading}</h3><p class="criterion-text"></p>`;
    article.querySelector("p").textContent = text;
    return article;
  }));
  renderLessonRows(plan);
  renderUnitHoursTotal();
}

function populatePlanUnits(preferredUnit) {
  const subject = planSubjectData();
  const hasPresets = subject.majorSections.length > 0;
  planUnit.hidden = !hasPresets;
  planCustomUnit.hidden = hasPresets;
  planUnit.replaceChildren(...subject.majorSections.map(({ majorSection, units }) => {
    const group = document.createElement("optgroup");
    group.label = majorSection;
    group.replaceChildren(...units.map(({ id, unit }) => new Option(unit, id)));
    return group;
  }));
  if (preferredUnit && planUnits().some(({ id }) => id === preferredUnit)) planUnit.value = preferredUnit;
  renderUnitPlan();
}

function populatePlanCourses(preferredCourse, preferredUnit, preferredUnitName) {
  const courses = SCHOOL_COURSES[planSchool.value];
  planSubject.replaceChildren(...Object.entries(courses).map(([id, course]) => new Option(course.name, id)));
  if (preferredCourse && courses[preferredCourse]) planSubject.value = preferredCourse;
  let remembered = {};
  if (!preferredUnit && !preferredUnitName) {
    try { remembered = JSON.parse(localStorage.getItem(`${PLAN_LAST_UNIT_PREFIX}${planSchool.value}__${planSubject.value}`)) || {}; }
    catch { /* Use the first preset or an empty manual unit. */ }
  }
  planCustomUnit.value = preferredUnitName || remembered.unitName || "";
  populatePlanUnits(preferredUnit || remembered.unitId);
}

function migrateUnitPlanData() {
  const mappings = { "physics-basics": ["sanno", "physicsBasic"], physics: ["santo", "physics"] };
  for (const subject of SUBJECTS) {
    const [schoolId, courseId] = mappings[subject.subject];
    for (const unit of subject.majorSections.flatMap(({ units }) => units)) {
      const oldKey = `${LEGACY_PLAN_STORAGE_PREFIX}${subject.subject}__${unit.id}`;
      const newKey = `${PLAN_STORAGE_PREFIX}${schoolId}__${courseId}__${unit.id}`;
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, oldValue);
    }
  }
}

function initializeUnitPlan() {
  loadUserInfo();
  planSchool.replaceChildren(...Object.entries(SCHOOLS).map(([id, school]) => new Option(school.name, id)));
  try { migrateUnitPlanData(); } catch { /* Keep legacy data untouched when storage is unavailable. */ }
  let selection = {};
  try { selection = JSON.parse(localStorage.getItem(PLAN_SELECTION_KEY)) || {}; } catch { /* Use defaults. */ }
  if (!selection.schoolId) {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_PLAN_SELECTION_KEY)) || {};
      const mapped = { "physics-basics": ["sanno", "physicsBasic"], physics: ["santo", "physics"] }[legacy.subjectId];
      if (mapped) selection = { schoolId: mapped[0], courseId: mapped[1], unitId: legacy.unitId };
    } catch { /* Use defaults. */ }
  }
  planSchool.value = SCHOOL_COURSES[selection.schoolId] ? selection.schoolId : "sanno";
  populatePlanCourses(selection.courseId, selection.unitId, selection.unitName);
}

planSchool.addEventListener("change", () => populatePlanCourses());
planSubject.addEventListener("change", () => populatePlanCourses(planSubject.value));
planUnit.addEventListener("change", renderUnitPlan);
planCustomUnit.addEventListener("change", renderUnitPlan);
affiliationInput.addEventListener("input", saveUserInfo);
teacherNameInput.addEventListener("input", saveUserInfo);
allocatedHoursInput.addEventListener("change", () => {
  const oldPlan = currentPlan();
  oldPlan.allocatedHours = Math.max(1, Math.trunc(Number(allocatedHoursInput.value) || 1));
  oldPlan.rows = Array.from({ length: oldPlan.allocatedHours }, (_, index) => oldPlan.rows[index] || blankLesson(index + 1));
  allocatedHoursInput.value = oldPlan.allocatedHours;
  renderLessonRows(oldPlan);
  savePlan();
});
lessonRows.addEventListener("input", savePlan);
lessonRows.addEventListener("click", (event) => {
  const button = event.target.closest(".evaluation-toggle");
  if (!button) return;
  const next = evaluationValues[(evaluationValues.indexOf(button.dataset.value) + 1) % evaluationValues.length];
  button.dataset.value = next;
  button.textContent = evaluationMark(next);
  button.classList.toggle("summative", next === "summative");
  savePlan();
});

function unitPlanText() {
  const subject = planSubjectData();
  const unit = planUnitData();
  const plan = currentPlan();
  const goals = unitGoals(unit).map((text, index) => `（${index + 1}）\n${text}`).join("\n\n");
  const criteria = generatedCriteria(unit).map(({ heading, text }) => `${heading}：\n${text}`).join("\n\n");
  const lessons = plan.rows.map((row) => `${row.hour}時間目\n学習活動：\n${row.activity || "－"}\n\n知：${evaluationMark(row.evaluation.knowledge) || "－"}\n思：${evaluationMark(row.evaluation.thinking) || "－"}\n態：${evaluationMark(row.evaluation.attitude) || "－"}\n\n評価の観点及び方法：\n${row.method || "－"}`).join("\n\n---\n\n");
  const info = userInfo();
  const userInfoText = [info.affiliation && `所属：${info.affiliation}`, info.teacherName && `氏名：${info.teacherName}`].filter(Boolean);
  return `学校：${SCHOOLS[planSchool.value].name}\n${userInfoText.length ? `${userInfoText.join("\n")}\n` : ""}科目：${subject.name}\n単元名：${unit.unit}\n配当時数：${plan.allocatedHours}時間\n\n【単元の目標】\n\n${goals}\n\n【単元の評価規準】\n\n${criteria}\n\n【指導と評価の計画】\n\n${lessons}`;
}

const UNIT_PLAN_TEMPLATE_PATH = "public/templates/unit-plan-template.docx";

function wordTemplateData() {
  const subject = planSubjectData();
  const unit = planUnitData();
  const plan = currentPlan();
  const goals = unitGoals(unit);
  const criteria = generatedCriteria(unit);
  const info = userInfo();
  return {
    school: SCHOOLS[planSchool.value].name,
    affiliation: info.affiliation,
    teacherName: info.teacherName,
    subject: subject.name,
    unit: unit.unit,
    allocatedHours: plan.allocatedHours,
    goal1: goals[0] || "",
    goal2: goals[1] || "",
    goal3: goals[2] || "",
    criteriaKnowledge: criteria.find(({ key }) => key === "knowledge")?.text || "",
    criteriaThinking: criteria.find(({ key }) => key === "thinking")?.text || "",
    criteriaAttitude: criteria.find(({ key }) => key === "attitude")?.text || "",
    goals: goals.map((text, index) => ({ number: index + 1, text })),
    criteria: criteria.map(({ key, heading, text }) => ({ key, heading, text })),
    lessons: plan.rows.map((row) => ({
      hour: row.hour,
      activity: row.activity || "－",
      knowledge: evaluationMark(row.evaluation.knowledge) || "",
      thinking: evaluationMark(row.evaluation.thinking) || "",
      attitude: evaluationMark(row.evaluation.attitude) || "",
      method: row.method || "－"
    }))
  };
}

async function exportUnitPlanWord() {
  const button = document.querySelector("#export-unit-plan-word");
  button.disabled = true;
  try {
    const response = await fetch(UNIT_PLAN_TEMPLATE_PATH);
    if (!response.ok) throw new Error(`Template request failed: ${response.status}`);
    if (typeof PizZip === "undefined" || typeof docxtemplater === "undefined") {
      throw new Error("Word export libraries are unavailable");
    }
    const template = await response.arrayBuffer();
    const documentTemplate = new docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true
    });
    documentTemplate.render(wordTemplateData());
    const blob = documentTemplate.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${planSubjectData().name}_${planUnitData().unit}_単元指導計画.docx`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    showToast("Wordファイルを出力しました");
  } catch (error) {
    console.error("Word export failed", error);
    showToast("Wordテンプレートを読み込めませんでした", true);
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#copy-unit-plan").addEventListener("click", () => copyText(unitPlanText()));
document.querySelector("#export-unit-plan-word").addEventListener("click", exportUnitPlanWord);
document.querySelector("#reset-unit-plan").addEventListener("click", () => {
  if (!window.confirm("この単元の入力内容をリセットしますか？ほかの単元のデータは削除されません。")) return;
  localStorage.removeItem(planStorageKey());
  renderUnitPlan();
});

const EVENTS_SELECTION_KEY = "rika-annual-events-selection-v1";
const eventsSchool = document.querySelector("#events-school");
const eventsYear = document.querySelector("#events-year");
const eventForm = document.querySelector("#event-form");
const eventStartDate = document.querySelector("#event-start-date");
const eventEndDate = document.querySelector("#event-end-date");
const eventTitle = document.querySelector("#event-title");
const eventCategory = document.querySelector("#event-category");
const eventClassesAvailable = document.querySelector("#event-classes-available");
const eventMemo = document.querySelector("#event-memo");
const eventSubmit = document.querySelector("#event-submit");
const eventCancel = document.querySelector("#event-cancel");
const eventsTableBody = document.querySelector("#events-table-body");
const eventsEmpty = document.querySelector("#events-empty");
const addNationalHolidaysButton = document.querySelector("#add-national-holidays");
const holidayAddMessage = document.querySelector("#holiday-add-message");
const scheduleSubject = document.querySelector("#schedule-subject");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleDay = document.querySelector("#schedule-day");
const schedulePeriod = document.querySelector("#schedule-period");
const scheduleList = document.querySelector("#schedule-list");
const scheduleEmpty = document.querySelector("#schedule-empty");
const scheduleMessage = document.querySelector("#schedule-message");
const scheduleWeeklyHours = document.querySelector("#schedule-weekly-hours strong");
const projectionTableBody = document.querySelector("#projection-table-body");
const projectionEmpty = document.querySelector("#projection-empty");
let editingEventId = null;

function selectedEventsYear() {
  return Math.min(2100, Math.max(2000, Math.trunc(Number(eventsYear.value) || new Date().getFullYear())));
}

function loadAnnualEvents() {
  try {
    const saved = JSON.parse(localStorage.getItem(annualEventsStorageKey(eventsSchool.value, selectedEventsYear())));
    return Array.isArray(saved) ? sortAnnualEvents(saved) : [];
  } catch {
    return [];
  }
}

function saveAnnualEvents(events) {
  try {
    localStorage.setItem(annualEventsStorageKey(eventsSchool.value, selectedEventsYear()), JSON.stringify(sortAnnualEvents(events)));
    localStorage.setItem(EVENTS_SELECTION_KEY, JSON.stringify({ schoolId: eventsSchool.value, year: selectedEventsYear() }));
  } catch { /* Storage may be disabled by the browser. */ }
}

function scheduleStorageKey() {
  return regularScheduleStorageKey(eventsSchool.value, selectedEventsYear(), scheduleSubject.value);
}

function loadRegularSchedule() {
  try { return normalizeRegularSchedule(JSON.parse(localStorage.getItem(scheduleStorageKey()))); }
  catch { return []; }
}

function saveRegularSchedule(slots) {
  try { localStorage.setItem(scheduleStorageKey(), JSON.stringify(normalizeRegularSchedule(slots))); }
  catch { /* Storage may be disabled by the browser. */ }
}

function renderRegularSchedule() {
  const slots = loadRegularSchedule();
  scheduleWeeklyHours.textContent = `${slots.length}時間`;
  scheduleEmpty.hidden = slots.length > 0;
  scheduleList.replaceChildren(...slots.map((slot) => {
    const day = REGULAR_SCHEDULE_DAYS.find(({ id }) => id === slot.dayOfWeek);
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${day.label}　${slot.period}限`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "削除";
    button.dataset.day = slot.dayOfWeek;
    button.dataset.period = slot.period;
    item.append(label, button);
    return item;
  }));
  renderScheduleProjection();
}

function renderScheduleProjection() {
  const projection = calculateScheduleProjection(selectedEventsYear(), loadRegularSchedule(), loadAnnualEvents());
  document.querySelector("#projection-planned").textContent = `${projection.plannedCount}時間`;
  document.querySelector("#projection-excluded").textContent = `${projection.excludedCount}時間`;
  document.querySelector("#projection-available").textContent = `${projection.availableCount}時間`;
  projectionTableBody.replaceChildren(...projection.excludedSessions.map((session) => {
    const row = document.createElement("tr");
    [formatEventDateRange(session.date), session.weekday, `${session.period}限`, session.eventTitles.join("／")].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  projectionEmpty.hidden = projection.excludedSessions.length > 0;
}

function populateScheduleSubjects(preferredCourseId) {
  const courses = SCHOOL_COURSES[eventsSchool.value] || {};
  scheduleSubject.replaceChildren(...Object.entries(courses).map(([id, course]) => new Option(course.name, id)));
  if (preferredCourseId && courses[preferredCourseId]) scheduleSubject.value = preferredCourseId;
  scheduleMessage.textContent = "";
  renderRegularSchedule();
}

function resetEventForm() {
  editingEventId = null;
  eventForm.reset();
  eventEndDate.setCustomValidity("");
  eventSubmit.textContent = "行事を追加";
  eventCancel.hidden = true;
  document.querySelector("#event-form-heading").textContent = "行事を追加";
}

function createEventRow(item) {
  const row = document.createElement("tr");
  const values = [
    formatEventDateRange(item.startDate, item.endDate),
    annualEventDisplayTitle(item),
    ANNUAL_EVENT_CATEGORIES[item.category],
    item.regularClassesAvailable ? "実施できる" : "実施できない",
    item.memo || "－"
  ];
  values.forEach((value, index) => {
    const cell = document.createElement(index === 1 ? "th" : "td");
    if (index === 1) cell.scope = "row";
    cell.textContent = value;
    if (index === 2) cell.className = `event-category category-${item.category}`;
    if (index === 3) cell.className = item.regularClassesAvailable ? "classes-available" : "classes-unavailable";
    row.append(cell);
  });
  const actions = document.createElement("td");
  actions.className = "event-row-actions";
  actions.innerHTML = `<button type="button" data-action="edit">編集</button><button type="button" data-action="delete">削除</button>`;
  actions.querySelectorAll("button").forEach((button) => { button.dataset.id = item.id; });
  row.append(actions);
  return row;
}

function renderAnnualEvents() {
  const year = selectedEventsYear();
  eventsYear.value = year;
  const events = loadAnnualEvents();
  eventsTableBody.replaceChildren(...events.map(createEventRow));
  eventsEmpty.hidden = events.length > 0;
  document.querySelector("#events-list-description").textContent = `${SCHOOLS[eventsSchool.value].name}・${year}年度（${events.length}件）を日付順に表示しています。`;
  renderScheduleProjection();
}

function changeEventsContext() {
  resetEventForm();
  holidayAddMessage.textContent = "";
  saveAnnualEvents(loadAnnualEvents());
  populateScheduleSubjects(scheduleSubject.value);
  renderAnnualEvents();
}

function editAnnualEvent(id) {
  const item = loadAnnualEvents().find((event) => event.id === id);
  if (!item) return;
  editingEventId = item.id;
  eventStartDate.value = item.startDate;
  eventEndDate.value = item.endDate === item.startDate ? "" : item.endDate;
  eventTitle.value = item.title;
  eventCategory.value = item.category;
  eventClassesAvailable.checked = item.regularClassesAvailable;
  eventMemo.value = item.memo;
  eventSubmit.textContent = "変更を保存";
  eventCancel.hidden = false;
  document.querySelector("#event-form-heading").textContent = "行事を編集";
  eventForm.scrollIntoView({ behavior: "smooth", block: "center" });
  eventTitle.focus({ preventScroll: true });
}

function annualEventId() {
  return globalThis.crypto?.randomUUID?.() || `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initializeAnnualEvents() {
  eventsSchool.replaceChildren(...Object.entries(SCHOOLS).map(([id, school]) => new Option(school.name, id)));
  eventCategory.replaceChildren(...Object.entries(ANNUAL_EVENT_CATEGORIES).map(([id, name]) => new Option(name, id)));
  let selection = {};
  try { selection = JSON.parse(localStorage.getItem(EVENTS_SELECTION_KEY)) || {}; } catch { /* Use defaults. */ }
  eventsSchool.value = SCHOOLS[selection.schoolId] ? selection.schoolId : "sanno";
  eventsYear.value = Number.isInteger(selection.year) ? selection.year : new Date().getFullYear();
  scheduleDay.replaceChildren(...REGULAR_SCHEDULE_DAYS.map(({ id, label }) => new Option(label, id)));
  schedulePeriod.replaceChildren(...Array.from({ length: 7 }, (_, index) => new Option(`${index + 1}限`, String(index + 1))));
  populateScheduleSubjects();
  renderAnnualEvents();
}

eventsSchool.addEventListener("change", changeEventsContext);
eventsYear.addEventListener("change", changeEventsContext);
addNationalHolidaysButton.addEventListener("click", () => {
  const year = selectedEventsYear();
  eventsYear.value = year;
  if (!hasNationalHolidayDataForSchoolYear(year)) {
    holidayAddMessage.textContent = `${year}年度の祝日データはまだ収録されていません。`;
    showToast("選択年度の祝日データはまだ収録されていません", true);
    return;
  }
  if (!window.confirm(`${year}年度（${year}年4月1日～${year + 1}年3月31日）の国民の祝日・休日を一括追加します。`)) return;
  const result = addMissingNationalHolidays(loadAnnualEvents(), year);
  saveAnnualEvents(result.events);
  renderAnnualEvents();
  holidayAddMessage.textContent = result.skippedCount
    ? `${result.addedCount}件追加、${result.skippedCount}件は登録済みのためスキップしました`
    : `${result.addedCount}件追加しました`;
  showToast(holidayAddMessage.textContent);
});
eventCancel.addEventListener("click", resetEventForm);
scheduleSubject.addEventListener("change", () => {
  scheduleMessage.textContent = "";
  renderRegularSchedule();
});
scheduleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const slots = loadRegularSchedule();
  const candidate = { dayOfWeek: scheduleDay.value, period: Number(schedulePeriod.value) };
  if (hasRegularScheduleSlot(slots, candidate)) {
    scheduleMessage.textContent = "この授業コマはすでに登録されています";
    scheduleMessage.classList.add("error");
    return;
  }
  saveRegularSchedule([...slots, candidate]);
  scheduleMessage.textContent = "授業コマを追加しました";
  scheduleMessage.classList.remove("error");
  renderRegularSchedule();
});
scheduleList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  saveRegularSchedule(loadRegularSchedule().filter(({ dayOfWeek, period }) =>
    dayOfWeek !== button.dataset.day || period !== Number(button.dataset.period)
  ));
  scheduleMessage.textContent = "授業コマを削除しました";
  scheduleMessage.classList.remove("error");
  renderRegularSchedule();
});
eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  eventEndDate.setCustomValidity(eventEndDate.value && eventEndDate.value < eventStartDate.value ? "終了日は開始日以降の日付を指定してください。" : "");
  if (!eventForm.reportValidity()) return;
  const item = normalizeAnnualEvent({
    id: editingEventId || annualEventId(),
    startDate: eventStartDate.value,
    endDate: eventEndDate.value,
    title: eventTitle.value.trim(),
    category: eventCategory.value,
    regularClassesAvailable: eventClassesAvailable.checked,
    memo: eventMemo.value.trim()
  });
  const events = loadAnnualEvents();
  const existingIndex = events.findIndex(({ id }) => id === editingEventId);
  if (existingIndex >= 0) events[existingIndex] = item;
  else events.push(item);
  saveAnnualEvents(events);
  resetEventForm();
  renderAnnualEvents();
  showToast(existingIndex >= 0 ? "行事を更新しました" : "行事を追加しました");
});
function validateEventDateRange() {
  eventEndDate.setCustomValidity(eventEndDate.value && eventEndDate.value < eventStartDate.value ? "終了日は開始日以降の日付を指定してください。" : "");
}

eventStartDate.addEventListener("change", () => {
  if (eventStartDate.value && !eventEndDate.value) eventEndDate.value = eventStartDate.value;
  validateEventDateRange();
});
eventEndDate.addEventListener("input", validateEventDateRange);
eventsTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") {
    editAnnualEvent(button.dataset.id);
    return;
  }
  const item = loadAnnualEvents().find(({ id }) => id === button.dataset.id);
  if (!item || !window.confirm(`「${annualEventDisplayTitle(item)}」を削除しますか？`)) return;
  saveAnnualEvents(loadAnnualEvents().filter(({ id }) => id !== item.id));
  if (editingEventId === item.id) resetEventForm();
  renderAnnualEvents();
  showToast("行事を削除しました");
});

initializeUnitPlan();
populateSubjects();
initializeAnnual();
initializeAnnualEvents();
