/**
 * DevChef V6.5 - Enhanced Snippet Manager
 * Advanced snippet features: variables, templates, quick-insert
 *
 * Features:
 * - Variable substitution {{variable}}
 * - Snippet templates with placeholders
 * - Quick-insert with keyboard shortcuts
 * - Multi-cursor snippet insertion
 * - Snippet collections/bundles
 * - Smart formatting preservation
 */

import { snippetManager } from './snippets.js';
import { storage } from './storage.js';

class SnippetsPlus {
  constructor() {
    this.templates = new Map();
    this.collections = [];
    this.quickInsertHistory = [];
    this.variables = new Map();
    this.maxHistorySize = 50;
    this.init();
  }

  /**
   * Initialize SnippetsPlus
   */
  init() {
    this.loadTemplates();
    this.loadCollections();
    this.loadVariables();
    this.setupDefaultTemplates();
    console.log('✨ SnippetsPlus initialized - Variable support, templates & quick-insert ready');
  }

  /**
   * Setup default templates
   */
  setupDefaultTemplates() {
    if (this.templates.size === 0) {
      // JavaScript templates
      this.addTemplate({
        id: 'js-function',
        name: 'JavaScript Function',
        category: 'JavaScript',
        language: 'javascript',
        content: `function {{functionName}}({{params}}) {
  {{body}}
  return {{returnValue}};
}`,
        variables: ['functionName', 'params', 'body', 'returnValue'],
        description: 'Basic JavaScript function template'
      });

      this.addTemplate({
        id: 'js-async-function',
        name: 'Async Function',
        category: 'JavaScript',
        language: 'javascript',
        content: `async function {{functionName}}({{params}}) {
  try {
    {{body}}
    return {{returnValue}};
  } catch (error) {
    console.error('Error in {{functionName}}:', error);
    throw error;
  }
}`,
        variables: ['functionName', 'params', 'body', 'returnValue'],
        description: 'Async function with error handling'
      });

      this.addTemplate({
        id: 'js-class',
        name: 'JavaScript Class',
        category: 'JavaScript',
        language: 'javascript',
        content: `class {{className}} {
  constructor({{constructorParams}}) {
    {{constructorBody}}
  }

  {{method}}({{methodParams}}) {
    {{methodBody}}
  }
}`,
        variables: ['className', 'constructorParams', 'constructorBody', 'method', 'methodParams', 'methodBody'],
        description: 'Basic JavaScript class template'
      });

      // React templates
      this.addTemplate({
        id: 'react-component',
        name: 'React Functional Component',
        category: 'React',
        language: 'javascript',
        content: `import React from 'react';

function {{componentName}}({{props}}) {
  return (
    <div className="{{className}}">
      {{content}}
    </div>
  );
}

export default {{componentName}};`,
        variables: ['componentName', 'props', 'className', 'content'],
        description: 'React functional component template'
      });

      this.addTemplate({
        id: 'react-hook',
        name: 'React Custom Hook',
        category: 'React',
        language: 'javascript',
        content: `import { useState, useEffect } from 'react';

export function {{hookName}}({{params}}) {
  const [{{state}}, set{{capitalizedState}}] = useState({{initialValue}});

  useEffect(() => {
    {{effect}}
  }, [{{dependencies}}]);

  return {{returnValue}};
}`,
        variables: ['hookName', 'params', 'state', 'capitalizedState', 'initialValue', 'effect', 'dependencies', 'returnValue'],
        description: 'Custom React hook template'
      });

      // TypeScript templates
      this.addTemplate({
        id: 'ts-interface',
        name: 'TypeScript Interface',
        category: 'TypeScript',
        language: 'typescript',
        content: `export interface {{interfaceName}} {
  {{properties}}
}`,
        variables: ['interfaceName', 'properties'],
        description: 'TypeScript interface template'
      });

      // CSS templates
      this.addTemplate({
        id: 'css-flexbox',
        name: 'Flexbox Container',
        category: 'CSS',
        language: 'css',
        content: `.{{className}} {
  display: flex;
  flex-direction: {{direction}};
  justify-content: {{justifyContent}};
  align-items: {{alignItems}};
  gap: {{gap}};
}`,
        variables: ['className', 'direction', 'justifyContent', 'alignItems', 'gap'],
        description: 'Flexbox container template'
      });

      // HTML templates
      this.addTemplate({
        id: 'html-form',
        name: 'HTML Form',
        category: 'HTML',
        language: 'html',
        content: `<form id="{{formId}}" class="{{className}}">
  {{formFields}}
  <button type="submit">{{submitText}}</button>
</form>`,
        variables: ['formId', 'className', 'formFields', 'submitText'],
        description: 'Basic HTML form template'
      });

      this.saveTemplates();
    }
  }

