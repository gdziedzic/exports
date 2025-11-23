/**
 * Visual Flow Canvas
 * Drag-and-drop pipeline builder with live preview
 *
 * Features:
 * - Visual node-based editor
 * - Drag-and-drop tool connections
 * - Live data preview at each step
 * - Auto-layout and alignment
 * - Zoom and pan canvas
 * - Template library
 * - Export/import workflows
 * - Execution history
 */

class FlowCanvas {
  constructor() {
    this.nodes = new Map();
    this.connections = new Map();
    this.canvas = null;
    this.ctx = null;
    this.selectedNode = null;
    this.draggingNode = null;
    this.connectingFrom = null;
    this.zoom = 1.0;
    this.pan = { x: 0, y: 0 };
    this.nodeIdCounter = 0;
    this.templates = new Map();
    this.history = [];
    this.init();
  }

  /**
   * Initialize the flow canvas
   */
  init() {
    this.loadTemplates();
    console.log('Visual Flow Canvas initialized');
  }

  /**
   * Create canvas element
   */
  createCanvas(container) {
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'flow-canvas-wrapper';
    canvasWrapper.innerHTML = `
      <div class="flow-canvas-toolbar">
        <button id="flow-canvas-zoom-in" title="Zoom In">🔍+</button>
        <button id="flow-canvas-zoom-out" title="Zoom Out">🔍-</button>
        <button id="flow-canvas-fit" title="Fit to Screen">⬜</button>
        <button id="flow-canvas-auto-layout" title="Auto Layout">📐</button>
        <button id="flow-canvas-clear" title="Clear All">🗑️</button>
        <button id="flow-canvas-run" title="Execute Pipeline">▶️</button>
        <button id="flow-canvas-save" title="Save Pipeline">💾</button>
        <button id="flow-canvas-load" title="Load Pipeline">📁</button>
      </div>
      <div class="flow-canvas-container">
        <canvas id="flow-canvas"></canvas>
        <div class="flow-canvas-palette">
          <h3>Tools</h3>
          <div id="flow-canvas-tools"></div>
        </div>
        <div class="flow-canvas-preview">
          <h3>Data Preview</h3>
          <div id="flow-canvas-preview-content"></div>
        </div>
      </div>
    `;

    container.appendChild(canvasWrapper);

    this.canvas = document.getElementById('flow-canvas');

    // Check if canvas exists (may be null in test environment)
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.setupCanvas();
      this.setupEventListeners();
      this.populateToolPalette();
      this.render();
    } else {
      // Running in headless/test environment
      this.ctx = null;
      console.log('FlowCanvas running in headless mode (no DOM canvas available)');
    }

