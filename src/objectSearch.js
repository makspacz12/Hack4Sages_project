/**
 * objectSearch.js
 * Searchable side-panel listing every simulation object.
 * Pure logic lives in objectSearchLogic.js; this file handles DOM only.
 */

import { getTypeMeta, sortNodesByType, matchesQuery } from './objectSearchLogic.js';

// ── Styles ───────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('obj-search-style')) return;
  const s = document.createElement('style');
  s.id = 'obj-search-style';
  s.textContent = `
    #obj-search-panel {
      position: fixed;
      top: 52px; right: 300px;
      width: 240px;
      max-height: calc(100vh - 120px);
      background: rgba(8,10,20,0.92);
      border: 1px solid #2a3450;
      border-radius: 8px;
      display: flex; flex-direction: column;
      font-family: monospace; font-size: 13px; color: #ccc;
      z-index: 800;
      box-shadow: 0 4px 24px #0008;
      transition: opacity .2s;
    }
    #obj-search-panel.osp-hidden { opacity: 0; pointer-events: none; }
    #obj-search-panel .osp-header {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px 5px;
      border-bottom: 1px solid #1e2840;
    }
    #obj-search-panel .osp-header span {
      font-size: 11px; color: #778; text-transform: uppercase; letter-spacing: .05em;
      flex: 1;
    }
    #obj-search-panel .osp-close {
      background: none; border: none; color: #556; cursor: pointer;
      font-size: 16px; line-height: 1; padding: 0 2px;
    }
    #obj-search-panel .osp-close:hover { color: #aaa; }
    #obj-search-panel .osp-input {
      margin: 7px 10px 5px;
      background: #0e1220; border: 1px solid #2a3450;
      border-radius: 5px; color: #ddf; padding: 5px 8px;
      font-family: monospace; font-size: 13px; outline: none;
      width: calc(100% - 36px);
    }
    #obj-search-panel .osp-input:focus { border-color: #5af; }
    #obj-search-panel .osp-count {
      font-size: 11px; color: #556; padding: 0 12px 4px; text-align: right;
    }
    #obj-search-panel .osp-list {
      overflow-y: auto; flex: 1;
      padding: 2px 0 8px;
    }
    #obj-search-panel .osp-list::-webkit-scrollbar { width: 5px; }
    #obj-search-panel .osp-list::-webkit-scrollbar-thumb { background: #2a3450; border-radius: 3px; }
    #obj-search-panel .osp-item {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 12px;
      cursor: pointer; border-left: 3px solid transparent;
      transition: background .1s;
    }
    #obj-search-panel .osp-item:hover { background: #151c30; }
    #obj-search-panel .osp-item.osp-active {
      background: #0e1828;
      border-left-color: #5af;
    }
    #obj-search-panel .osp-icon { font-size: 15px; width: 16px; text-align: center; flex-shrink: 0; }
    #obj-search-panel .osp-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #obj-search-panel .osp-type { font-size: 11px; color: #556; flex-shrink: 0; }

    #obj-search-toggle {
      position: fixed;
      top: 14px; right: 300px;
      background: rgba(10,14,26,0.90);
      border: 1px solid #2a3450;
      border-radius: 6px;
      color: #aac; font-family: monospace; font-size: 13px;
      padding: 5px 12px; cursor: pointer; z-index: 900;
    }
    #obj-search-toggle:hover { background: #151c30; }
  `;
  document.head.appendChild(s);
}

/**
 * Create the searchable object panel.
 *
 * @param {Array<{body, mesh}>}  nodes    scene nodes (from mainReplay)
 * @param {object}               simData  parsed simulation JSON
 * @param {Function}             onSelect called with (node, simObj) on click
 * @returns {{ mount, remove, setActive }}
 */
