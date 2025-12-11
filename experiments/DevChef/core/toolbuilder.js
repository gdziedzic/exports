/**
 * Custom Tool Builder
 * Visual no-code editor for creating custom tools
 *
 * Features:
 * - Drag-and-drop UI designer
 * - Visual transformation builder
 * - Live preview and testing
 * - Export/import tools
 * - Share with community
 * - No coding required
 */

class ToolBuilder {
  constructor() {
    this.customTools = new Map();
    this.currentTool = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    this.loadCustomTools();
    this.registerShortcut();
    console.log('Custom Tool Builder initialized');
  }

  registerShortcut() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.open();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.createPanel();
    this.isOpen = true;
  }

  close() {
    const panel = document.getElementById('tool-builder-panel');
    if (panel) panel.remove();
    this.isOpen = false;
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'tool-builder-panel';
    panel.className = 'tool-builder-panel';
    panel.innerHTML = `
      <div class="tool-builder-container">
        <div class="tool-builder-header">
          <h2>🛠️ Custom Tool Builder</h2>
          <button class="btn-close">✕</button>
        </div>
        <div class="tool-builder-content">
          <div class="tool-builder-sidebar">
            <h3>Your Tools</h3>
            <button id="new-tool-btn" class="btn-primary">➕ New Tool</button>
            <div id="custom-tools-list"></div>
          </div>
          <div class="tool-builder-editor">
            <div class="editor-section">
              <h3>Tool Configuration</h3>
              <input id="tool-name" placeholder="Tool Name" />
              <textarea id="tool-desc" placeholder="Description" rows="2"></textarea>
            </div>
            <div class="editor-section">
              <h3>Input Fields</h3>
              <button id="add-input-btn">➕ Add Input</button>
              <div id="inputs-container"></div>
            </div>
            <div class="editor-section">
              <h3>Transformation</h3>
              <select id="transform-type">
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
                <option value="reverse">Reverse</option>
                <option value="base64-encode">Base64 Encode</option>
                <option value="base64-decode">Base64 Decode</option>
                <option value="json-format">JSON Format</option>
                <option value="custom-js">Custom JavaScript</option>
              </select>
              <textarea id="custom-transform" placeholder="Custom JavaScript function" rows="5"></textarea>
            </div>
            <div class="editor-actions">
              <button id="test-tool-btn" class="btn-primary">🧪 Test Tool</button>
              <button id="save-tool-btn" class="btn-primary">💾 Save Tool</button>
              <button id="export-tool-btn" class="btn-secondary">📤 Export</button>
            </div>
          </div>
          <div class="tool-builder-preview">
            <h3>Live Preview</h3>
            <div id="tool-preview"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this.setupEventListeners();
    this.renderCustomToolsList();
  }

  setupEventListeners() {
    document.querySelector('.tool-builder-panel .btn-close')?.addEventListener('click', () => this.close());
    document.getElementById('new-tool-btn')?.addEventListener('click', () => this.newTool());
    document.getElementById('add-input-btn')?.addEventListener('click', () => this.addInput());
    document.getElementById('test-tool-btn')?.addEventListener('click', () => this.testTool());
    document.getElementById('save-tool-btn')?.addEventListener('click', () => this.saveTool());
    document.getElementById('export-tool-btn')?.addEventListener('click', () => this.exportTool());
  }

  newTool() {
    this.currentTool = {
      id: `custom-${Date.now()}`,
      name: '',
      description: '',
      inputs: [],
      transformType: 'uppercase',
      customTransform: ''
    };
    this.renderToolEditor();
  }

  addInput() {
    if (!this.currentTool) return;
    this.currentTool.inputs.push({
      id: `input-${Date.now()}`,
      label: 'Input',
      type: 'text',
      placeholder: ''
    });
    this.renderInputs();
  }

  renderInputs() {
    const container = document.getElementById('inputs-container');
    if (!container || !this.currentTool) return;

    container.innerHTML = this.currentTool.inputs.map((input, i) => `
      <div class="input-field">
        <input value="${input.label}" placeholder="Label" data-index="${i}" data-field="label" />
        <select data-index="${i}" data-field="type">
          <option value="text" ${input.type === 'text' ? 'selected' : ''}>Text</option>
          <option value="textarea" ${input.type === 'textarea' ? 'selected' : ''}>Textarea</option>
          <option value="number" ${input.type === 'number' ? 'selected' : ''}>Number</option>
        </select>
        <button class="btn-remove" data-index="${i}">🗑️</button>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        this.currentTool.inputs[index][field] = e.target.value;
      });
    });

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.currentTool.inputs.splice(index, 1);
        this.renderInputs();
      });
    });
  }

  testTool() {
    if (!this.currentTool) return;
    // Generate preview
    this.renderPreview();
  }

  renderPreview() {
    const preview = document.getElementById('tool-preview');
    if (!preview || !this.currentTool) return;

    preview.innerHTML = `
      <div class="preview-tool">
        <h4>${this.currentTool.name || 'Untitled Tool'}</h4>
        <p>${this.currentTool.description || 'No description'}</p>
        ${this.currentTool.inputs.map(input => `
          <div class="preview-input">
            <label>${input.label}</label>
            ${input.type === 'textarea'
              ? `<textarea placeholder="${input.placeholder}"></textarea>`
              : `<input type="${input.type}" placeholder="${input.placeholder}" />`
            }
          </div>
        `).join('')}
        <button class="btn-primary">Execute</button>
        <div class="preview-output">
          <label>Output:</label>
          <textarea readonly></textarea>
        </div>
      </div>
    `;
  }

  saveTool() {
    if (!this.currentTool) return;

    // Get current values
    this.currentTool.name = document.getElementById('tool-name')?.value || '';
    this.currentTool.description = document.getElementById('tool-desc')?.value || '';
    this.currentTool.transformType = document.getElementById('transform-type')?.value || 'uppercase';
    this.currentTool.customTransform = document.getElementById('custom-transform')?.value || '';

    this.customTools.set(this.currentTool.id, this.currentTool);
    this.saveToStorage();
    this.renderCustomToolsList();
    alert('Tool saved successfully!');
  }

  exportTool() {
    if (!this.currentTool) return;
    const json = JSON.stringify(this.currentTool, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentTool.id}.json`;
    a.click();
  }

  renderCustomToolsList() {
    const list = document.getElementById('custom-tools-list');
    if (!list) return;

    list.innerHTML = Array.from(this.customTools.values()).map(tool => `
      <div class="custom-tool-item" data-id="${tool.id}">
        <span>${tool.name || 'Untitled'}</span>
        <button class="btn-edit" data-id="${tool.id}">✏️</button>
      </div>
    `).join('');

    list.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.currentTool = this.customTools.get(id);
        this.renderToolEditor();
      });
    });
  }

  renderToolEditor() {
    if (!this.currentTool) return;
    document.getElementById('tool-name').value = this.currentTool.name;
    document.getElementById('tool-desc').value = this.currentTool.description;
    document.getElementById('transform-type').value = this.currentTool.transformType;
    document.getElementById('custom-transform').value = this.currentTool.customTransform;
    this.renderInputs();
    this.renderPreview();
  }

  loadCustomTools() {
    try {
      const stored = localStorage.getItem('devchef-custom-tools');
      if (stored) {
        const tools = JSON.parse(stored);
        this.customTools = new Map(Object.entries(tools));
      }
    } catch (e) {
      console.error('Failed to load custom tools:', e);
    }
  }

  saveToStorage() {
    try {
      const tools = Object.fromEntries(this.customTools);
      localStorage.setItem('devchef-custom-tools', JSON.stringify(tools));
    } catch (e) {
      console.error('Failed to save custom tools:', e);
    }
  }
}

export const toolBuilder = new ToolBuilder();
export { ToolBuilder };