    return canvasWrapper;
  }

  /**
   * Setup canvas size
   */
  setupCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;

    // Handle window resize
    window.addEventListener('resize', () => {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.render();
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

    // Toolbar buttons
    document.getElementById('flow-canvas-zoom-in')?.addEventListener('click', () => this.zoomIn());
    document.getElementById('flow-canvas-zoom-out')?.addEventListener('click', () => this.zoomOut());
    document.getElementById('flow-canvas-fit')?.addEventListener('click', () => this.fitToScreen());
    document.getElementById('flow-canvas-auto-layout')?.addEventListener('click', () => this.autoLayout());
    document.getElementById('flow-canvas-clear')?.addEventListener('click', () => this.clear());
    document.getElementById('flow-canvas-run')?.addEventListener('click', () => this.executePipeline());
    document.getElementById('flow-canvas-save')?.addEventListener('click', () => this.savePipeline());
    document.getElementById('flow-canvas-load')?.addEventListener('click', () => this.loadPipeline());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.selectedNode) {
        this.deleteNode(this.selectedNode);
      } else if (e.key === 'Escape') {
        this.selectedNode = null;
        this.connectingFrom = null;
        this.render();
      }
    });
  }

  /**
   * Populate tool palette
   */
  populateToolPalette() {
    const palette = document.getElementById('flow-canvas-tools');
    if (!palette) return;

    const categories = {
      'Text & Encoding': ['base64', 'url-encoder', 'hash-generator', 'string-cleaner'],
      'Data Formats': ['json-formatter', 'csv-json-converter', 'html-converter'],
      'Developer Tools': ['jwt-decoder', 'uuid-generator', 'timestamp-converter', 'regex-tester'],
      'SQL & Database': ['sql-formatter', 'sql-data-generator'],
      'Advanced': ['template-transform', 'code-transformer', 'data-pipeline-studio']
    };

    for (const [category, tools] of Object.entries(categories)) {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'flow-palette-category';

      const categoryHeader = document.createElement('h4');
      categoryHeader.textContent = category;
      categoryDiv.appendChild(categoryHeader);

      const toolsList = document.createElement('div');
      toolsList.className = 'flow-palette-tools';

      tools.forEach(tool => {
        const toolButton = document.createElement('button');
        toolButton.className = 'flow-palette-tool';
        toolButton.textContent = this.formatToolName(tool);
        toolButton.draggable = true;
        toolButton.dataset.toolId = tool;

        toolButton.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('tool', tool);
        });

        toolButton.addEventListener('click', () => {
          this.addNodeAtCenter(tool);
        });

        toolsList.appendChild(toolButton);
      });

      categoryDiv.appendChild(toolsList);
      palette.appendChild(categoryDiv);
    }

    // Enable drop on canvas
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const tool = e.dataTransfer.getData('tool');
      if (tool) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
        const y = (e.clientY - rect.top - this.pan.y) / this.zoom;
        this.addNode(tool, x, y);
      }
    });
  }

  /**
   * Format tool name for display
   */
  formatToolName(toolId) {
    return toolId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Add node at center of canvas
   */
  addNodeAtCenter(toolId) {
    const x = (this.canvas.width / 2 - this.pan.x) / this.zoom;
    const y = (this.canvas.height / 2 - this.pan.y) / this.zoom;
    this.addNode(toolId, x, y);
  }

  /**
   * Add node to canvas
   */
  addNode(toolId, x, y) {
    const nodeId = `node-${this.nodeIdCounter++}`;

    const node = {
      id: nodeId,
      toolId: toolId,
      x: x,
      y: y,
      width: 160,
      height: 80,
      inputs: ['input'],
      outputs: ['output'],
      config: {},
      data: null,
      status: 'idle' // idle, running, success, error
    };

    this.nodes.set(nodeId, node);
    this.render();
    return nodeId;
  }

  /**
   * Delete node
   */
  deleteNode(nodeId) {
    // Remove all connections to/from this node
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.from === nodeId || conn.to === nodeId) {
        this.connections.delete(connId);
      }
    }

    this.nodes.delete(nodeId);
    this.selectedNode = null;
    this.render();
  }

  /**
   * Connect two nodes
   */
  connect(fromNodeId, toNodeId) {
    const connId = `${fromNodeId}->${toNodeId}`;

    // Check if connection already exists
    if (this.connections.has(connId)) {
      return;
    }

    // Prevent self-connection
    if (fromNodeId === toNodeId) {
      return;
    }

    // Prevent cycles (simple check)
    if (this.wouldCreateCycle(fromNodeId, toNodeId)) {
      console.warn('Cannot create cycle in pipeline');
      return;
    }

    this.connections.set(connId, {
      id: connId,
      from: fromNodeId,
      to: toNodeId
    });

    this.render();
  }

  /**
   * Check if connection would create a cycle
   */
  wouldCreateCycle(fromNodeId, toNodeId) {
    const visited = new Set();
    const queue = [toNodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === fromNodeId) {
        return true;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      // Find all outgoing connections from current
      for (const conn of this.connections.values()) {
        if (conn.from === current) {
          queue.push(conn.to);
        }
      }
    }

    return false;
  }

  /**
   * Mouse down handler
   */
  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    // Check if clicking on a node
    for (const node of this.nodes.values()) {
      if (this.isPointInNode(x, y, node)) {
        // Check if clicking on output connector
        if (this.isPointInOutputConnector(x, y, node)) {
          this.connectingFrom = node.id;
          return;
        }

        this.selectedNode = node.id;
        this.draggingNode = {
          nodeId: node.id,
          offsetX: x - node.x,
          offsetY: y - node.y
        };
        this.render();
        return;
      }
    }

    // Deselect if clicking on empty space
    this.selectedNode = null;
    this.render();
  }

  /**
   * Mouse move handler
   */
  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    // Drag node
    if (this.draggingNode && !this.connectingFrom) {
      const node = this.nodes.get(this.draggingNode.nodeId);
      if (node) {
        node.x = x - this.draggingNode.offsetX;
        node.y = y - this.draggingNode.offsetY;
        this.render();
      }
    }

    // Draw connecting line
    if (this.connectingFrom && this.ctx) {
      this.render();
      const fromNode = this.nodes.get(this.connectingFrom);
      if (fromNode) {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.translate(this.pan.x, this.pan.y);
        this.ctx.scale(this.zoom, this.zoom);

        const fromX = fromNode.x + fromNode.width;
        const fromY = fromNode.y + fromNode.height / 2;

        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.restore();
      }
    }
  }

  /**
   * Mouse up handler
   */
  onMouseUp(e) {
    // Complete connection
    if (this.connectingFrom) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
      const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

      for (const node of this.nodes.values()) {
        if (this.isPointInInputConnector(x, y, node)) {
          this.connect(this.connectingFrom, node.id);
          break;
        }
      }

      this.connectingFrom = null;
      this.render();
    }

    this.draggingNode = null;
  }

  /**
   * Double click handler - edit node
   */
  onDoubleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    for (const node of this.nodes.values()) {
      if (this.isPointInNode(x, y, node)) {
        this.editNode(node.id);
        break;
      }
    }
  }

  /**
   * Wheel handler - zoom
   */
  onWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, this.zoom * delta));

    // Zoom toward mouse position
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.pan.x = mouseX - (mouseX - this.pan.x) * (newZoom / this.zoom);
    this.pan.y = mouseY - (mouseY - this.pan.y) * (newZoom / this.zoom);

    this.zoom = newZoom;
    this.render();
  }

  /**
   * Check if point is in node
   */
  isPointInNode(x, y, node) {
    return x >= node.x && x <= node.x + node.width &&
           y >= node.y && y <= node.y + node.height;
  }

  /**
   * Check if point is in input connector
   */
  isPointInInputConnector(x, y, node) {
    const connectorX = node.x;
    const connectorY = node.y + node.height / 2;
    const distance = Math.sqrt((x - connectorX) ** 2 + (y - connectorY) ** 2);
    return distance < 8;
  }

  /**
   * Check if point is in output connector
   */
  isPointInOutputConnector(x, y, node) {
    const connectorX = node.x + node.width;
    const connectorY = node.y + node.height / 2;
    const distance = Math.sqrt((x - connectorX) ** 2 + (y - connectorY) ** 2);
    return distance < 8;
  }

  /**
   * Render canvas
   */
  render() {
    // Skip rendering if no canvas context (headless mode)
    if (!this.ctx || !this.canvas) return;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Apply transformations
    this.ctx.translate(this.pan.x, this.pan.y);
    this.ctx.scale(this.zoom, this.zoom);

    // Draw connections
    this.drawConnections();

    // Draw nodes
    this.drawNodes();

    this.ctx.restore();
  }

  /**
   * Draw grid background
   */
  drawGrid() {
    if (!this.ctx || !this.canvas) return;

    const gridSize = 20 * this.zoom;
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 1;

    const offsetX = this.pan.x % gridSize;
    const offsetY = this.pan.y % gridSize;

    for (let x = offsetX; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = offsetY; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  /**
   * Draw all connections
   */
  drawConnections() {
    if (!this.ctx) return;

    for (const conn of this.connections.values()) {
      const fromNode = this.nodes.get(conn.from);
      const toNode = this.nodes.get(conn.to);

      if (fromNode && toNode) {
        this.drawConnection(fromNode, toNode);
      }
    }
  }

  /**
   * Draw a connection between two nodes
   */
  drawConnection(fromNode, toNode) {
    const fromX = fromNode.x + fromNode.width;
    const fromY = fromNode.y + fromNode.height / 2;
    const toX = toNode.x;
    const toY = toNode.y + toNode.height / 2;

    // Draw bezier curve
    const cp1x = fromX + (toX - fromX) / 2;
    const cp1y = fromY;
    const cp2x = toX - (toX - fromX) / 2;
    const cp2y = toY;

    this.ctx.strokeStyle = '#2196F3';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toX, toY);
    this.ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(toY - cp2y, toX - cp2x);
    const arrowSize = 8;

    this.ctx.fillStyle = '#2196F3';
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - arrowSize * Math.cos(angle - Math.PI / 6),
      toY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      toX - arrowSize * Math.cos(angle + Math.PI / 6),
      toY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Draw all nodes
   */
  drawNodes() {
    if (!this.ctx) return;

    for (const node of this.nodes.values()) {
      this.drawNode(node);
    }
  }

  /**
   * Draw a single node
   */
  drawNode(node) {
    if (!this.ctx) return;

    const isSelected = node.id === this.selectedNode;

    // Node background
    const statusColors = {
      idle: '#ffffff',
      running: '#FFF9C4',
      success: '#C8E6C9',
      error: '#FFCDD2'
    };

    this.ctx.fillStyle = statusColors[node.status] || statusColors.idle;
    this.ctx.strokeStyle = isSelected ? '#2196F3' : '#757575';
    this.ctx.lineWidth = isSelected ? 3 : 2;

    this.ctx.beginPath();
    this.ctx.roundRect(node.x, node.y, node.width, node.height, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Tool name
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      this.formatToolName(node.toolId),
      node.x + node.width / 2,
      node.y + node.height / 2
    );

    // Input connector
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y + node.height / 2, 6, 0, Math.PI * 2);
    this.ctx.fill();

    // Output connector
    this.ctx.fillStyle = '#2196F3';
    this.ctx.beginPath();
    this.ctx.arc(node.x + node.width, node.y + node.height / 2, 6, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Edit node configuration
   */
  editNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Show configuration dialog
    const config = prompt(`Configure ${this.formatToolName(node.toolId)}:`, JSON.stringify(node.config));
    if (config) {
      try {
        node.config = JSON.parse(config);
      } catch (e) {
        console.error('Invalid JSON configuration');
      }
    }
  }

  /**
   * Zoom in
   */
  zoomIn() {
    this.zoom = Math.min(3, this.zoom * 1.2);
    this.render();
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.zoom = Math.max(0.1, this.zoom / 1.2);
    this.render();
  }

  /**
   * Fit canvas to show all nodes
   */
  fitToScreen() {
    if (this.nodes.size === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of this.nodes.values()) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const padding = 50;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const zoomX = this.canvas.width / width;
    const zoomY = this.canvas.height / height;
    this.zoom = Math.min(zoomX, zoomY, 1);

    this.pan.x = -minX * this.zoom + padding;
    this.pan.y = -minY * this.zoom + padding;

    this.render();
  }

  /**
   * Auto-layout nodes
   */
  autoLayout() {
    // Simple left-to-right layout
    const layers = this.calculateLayers();

    const layerSpacing = 200;
    const nodeSpacing = 100;

    layers.forEach((layer, layerIndex) => {
      layer.forEach((nodeId, nodeIndex) => {
        const node = this.nodes.get(nodeId);
        if (node) {
          node.x = layerIndex * layerSpacing + 50;
          node.y = nodeIndex * nodeSpacing + 50;
        }
      });
    });

    this.render();
  }

  /**
   * Calculate node layers for layout
   */
  calculateLayers() {
    const layers = [];
    const placed = new Set();

    // Find root nodes (no inputs)
    const roots = [];
    for (const node of this.nodes.values()) {
      const hasInput = Array.from(this.connections.values()).some(conn => conn.to === node.id);
      if (!hasInput) {
        roots.push(node.id);
      }
    }

    if (roots.length === 0 && this.nodes.size > 0) {
      // If no roots, just take first node
      roots.push(Array.from(this.nodes.keys())[0]);
    }

    // BFS to assign layers
    const queue = roots.map(id => ({ id, layer: 0 }));

    while (queue.length > 0) {
      const { id, layer } = queue.shift();

      if (placed.has(id)) continue;
      placed.add(id);

      if (!layers[layer]) {
        layers[layer] = [];
      }
      layers[layer].push(id);

      // Find children
      for (const conn of this.connections.values()) {
        if (conn.from === id && !placed.has(conn.to)) {
          queue.push({ id: conn.to, layer: layer + 1 });
        }
      }
    }

    // Add any unconnected nodes
    for (const nodeId of this.nodes.keys()) {
      if (!placed.has(nodeId)) {
        layers[0] = layers[0] || [];
        layers[0].push(nodeId);
      }
    }

    return layers;
  }

  /**
   * Clear all nodes and connections
   */
  clear() {
    if (this.nodes.size > 0) {
      if (confirm('Clear all nodes and connections?')) {
        this.nodes.clear();
        this.connections.clear();
        this.selectedNode = null;
        this.render();
      }
    }
  }

  /**
   * Execute pipeline
   */
  async executePipeline() {
    const ordered = this.getExecutionOrder();
    if (ordered.length === 0) {
      alert('No nodes to execute');
      return;
    }

    // Get initial input
    const input = prompt('Enter initial input data:');
    if (input === null) return;

    let currentData = input;

    for (const nodeId of ordered) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      node.status = 'running';
      this.render();
      this.updatePreview(nodeId, currentData);

      try {
        // Simulate tool execution
        await new Promise(resolve => setTimeout(resolve, 500));

        // Transform data (placeholder - would call actual tool)
        currentData = await this.executeNodeTool(node, currentData);

        node.data = currentData;
        node.status = 'success';
      } catch (error) {
        node.status = 'error';
        console.error('Node execution failed:', error);
        alert(`Error in ${this.formatToolName(node.toolId)}: ${error.message}`);
        break;
      }

      this.render();
      this.updatePreview(nodeId, currentData);
    }

    // Show final result
    this.updatePreview(ordered[ordered.length - 1], currentData);
  }

  /**
   * Execute a node's tool on data
   */
  async executeNodeTool(node, data) {
    // This would integrate with actual DevChef tools
    // For now, just pass through
    console.log(`Executing ${node.toolId} with data:`, data);
    return data;
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder() {
    const order = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error('Cycle detected in pipeline');
      }

      visiting.add(nodeId);

      // Visit dependencies first
      for (const conn of this.connections.values()) {
        if (conn.to === nodeId) {
          visit(conn.from);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    try {
      for (const nodeId of this.nodes.keys()) {
        visit(nodeId);
      }
    } catch (error) {
      alert(error.message);
      return [];
    }

    return order;
  }

  /**
   * Update preview panel
   */
  updatePreview(nodeId, data) {
    const preview = document.getElementById('flow-canvas-preview-content');
    if (!preview) return;

    const node = this.nodes.get(nodeId);
    if (!node) return;

    preview.innerHTML = `
      <h4>${this.formatToolName(node.toolId)}</h4>
      <pre>${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}</pre>
    `;
  }

  /**
   * Save pipeline
   */
  savePipeline() {
    const name = prompt('Pipeline name:');
    if (!name) return;

    const pipeline = {
      name: name,
      nodes: Array.from(this.nodes.entries()),
      connections: Array.from(this.connections.entries()),
      created: Date.now()
    };

    const pipelines = JSON.parse(localStorage.getItem('devchef-flow-pipelines') || '[]');
    pipelines.push(pipeline);
    localStorage.setItem('devchef-flow-pipelines', JSON.stringify(pipelines));

    alert('Pipeline saved!');
  }

  /**
   * Load pipeline
   */
  loadPipeline() {
    const pipelines = JSON.parse(localStorage.getItem('devchef-flow-pipelines') || '[]');

    if (pipelines.length === 0) {
      alert('No saved pipelines');
      return;
    }

    const names = pipelines.map((p, i) => `${i}: ${p.name}`).join('\n');
    const index = prompt(`Select pipeline:\n${names}`);

    if (index === null) return;

    const pipeline = pipelines[parseInt(index)];
    if (!pipeline) return;

    this.clear();
    this.nodes = new Map(pipeline.nodes);
    this.connections = new Map(pipeline.connections);
    this.render();
  }

  /**
   * Load templates
   */
  loadTemplates() {
    // Default templates
    this.templates.set('json-to-csv', {
      name: 'JSON to CSV Converter',
      nodes: [
        { toolId: 'json-formatter', x: 50, y: 50 },
        { toolId: 'csv-json-converter', x: 250, y: 50 }
      ],
      connections: [
        { from: 'node-0', to: 'node-1' }
      ]
    });

    this.templates.set('jwt-analyzer', {
      name: 'JWT Analyzer',
      nodes: [
        { toolId: 'jwt-decoder', x: 50, y: 50 },
        { toolId: 'json-formatter', x: 250, y: 50 }
      ],
      connections: [
        { from: 'node-0', to: 'node-1' }
      ]
    });
  }

  /**
   * Export pipeline as JSON
   */
  exportPipeline() {
    return {
      nodes: Array.from(this.nodes.values()),
      connections: Array.from(this.connections.values())
    };
  }

  /**
   * Import pipeline from JSON
   */
  importPipeline(data) {
    this.clear();

    if (data.nodes) {
      data.nodes.forEach(node => {
        this.nodes.set(node.id, node);
      });
    }

    if (data.connections) {
      data.connections.forEach(conn => {
        this.connections.set(conn.id, conn);
      });
    }

    this.render();
  }
}

// Create and export singleton
export const flowCanvas = new FlowCanvas();
export { FlowCanvas };
