'use strict';

const documentPages = document.getElementById('pages');
const pageLinks = document.getElementById('page-links');
const toggleAll = document.getElementById('toggle-all');
const error = document.getElementById('error');
const storageKey = 'seikei-redsheet-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch {}
const openIds = new Set(Array.isArray(saved.open) ? saved.open : []);
const pages = [];
const answers = new Map();
let activePage = 0;

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ open: [...openIds], page: activePage }));
  } catch {}
}

function position(node, [x, y, width, height]) {
  Object.assign(node.style, {
    left: x / 595.28 * 100 + '%', top: y / 841.89 * 100 + '%',
    width: width / 595.28 * 100 + '%', height: height / 841.89 * 100 + '%',
  });
}

function showAnswer(answer) {
  const { field, buttons, marks } = answer;
  const revealed = openIds.has(field.id);
  buttons.forEach((button, index) => {
    button.classList.toggle('revealed', revealed);
    button.setAttribute('aria-pressed', String(revealed));
    button.setAttribute('aria-label', revealed
      ? '答え「' + field.value + '」を隠す'
      : field.context + ' の答えを表示');
    if (field.kind === 'write') {
      button.textContent = revealed ? answer.values[index] : '';
    }
  });
  marks.forEach(mark => { mark.hidden = !revealed; });
}

function updateToggle() {
  toggleAll.textContent = openIds.size === answers.size ? 'すべて隠す' : 'すべて表示';
}

function flip(id) {
  if (openIds.has(id)) openIds.delete(id);
  else openIds.add(id);
  showAnswer(answers.get(id));
  updateToggle();
  persist();
}

function buildPage(data, index) {
  const n = index + 1;
  const paper = document.createElement('section');
  paper.className = 'paper';
  paper.id = 'p' + n;
  paper.setAttribute('aria-label', data.label + ' ' + data.title);
  const image = document.createElement('img');
  image.alt = data.label + ' ' + data.title + 'の紙面';
  image.width = 595;
  image.height = 842;
  image.loading = n === 1 ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.src = 'pages/' + String(n).padStart(2, '0') + '.svg';

  const fields = document.createElement('div');
  fields.className = 'fields';
  for (const field of data.fields) {
    const values = field.id === '12-20' ? ['高', '強'] : field.boxes.map(() => field.value);
    const buttons = field.boxes.map((box, part) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'field ' + field.kind;
      button.dataset.answer = field.id;
      position(button, box);
      if (field.kind === 'write') {
        const ems = Array.from(values[part]).reduce((sum, c) => sum + (/[ -~]/.test(c) ? .59 : 1), 0);
        button.style.fontSize = Math.min(10.5, box[3] * .9, (box[2] - .5) / ems) / 595.28 * 100 + 'cqw';
      }
      fields.append(button);
      return button;
    });
    const marks = field.marks.map(box => {
      const mark = document.createElement('span');
      mark.className = 'mark';
      position(mark, box);
      fields.append(mark);
      return mark;
    });
    const answer = { field, buttons, marks, values };
    answers.set(field.id, answer);
    showAnswer(answer);
  }
  paper.append(image, fields);

  const link = document.createElement('a');
  link.href = '#p' + n;
  link.textContent = n;
  link.setAttribute('aria-label', n + 'ページ ' + data.title);
  pages.push({ paper, link });
  pageLinks.append(link);
  documentPages.append(paper);
}

function trackPage() {
  const readingLine = document.querySelector('.toolbar').getBoundingClientRect().bottom + 8;
  const n = pages.findIndex(({ paper }) => paper.getBoundingClientRect().bottom > readingLine) + 1;
  if (!n || n === activePage) return;
  pages[activePage - 1]?.link.removeAttribute('aria-current');
  activePage = n;
  const { link } = pages[n - 1];
  link.setAttribute('aria-current', 'page');
  const buttonBox = link.getBoundingClientRect();
  const navBox = pageLinks.getBoundingClientRect();
  if (buttonBox.left < navBox.left || buttonBox.right > navBox.right) {
    pageLinks.scrollLeft += buttonBox.left - navBox.left - (navBox.width - buttonBox.width) / 2;
  }
  persist();
}

let scrollFrame = 0;
window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    trackPage();
  });
}, { passive: true });

documentPages.addEventListener('click', event => {
  const button = event.target.closest('button[data-answer]');
  if (button) { flip(button.dataset.answer); return; }
  const fields = event.target.closest('.fields');
  if (!fields || !matchMedia('(pointer: coarse)').matches) return;
  let nearest;
  let distance = 8;
  for (const candidate of fields.querySelectorAll('button')) {
    const rect = candidate.getBoundingClientRect();
    const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
    const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
    const gap = Math.hypot(dx, dy);
    if (gap < distance) { nearest = candidate; distance = gap; }
  }
  if (nearest) flip(nearest.dataset.answer);
});

toggleAll.addEventListener('click', () => {
  const hide = openIds.size === answers.size;
  openIds.clear();
  for (const [id, answer] of answers) {
    if (!hide) openIds.add(id);
    showAnswer(answer);
  }
  updateToggle();
  persist();
});
error.querySelector('button').addEventListener('click', () => location.reload());

async function start() {
  const response = await fetch('pages.json');
  if (!response.ok) throw Error('Pages unavailable');
  const data = await response.json();
  data.forEach(buildPage);
  for (const id of openIds) if (!answers.has(id)) openIds.delete(id);
  toggleAll.disabled = !answers.size;
  updateToggle();
  const n = Number(location.hash.match(/^#p(\d+)$/)?.[1] || saved.page || 1);
  if (n > 1) pages[n - 1]?.paper.scrollIntoView();
  trackPage();
}
start().catch(() => { error.hidden = false; });