  /**
   * Add template
   */
  addTemplate(template) {
    this.templates.set(template.id, template);
  }

  /**
   * Load templates from storage
   */
  loadTemplates() {
    const saved = storage.get('devchef-snippets-plus-templates');
    if (saved) {
      this.templates = new Map(Object.entries(saved));
    }
  }

  /**
   * Save templates to storage
   */
  saveTemplates() {
    const templatesObj = Object.fromEntries(this.templates);
    storage.set('devchef-snippets-plus-templates', templatesObj);
  }

  /**
   * Load collections from storage
   */
  loadCollections() {
    const saved = storage.get('devchef-snippets-plus-collections');
    if (saved && Array.isArray(saved)) {
      this.collections = saved;
    }
  }

  /**
   * Save collections to storage
   */
  saveCollections() {
    storage.set('devchef-snippets-plus-collections', this.collections);
  }

  /**
   * Load variables from storage
   */
  loadVariables() {
    const saved = storage.get('devchef-snippets-plus-variables');
    if (saved) {
      this.variables = new Map(Object.entries(saved));
    }
  }

  /**
   * Save variables to storage
   */
  saveVariables() {
    const variablesObj = Object.fromEntries(this.variables);
    storage.set('devchef-snippets-plus-variables', variablesObj);
  }

  /**
   * Parse variables from snippet content
   * @param {string} content - Snippet content
   * @returns {Array} Array of variable names
   */
  parseVariables(content) {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1].trim();
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Substitute variables in content
   * @param {string} content - Content with {{variables}}
   * @param {Object} values - Variable values { varName: value }
   * @returns {string} Content with variables replaced
   */
  substituteVariables(content, values = {}) {
    let result = content;

    // Replace {{variable}} with values
    Object.entries(values).forEach(([varName, value]) => {
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });

    // Replace remaining {{variable}} with saved defaults or empty string
    const remainingVars = this.parseVariables(result);
    remainingVars.forEach(varName => {
      const defaultValue = this.variables.get(varName) || '';
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      result = result.replace(regex, defaultValue);
    });

    return result;
  }

  /**
   * Set variable default value
   * @param {string} name - Variable name
   * @param {string} value - Default value
   */
  setVariable(name, value) {
    this.variables.set(name, value);
    this.saveVariables();
  }

  /**
   * Get variable value
   * @param {string} name - Variable name
   * @returns {string} Variable value or empty string
   */
  getVariable(name) {
    return this.variables.get(name) || '';
  }

  /**
   * Delete variable
   * @param {string} name - Variable name
   */
  deleteVariable(name) {
    this.variables.delete(name);
    this.saveVariables();
  }

  /**
   * Get all variables
   * @returns {Object} All variables
   */
  getAllVariables() {
    return Object.fromEntries(this.variables);
  }

  /**
   * Insert snippet with variable substitution
   * @param {string} snippetId - Snippet ID
   * @param {Object} values - Variable values
   * @param {HTMLElement} target - Target element (optional)
   * @returns {Promise<string>} Processed snippet content
   */
  async insertSnippet(snippetId, values = {}, target = null) {
    try {
      const snippet = snippetManager.getSnippet(snippetId);
      if (!snippet) {
        throw new Error('Snippet not found');
      }

      // Parse variables from snippet
      const variables = this.parseVariables(snippet.content);

      // If variables exist and no values provided, prompt user
      if (variables.length > 0 && Object.keys(values).length === 0) {
        values = await this.promptForVariables(variables, snippet.title);
        if (!values) {
          return null; // User cancelled
        }
      }

      // Substitute variables
      const processedContent = this.substituteVariables(snippet.content, values);

      // Insert into target element if provided
      if (target) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          const text = target.value;

          target.value = text.substring(0, start) + processedContent + text.substring(end);
          target.selectionStart = target.selectionEnd = start + processedContent.length;
          target.focus();
        } else {
          target.textContent = processedContent;
        }
      } else {
        // Copy to clipboard
        await navigator.clipboard.writeText(processedContent);
      }

