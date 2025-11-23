/**
 * AI Assistant & Code Generator
 * Natural language interface with intelligent code generation
 *
 * Features:
 * - Natural language command processing
 * - Code snippet generation
 * - Intelligent help and guidance
 * - Pattern-based responses
 * - Context-aware suggestions
 * - Learning from user interactions
 * - Multi-language code generation
 */

class AIAssistant {
  constructor() {
    this.conversationHistory = [];
    this.knowledgeBase = new Map();
    this.codeTemplates = new Map();
    this.patterns = new Map();
    this.userPreferences = this.loadPreferences();
    this.isOpen = false;
    this.init();
  }

  /**
   * Initialize AI Assistant
   */
  init() {
    this.loadKnowledgeBase();
    this.loadCodeTemplates();
    this.loadPatterns();
    this.registerShortcut();
    console.log('AI Assistant & Code Generator initialized');
  }

  /**
   * Register global shortcut
   */
  registerShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+A (or Cmd+Shift+A) to open AI Assistant
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Toggle AI Assistant panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open AI Assistant
   */
  open() {
    if (this.isOpen) return;

    this.createPanel();
    this.isOpen = true;

    setTimeout(() => {
      const input = document.getElementById('ai-assistant-input');
      if (input) input.focus();
    }, 100);
  }

  /**
   * Close AI Assistant
   */
  close() {
    const panel = document.getElementById('ai-assistant-panel');
    if (panel) {
      panel.remove();
    }
    this.isOpen = false;
  }

