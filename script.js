"use strict";

const SUBJECTS = [
  {
    subject: "physics-basics",
    name: "物理基礎",
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
const criteriaGrid = document.querySelector("#criteria-grid");
const copyAllButton = document.querySelector("#copy-all");
const toast = document.querySelector("#toast");
let toastTimer;

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