      // Track usage
      snippetManager.useSnippet(snippetId);
      this.addToQuickInsertHistory(snippetId);

      return processedContent;
    } catch (error) {
      console.error('Error inserting snippet:', error);
      throw error;
    }
  }

  /**
   * Prompt user for variable values
   * @param {Array} variables - Variable names
   * @param {string} title - Snippet title
   * @returns {Promise<Object>} Variable values or null if cancelled
   */
  async promptForVariables(variables, title) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'snippet-variables-dialog';
      dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
          <div class="dialog-header">
            <h3>Insert Snippet: ${this.escapeHtml(title)}</h3>
            <button class="dialog-close" id="snippet-vars-close">✕</button>
          </div>
          <div class="dialog-body">
            <p class="dialog-description">Enter values for variables:</p>
            <form id="snippet-vars-form">
              ${variables.map(varName => `
                <div class="form-group">
                  <label for="var-${varName}">${varName}</label>
                  <input type="text"
                         id="var-${varName}"
                         name="${varName}"
                         value="${this.escapeHtml(this.getVariable(varName))}"
                         placeholder="Enter ${varName}..."
                         autocomplete="off">
                </div>
              `).join('')}
            </form>
          </div>
          <div class="dialog-footer">
            <label class="checkbox-label">
              <input type="checkbox" id="save-defaults">
              Save as defaults
            </label>
            <div class="dialog-actions">
              <button class="btn-secondary" id="snippet-vars-cancel">Cancel</button>
              <button class="btn-primary" id="snippet-vars-insert">Insert</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Focus first input
      setTimeout(() => {
        const firstInput = dialog.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
      }, 10);

      const cleanup = () => {
        dialog.remove();
      };

      // Close button
      dialog.querySelector('#snippet-vars-close').addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // Cancel button
      dialog.querySelector('#snippet-vars-cancel').addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // Insert button
      dialog.querySelector('#snippet-vars-insert').addEventListener('click', () => {
        const form = dialog.querySelector('#snippet-vars-form');
        const formData = new FormData(form);
        const values = {};

        for (const [key, value] of formData.entries()) {
          values[key] = value;
        }

        // Save defaults if checked
        if (dialog.querySelector('#save-defaults').checked) {
          Object.entries(values).forEach(([key, value]) => {
            this.setVariable(key, value);
          });
        }

        cleanup();
        resolve(values);
      });

      // Form submit
      dialog.querySelector('#snippet-vars-form').addEventListener('submit', (e) => {
        e.preventDefault();
        dialog.querySelector('#snippet-vars-insert').click();
      });

      // ESC to cancel
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(null);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  }

  /**
   * Create snippet from template
   * @param {string} templateId - Template ID
   * @param {Object} values - Variable values
   * @param {Object} metadata - Snippet metadata (title, description, etc.)
   * @returns {Object} Created snippet
   */
  createFromTemplate(templateId, values = {}, metadata = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const content = this.substituteVariables(template.content, values);

    const snippet = snippetManager.createSnippet({
      title: metadata.title || template.name,
      content,
      description: metadata.description || template.description,
      language: template.language,
      category: template.category,
      tags: metadata.tags || [template.category],
      ...metadata
    });

    return snippet;
  }

  /**
   * Get all templates
   * @param {string} category - Filter by category (optional)
   * @returns {Array} Templates
   */
  getTemplates(category = null) {
    let templates = Array.from(this.templates.values());

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    return templates;
  }

  /**
   * Get template categories
   * @returns {Array} Unique categories
   */
  getTemplateCategories() {
    const categories = new Set();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Create snippet collection
   * @param {Object} data - Collection data
   * @returns {Object} Created collection
   */
  createCollection(data) {
    const collection = {
      id: `collection-${Date.now()}-${Math.random()}`,
      name: data.name || 'Untitled Collection',
      description: data.description || '',
      snippetIds: data.snippetIds || [],
      tags: data.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.collections.push(collection);
    this.saveCollections();

    return collection;
  }

  /**
   * Add snippet to collection
   * @param {string} collectionId - Collection ID
   * @param {string} snippetId - Snippet ID
   */
  addToCollection(collectionId, snippetId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection && !collection.snippetIds.includes(snippetId)) {
      collection.snippetIds.push(snippetId);
      collection.updatedAt = Date.now();
      this.saveCollections();
    }
  }

  /**
   * Remove snippet from collection
   * @param {string} collectionId - Collection ID
   * @param {string} snippetId - Snippet ID
   */
  removeFromCollection(collectionId, snippetId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      collection.snippetIds = collection.snippetIds.filter(id => id !== snippetId);
      collection.updatedAt = Date.now();
      this.saveCollections();
    }
  }

  /**
   * Get collection with snippets
   * @param {string} collectionId - Collection ID
   * @returns {Object} Collection with snippets
   */
  getCollection(collectionId) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (!collection) return null;

    const snippets = collection.snippetIds
      .map(id => snippetManager.getSnippet(id))
      .filter(s => s !== null);

    return {
      ...collection,
      snippets
    };
  }

  /**
   * Get all collections
   * @returns {Array} Collections
   */
  getAllCollections() {
    return this.collections;
  }

  /**
   * Delete collection
   * @param {string} collectionId - Collection ID
   */
  deleteCollection(collectionId) {
    this.collections = this.collections.filter(c => c.id !== collectionId);
    this.saveCollections();
  }

  /**
   * Add to quick insert history
   * @param {string} snippetId - Snippet ID
   */
  addToQuickInsertHistory(snippetId) {
    // Remove if already exists
    this.quickInsertHistory = this.quickInsertHistory.filter(id => id !== snippetId);

    // Add to front
    this.quickInsertHistory.unshift(snippetId);

    // Limit size
    if (this.quickInsertHistory.length > this.maxHistorySize) {
      this.quickInsertHistory = this.quickInsertHistory.slice(0, this.maxHistorySize);
    }

    storage.set('devchef-snippets-plus-history', this.quickInsertHistory);
  }

  /**
   * Get quick insert suggestions
   * @param {number} count - Number of suggestions
   * @returns {Array} Suggested snippets
   */
  getQuickInsertSuggestions(count = 5) {
    const suggestions = [];

    // Add from history
    this.quickInsertHistory.slice(0, count).forEach(snippetId => {
      const snippet = snippetManager.getSnippet(snippetId);
      if (snippet) {
        suggestions.push({ ...snippet, source: 'history' });
      }
    });

    // Add favorites if needed
    if (suggestions.length < count) {
      const favorites = snippetManager.getFavoriteSnippets();
      favorites.slice(0, count - suggestions.length).forEach(snippet => {
        if (!suggestions.find(s => s.id === snippet.id)) {
          suggestions.push({ ...snippet, source: 'favorite' });
        }
      });
    }

    return suggestions;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Export template
   * @param {string} templateId - Template ID
   * @returns {Object} Exported template
   */
  exportTemplate(templateId) {
    const template = this.templates.get(templateId);
    if (!template) return null;

    return {
      version: '6.5',
      type: 'devchef-snippet-template',
      data: template
    };
  }

  /**
   * Import template
   * @param {Object} data - Template data
   * @returns {boolean} Success status
   */
  importTemplate(data) {
    if (!data || data.type !== 'devchef-snippet-template') {
      return false;
    }

    const template = {
      ...data.data,
      id: `template-${Date.now()}-${Math.random()}`
    };

    this.templates.set(template.id, template);
    this.saveTemplates();

    return true;
  }
}

// Create and export singleton
export const snippetsPlus = new SnippetsPlus();
window.snippetsPlus = snippetsPlus;