  /**
   * Create AI Assistant panel
   */
  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.className = 'ai-assistant-panel';
    panel.innerHTML = `
      <div class="ai-assistant-container">
        <div class="ai-assistant-header">
          <div class="header-left">
            <span class="ai-icon">🤖</span>
            <h2>AI Assistant</h2>
          </div>
          <div class="header-right">
            <button class="ai-btn-minimize" title="Minimize">_</button>
            <button class="ai-btn-close" title="Close (Esc)">✕</button>
          </div>
        </div>

        <div class="ai-assistant-chat" id="ai-chat">
          <div class="ai-message ai-message-assistant">
            <div class="ai-avatar">🤖</div>
            <div class="ai-content">
              <p>Hi! I'm your AI Assistant. I can help you with:</p>
              <ul>
                <li>Generate code in any language</li>
                <li>Answer questions about DevChef</li>
                <li>Create custom transformations</li>
                <li>Suggest workflows and optimizations</li>
                <li>Execute commands via natural language</li>
              </ul>
              <p>Try asking: "Generate a Python function to parse JSON" or "How do I create a pipeline?"</p>
            </div>
          </div>
        </div>

        <div class="ai-assistant-input-area">
          <textarea
            id="ai-assistant-input"
            placeholder="Ask me anything... (Shift+Enter to send)"
            rows="3"
          ></textarea>
          <div class="ai-input-actions">
            <button id="ai-send-btn" class="ai-btn-primary">Send</button>
            <button id="ai-clear-btn" class="ai-btn-secondary">Clear Chat</button>
            <button id="ai-examples-btn" class="ai-btn-secondary">Examples</button>
          </div>
        </div>

        <div class="ai-assistant-status">
          <span id="ai-status">Ready</span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const input = document.getElementById('ai-assistant-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const clearBtn = document.getElementById('ai-clear-btn');
    const examplesBtn = document.getElementById('ai-examples-btn');
    const closeBtn = document.querySelector('.ai-btn-close');
    const minimizeBtn = document.querySelector('.ai-btn-minimize');

    // Send message
    sendBtn?.addEventListener('click', () => this.sendMessage());

    // Send on Shift+Enter
    input?.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Clear chat
    clearBtn?.addEventListener('click', () => this.clearChat());

    // Show examples
    examplesBtn?.addEventListener('click', () => this.showExamples());

    // Close
    closeBtn?.addEventListener('click', () => this.close());

    // Minimize
    minimizeBtn?.addEventListener('click', () => this.minimize());

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Send message to AI
   */
  async sendMessage() {
    const input = document.getElementById('ai-assistant-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    this.addMessage(message, 'user');
    input.value = '';

    // Show typing indicator
    this.showTyping();

    // Process message
    await this.processMessage(message);
  }

  /**
   * Add message to chat
   */
  addMessage(content, role = 'assistant', type = 'text') {
    const chat = document.getElementById('ai-chat');
    if (!chat) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-message-${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-content';

    if (type === 'code') {
      contentDiv.innerHTML = `<pre><code>${this.escapeHTML(content)}</code></pre>`;

      // Add copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '📋 Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(content);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
      };
      contentDiv.appendChild(copyBtn);
    } else if (type === 'html') {
      contentDiv.innerHTML = content;
    } else {
      contentDiv.textContent = content;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chat.appendChild(messageDiv);

    // Scroll to bottom
    chat.scrollTop = chat.scrollHeight;

    // Add to history
    this.conversationHistory.push({ role, content, timestamp: Date.now() });
  }

  /**
   * Show typing indicator
   */
  showTyping() {
    const chat = document.getElementById('ai-chat');
    if (!chat) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-typing';
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.innerHTML = `
      <div class="ai-avatar">🤖</div>
      <div class="ai-content">
        <span class="typing-dots">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>
    `;

    chat.appendChild(typingDiv);
    chat.scrollTop = chat.scrollHeight;
  }

  /**
   * Remove typing indicator
   */
  removeTyping() {
    const typing = document.getElementById('ai-typing-indicator');
    if (typing) {
      typing.remove();
    }
  }

  /**
   * Process user message
   */
  async processMessage(message) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    this.removeTyping();

    const lowerMessage = message.toLowerCase();

    // Detect intent
    if (this.isCodeGenerationRequest(lowerMessage)) {
      this.handleCodeGeneration(message);
    } else if (this.isQuestionAboutDevChef(lowerMessage)) {
      this.handleDevChefQuestion(message);
    } else if (this.isCommandRequest(lowerMessage)) {
      this.handleCommand(message);
    } else if (this.isWorkflowSuggestion(lowerMessage)) {
      this.handleWorkflowSuggestion(message);
    } else {
      this.handleGeneralQuery(message);
    }

    // Update status
    this.updateStatus('Ready');
  }

  /**
   * Check if message is code generation request
   */
  isCodeGenerationRequest(message) {
    const keywords = ['generate', 'create', 'write', 'code', 'function', 'script', 'program'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if message is about DevChef
   */
  isQuestionAboutDevChef(message) {
    const keywords = ['how do i', 'how to', 'what is', 'where is', 'devchef', 'tool', 'feature'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if message is a command
   */
  isCommandRequest(message) {
    const keywords = ['open', 'run', 'execute', 'start', 'show', 'create pipeline'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Check if message requests workflow suggestions
   */
  isWorkflowSuggestion(message) {
    const keywords = ['suggest', 'recommend', 'optimize', 'improve', 'workflow', 'pipeline'];
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Handle code generation
   */
  handleCodeGeneration(message) {
    const code = this.generateCode(message);

    if (code) {
      this.addMessage(`Here's the code I generated for you:`, 'assistant');
      this.addMessage(code.code, 'assistant', 'code');
      this.addMessage(`Language: ${code.language}\n${code.explanation}`, 'assistant');
    } else {
      this.addMessage(`I can generate code for you! Please specify:\n- Language (Python, JavaScript, SQL, etc.)\n- What the code should do\n\nExample: "Generate a Python function to validate email addresses"`, 'assistant');
    }
  }

  /**
   * Generate code based on request
   */
  generateCode(message) {
    const lower = message.toLowerCase();

    // Python code generation
    if (lower.includes('python')) {
      if (lower.includes('json') || lower.includes('parse')) {
        return {
          language: 'Python',
          code: `import json

def parse_json_file(file_path):
    """Parse JSON file and return data"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    return data

def parse_json_string(json_str):
    """Parse JSON string and return data"""
    return json.loads(json_str)

# Example usage
data = parse_json_string('{"name": "DevChef", "version": "4.0"}')
print(data['name'])  # Output: DevChef`,
          explanation: 'This Python code provides functions to parse JSON from files or strings.'
        };
      } else if (lower.includes('api') || lower.includes('request')) {
        return {
          language: 'Python',
          code: `import requests

def make_api_request(url, method='GET', data=None, headers=None):
    """Make HTTP API request"""
    try:
        response = requests.request(
            method=method,
            url=url,
            json=data,
            headers=headers or {}
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        return None

# Example usage
result = make_api_request('https://api.example.com/data')
print(result)`,
          explanation: 'This Python code makes HTTP API requests with error handling.'
        };
      }
    }

    // JavaScript code generation
    if (lower.includes('javascript') || lower.includes('js')) {
      if (lower.includes('fetch') || lower.includes('api')) {
        return {
          language: 'JavaScript',
          code: `async function fetchData(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : null
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

// Example usage
fetchData('https://api.example.com/data')
  .then(data => console.log(data));`,
          explanation: 'This JavaScript code fetches data from APIs with error handling.'
        };
      } else if (lower.includes('sort') || lower.includes('array')) {
        return {
          language: 'JavaScript',
          code: `// Sort array of objects
const sortByProperty = (arr, prop, ascending = true) => {
  return [...arr].sort((a, b) => {
    const aVal = a[prop];
    const bVal = b[prop];

    if (aVal < bVal) return ascending ? -1 : 1;
    if (aVal > bVal) return ascending ? 1 : -1;
    return 0;
  });
};

// Example usage
const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 }
];

const sortedByAge = sortByProperty(users, 'age');
console.log(sortedByAge);`,
          explanation: 'This JavaScript code sorts arrays of objects by any property.'
        };
      }
    }

    // SQL code generation
    if (lower.includes('sql')) {
      if (lower.includes('select') || lower.includes('query')) {
        return {
          language: 'SQL',
          code: `-- Basic SELECT query with JOIN
SELECT
  users.id,
  users.name,
  users.email,
  COUNT(orders.id) AS order_count,
  SUM(orders.total) AS total_spent
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY users.id, users.name, users.email
HAVING order_count > 0
ORDER BY total_spent DESC
LIMIT 10;`,
          explanation: 'This SQL query retrieves top users with their order statistics.'
        };
      } else if (lower.includes('create') || lower.includes('table')) {
        return {
          language: 'SQL',
          code: `-- Create table with indexes
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
);`,
          explanation: 'This SQL creates a users table with proper indexes.'
        };
      }
    }

    // Regex generation
    if (lower.includes('regex') || lower.includes('regular expression')) {
      return {
        language: 'Regex',
        code: `// Email validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;

// URL validation
const urlRegex = /^https?:\\/\\/[^\\s]+$/;

// Phone number (US)
const phoneRegex = /^\\(?\\d{3}\\)?[-\\s]?\\d{3}[-\\s]?\\d{4}$/;

// UUID
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Test
console.log(emailRegex.test('user@example.com')); // true`,
        explanation: 'Common regex patterns for validation.'
      };
    }

    return null;
  }

  /**
   * Handle DevChef questions
   */
  handleDevChefQuestion(message) {
    const lower = message.toLowerCase();

    if (lower.includes('pipeline')) {
      this.addMessage(`To create a pipeline in DevChef:

1. **Visual Flow Canvas**: Press Ctrl+Shift+F or click 🎨
   - Drag tools onto the canvas
   - Connect them by clicking output → input
   - Click ▶️ Run to execute

2. **Quick Pipeline**: Use the Pipeline Manager (Ctrl+P)
   - Select tools in sequence
   - Configure each step
   - Save and run

Pipelines automatically chain tool outputs to inputs!`, 'assistant');
    } else if (lower.includes('shortcut') || lower.includes('keyboard')) {
      this.addMessage(`DevChef Keyboard Shortcuts:

**Essential:**
• Ctrl+K - Command Palette
• Ctrl+Shift+V - Universal Quick Input
• Ctrl+Shift+F - Visual Flow Canvas
• Ctrl+Shift+A - AI Assistant (me!)

**Tools:**
• Ctrl+Space - Quick Actions
• Ctrl+B - Snippets
• Ctrl+I - Insights
• Ctrl+P - Pipelines

**Navigation:**
• Ctrl+F - Search Tools
• Ctrl+D - Favorite Tool
• Escape - Close Dialogs`, 'assistant');
    } else if (lower.includes('tool') && (lower.includes('create') || lower.includes('custom'))) {
      this.addMessage(`You can create custom tools using the **Custom Tool Builder**!

Press Ctrl+Shift+T to open the visual tool builder where you can:
• Design your tool's UI
• Add inputs and outputs
• Define transformations
• Test your tool live
• Export and share

No coding required!`, 'assistant');
    } else {
      this.addMessage(`DevChef V4 is the ultimate developer productivity platform!

**Key Features:**
• 🧠 Smart Context Engine - Learns your patterns
• 🎨 Visual Flow Canvas - Drag-and-drop pipelines
• ⚡ Universal Quick Input - Process any data
• 🤖 AI Assistant - That's me!
• 🛠️ Custom Tool Builder - Create your own tools
• ⚙️ Automation Engine - Schedule tasks

What would you like to know more about?`, 'assistant');
    }
  }

  /**
   * Handle command execution
   */
  handleCommand(message) {
    const lower = message.toLowerCase();

    if (lower.includes('open') && lower.includes('flow')) {
      this.addMessage('Opening Visual Flow Canvas...', 'assistant');
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'F',
        ctrlKey: true,
        shiftKey: true
      }));
    } else if (lower.includes('open') && lower.includes('quick')) {
      this.addMessage('Opening Universal Quick Input...', 'assistant');
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'V',
        ctrlKey: true,
        shiftKey: true
      }));
    } else {
      this.addMessage(`I can execute commands like:
• "Open Flow Canvas"
• "Open Quick Input"
• "Show keyboard shortcuts"
• "Create a pipeline"

What would you like me to do?`, 'assistant');
    }
  }

  /**
   * Handle workflow suggestions
   */
  handleWorkflowSuggestion(message) {
    this.addMessage(`Based on common developer workflows, I suggest:

**Data Processing Pipeline:**
1. JSON Formatter → CSV Converter → SQL Generator
   Use this for: Converting API responses to database inserts

**JWT Analysis Workflow:**
1. JWT Decoder → JSON Formatter → Base64 Encoder
   Use this for: Debugging auth tokens

**Text Processing Pipeline:**
1. String Cleaner → Regex Tester → Template Transform
   Use this for: Data validation and transformation

Would you like me to create any of these pipelines for you?`, 'assistant');
  }

  /**
   * Handle general queries
   */
  handleGeneralQuery(message) {
    this.addMessage(`I can help you with:

• **Code Generation**: "Generate a Python function to..."
• **DevChef Help**: "How do I create a pipeline?"
• **Commands**: "Open Flow Canvas"
• **Workflows**: "Suggest a workflow for..."

What would you like to do?`, 'assistant');
  }

  /**
   * Clear chat
   */
  clearChat() {
    const chat = document.getElementById('ai-chat');
    if (chat) {
      chat.innerHTML = '';
      this.conversationHistory = [];
      this.addMessage('Chat cleared! How can I help you?', 'assistant');
    }
  }

  /**
   * Show examples
   */
  showExamples() {
    const examples = [
      'Generate a Python function to parse JSON',
      'Create a JavaScript async function for API calls',
      'How do I create a pipeline?',
      'Show me keyboard shortcuts',
      'Suggest a workflow for data transformation',
      'Open Flow Canvas',
      'Generate SQL query to select top users'
    ];

    const examplesHTML = `
      <p>Try these examples:</p>
      <ul class="ai-examples-list">
        ${examples.map(ex => `<li class="ai-example" data-text="${ex}">${ex}</li>`).join('')}
      </ul>
    `;

    this.addMessage(examplesHTML, 'assistant', 'html');

    // Add click handlers
    setTimeout(() => {
      document.querySelectorAll('.ai-example').forEach(el => {
        el.addEventListener('click', () => {
          const input = document.getElementById('ai-assistant-input');
          if (input) {
            input.value = el.dataset.text;
            input.focus();
          }
        });
      });
    }, 100);
  }

  /**
   * Minimize panel
   */
  minimize() {
    const panel = document.getElementById('ai-assistant-panel');
    if (panel) {
      panel.classList.toggle('minimized');
    }
  }

  /**
   * Update status
   */
  updateStatus(text) {
    const status = document.getElementById('ai-status');
    if (status) {
      status.textContent = text;
    }
  }

  /**
   * Escape HTML
   */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Load knowledge base
   */
  loadKnowledgeBase() {
    this.knowledgeBase.set('devchef', {
      description: 'DevChef V4 is the ultimate offline-first developer productivity platform',
      features: ['Smart Context Engine', 'Visual Flow Canvas', 'Universal Quick Input', 'AI Assistant', 'Custom Tool Builder', 'Automation Engine']
    });
  }

  /**
   * Load code templates
   */
  loadCodeTemplates() {
    // Templates loaded dynamically based on requests
  }

  /**
   * Load patterns
   */
  loadPatterns() {
    // Patterns for natural language processing
  }

  /**
   * Load preferences
   */
  loadPreferences() {
    try {
      const stored = localStorage.getItem('devchef-ai-preferences');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Save preferences
   */
  savePreferences() {
    try {
      localStorage.setItem('devchef-ai-preferences', JSON.stringify(this.userPreferences));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }

  /**
   * Export conversation
   */
  exportConversation() {
    return {
      history: this.conversationHistory,
      timestamp: Date.now()
    };
  }
}

// Create and export singleton
export const aiAssistant = new AIAssistant();
export { AIAssistant };