export function createObjectSearch(nodes, simData, onSelect) {
  injectStyles();

  const objById = new Map((simData.objects ?? []).map(o => [o.id, o]));

  const sorted = sortNodesByType(nodes);

  // ── DOM ──────────────────────────────────────────────────────────────
  let activeId  = null;
  let visible   = false;
  let listItems = [];   // { el, node, simObj, nameLower }

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id          = 'obj-search-toggle';
  toggleBtn.textContent = '☰ Objects';
  toggleBtn.addEventListener('click', () => setVisible(!visible));

  // Panel
  const panel = document.createElement('div');
  panel.id        = 'obj-search-panel';
  panel.className = 'osp-hidden';

  // Header
  const header  = document.createElement('div');
  header.className = 'osp-header';
  const title = document.createElement('span');
  title.textContent = 'Select object';
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'osp-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => setVisible(false));
  header.append(title, closeBtn);

  // Search input
  const input = document.createElement('input');
  input.className   = 'osp-input';
  input.placeholder = 'Search…';
  input.addEventListener('input', () => filterList(input.value));
  input.addEventListener('keydown', e => {
    e.stopPropagation();  // don't let replay key handlers catch Space/arrows
    if (e.key === 'Escape') setVisible(false);
    if (e.key === 'Enter') {
      const first = listItems.find(it => it.el.style.display !== 'none');
      if (first) selectItem(first);
    }
  });

  // Count label
  const countLbl = document.createElement('div');
  countLbl.className = 'osp-count';

  // List container
  const list = document.createElement('div');
  list.className = 'osp-list';

  // Build items
  for (const node of sorted) {
    const simObj = objById.get(node.body.id);
    const meta   = getTypeMeta(node.body.type);
    const name   = node.body.name ?? node.body.id;

    const item    = document.createElement('div');
    item.className = 'osp-item';

    const icon = document.createElement('span');
    icon.className   = 'osp-icon';
    icon.textContent = meta.icon;
    icon.style.color = meta.color;

    const nameEl = document.createElement('span');
    nameEl.className   = 'osp-name';
    nameEl.textContent = name;

    const typeEl = document.createElement('span');
    typeEl.className   = 'osp-type';
    typeEl.textContent = (node.body.type ?? '').toLowerCase();

    item.append(icon, nameEl, typeEl);
    item.addEventListener('click', () => selectItem({ el: item, node, simObj, nameLower: name.toLowerCase(), type: node.body.type, id: node.body.id }));

    list.appendChild(item);
    listItems.push({ el: item, node, simObj, nameLower: name.toLowerCase(), type: node.body.type, id: node.body.id });
  }

  panel.append(header, input, countLbl, list);

  // ── Helpers ───────────────────────────────────────────────────────────
  function updateCount(shown) {
    countLbl.textContent = `${shown} / ${listItems.length} objects`;
  }

  function filterList(query) {
    let shown = 0;
    for (const it of listItems) {
      const match = matchesQuery(it, query);
      it.el.style.display = match ? '' : 'none';
      if (match) shown++;
    }
    updateCount(shown);
  }

  function selectItem({ el, node, simObj }) {
    // Clear previous active style
    if (activeId) {
      const prev = listItems.find(it => it.node.body.id === activeId);
      if (prev) prev.el.classList.remove('osp-active');
    }
    el.classList.add('osp-active');
    activeId = node.body.id;
    onSelect(node, simObj);
  }

  function setVisible(val) {
    visible = val;
    panel.classList.toggle('osp-hidden', !val);
    if (val) {
      input.focus();
      input.select();
    }
  }

  // ── Public API ────────────────────────────────────────────────────────
  function mount() {
    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);
    updateCount(listItems.length);
  }

  function remove() {
    toggleBtn.remove();
    panel.remove();
  }

  /** Mark an item as active from outside (e.g. click on mesh). */
  function setActive(id) {
    if (activeId === id) return;
    if (activeId) {
      const prev = listItems.find(it => it.node.body.id === activeId);
      if (prev) prev.el.classList.remove('osp-active');
    }
    activeId = id;
    const cur = listItems.find(it => it.node.body.id === id);
    if (cur) {
      cur.el.classList.add('osp-active');
      cur.el.scrollIntoView({ block: 'nearest' });
    }
  }

  return { mount, remove, setActive };
}
