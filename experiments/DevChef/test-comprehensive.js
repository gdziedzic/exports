/**
 * Comprehensive Test Suite for DevChef V3.1, V4, V5
 * Tests all core functionality for reliability
 */

// Load test environment
require('./test-env.js');

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const assertEquals = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
};

const assertThrows = (fn, message) => {
  try {
    fn();
    throw new Error(`${message} - Expected function to throw but it didn't`);
  } catch (e) {
    // Expected
  }
};

// Test Runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Comprehensive DevChef Test Suite...\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✓ ${test.name}`);
        this.passed++;
      } catch (e) {
        console.log(`✗ ${test.name}`);
        console.log(`  ${e.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Total: ${this.tests.length}`);

    if (this.failed === 0) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log(`\n❌ ${this.failed} test(s) failed`);
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

// ===================================================================
// V3.1 TESTS - Smart Context Engine, Flow Canvas, Quick Input
// ===================================================================

// Context Engine Tests
runner.test('ContextEngine: Initialize and load patterns', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const engine = new ContextEngine();

  assert(engine.patterns instanceof Map, 'Should have patterns Map');
  assert(engine.sequences instanceof Array, 'Should have sequences Array');
  assert(engine.patterns.size > 0, 'Should have default patterns');
});

runner.test('ContextEngine: Learn from tool sequence', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const engine = new ContextEngine();

  engine.learnSequence('json-formatter');
  engine.learnSequence('csv-json-converter');

  const pattern = 'json-formatter->csv-json-converter';
  assert(engine.patterns.has(pattern), 'Should learn tool sequence pattern');
});

runner.test('ContextEngine: Generate clipboard suggestions', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const engine = new ContextEngine();

  const jsonData = '{"test": "data"}';
  const suggestions = engine.generateClipboardSuggestions(jsonData, {
    type: 'json',
    confidence: 0.9
  });

  assert(suggestions.length > 0, 'Should generate suggestions for JSON');
  assert(suggestions[0].tool, 'Suggestion should have tool property');
  assert(suggestions[0].confidence > 0, 'Should have confidence score');
});

runner.test('ContextEngine: Predict next tools', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const engine = new ContextEngine();

  // Set up pattern
  engine.patterns.set('json-formatter->csv-json-converter', 5);

  const predictions = engine.predictNextTools('json-formatter');

  assert(predictions.length > 0, 'Should predict next tools');
  assertEquals(predictions[0].tool, 'csv-json-converter', 'Should predict CSV converter after JSON formatter');
});

runner.test('ContextEngine: Export and import learning data', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const engine = new ContextEngine();

  engine.patterns.set('test-pattern', 10);
  const exported = engine.exportLearning();

  assert(exported.patterns, 'Export should include patterns');
  assert(exported.timestamp, 'Export should include timestamp');

  const newEngine = new ContextEngine();
  newEngine.importLearning(exported);

  assertEquals(newEngine.patterns.get('test-pattern'), 10, 'Should import patterns correctly');
});

// Flow Canvas Tests
runner.test('FlowCanvas: Add and connect nodes', () => {
  const { FlowCanvas } = require('./core/flowcanvas.js');
  const canvas = new FlowCanvas();

  const node1 = canvas.addNode('json-formatter', 100, 100);
  const node2 = canvas.addNode('csv-json-converter', 300, 100);

  assert(canvas.nodes.has(node1), 'Should add first node');
  assert(canvas.nodes.has(node2), 'Should add second node');

  canvas.connect(node1, node2);
  const connId = `${node1}->${node2}`;

  assert(canvas.connections.has(connId), 'Should create connection');
});

runner.test('FlowCanvas: Prevent circular dependencies', () => {
  const { FlowCanvas } = require('./core/flowcanvas.js');
  const canvas = new FlowCanvas();

  const node1 = canvas.addNode('tool1', 100, 100);
  const node2 = canvas.addNode('tool2', 200, 100);

  canvas.connect(node1, node2);
  canvas.connect(node2, node1); // Try to create cycle

  // Should only have one connection (cycle prevented)
  assert(canvas.connections.size === 1, 'Should prevent circular dependencies');
});

runner.test('FlowCanvas: Export and import pipeline', () => {
  const { FlowCanvas } = require('./core/flowcanvas.js');
  const canvas = new FlowCanvas();

  const node1 = canvas.addNode('json-formatter', 100, 100);
  const node2 = canvas.addNode('csv-converter', 200, 100);
  canvas.connect(node1, node2);

  const exported = canvas.exportPipeline();

  assert(exported.nodes, 'Export should include nodes');
  assert(exported.connections, 'Export should include connections');

  const newCanvas = new FlowCanvas();
  newCanvas.importPipeline(exported);

  assertEquals(newCanvas.nodes.size, 2, 'Should import correct number of nodes');
  assertEquals(newCanvas.connections.size, 1, 'Should import connections');
});

// Quick Input Tests
runner.test('QuickInput: Detect JSON data type', () => {
  const { QuickInput } = require('./core/quickinput.js');
  const input = new QuickInput();

  const jsonData = '{"test": "value"}';
  const detection = input.basicDetection(jsonData);

  assertEquals(detection.type, 'json', 'Should detect JSON');
  assert(detection.confidence > 0.8, 'Should have high confidence for JSON');
});

runner.test('QuickInput: Detect UUID', () => {
  const { QuickInput } = require('./core/quickinput.js');
  const input = new QuickInput();

  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const detection = input.basicDetection(uuid);

  assertEquals(detection.type, 'uuid', 'Should detect UUID');
});

runner.test('QuickInput: Generate transformations for JSON', () => {
  const { QuickInput } = require('./core/quickinput.js');
  const input = new QuickInput();

  const jsonData = '{"test": "value"}';
  const transformations = input.generateTransformations(jsonData, { type: 'json' });

  assert(transformations.length > 0, 'Should generate transformations');
  assert(transformations.some(t => t.name === 'Format JSON'), 'Should include JSON formatter');
});

runner.test('QuickInput: Format JSON transformation', () => {
  const { QuickInput } = require('./core/quickinput.js');
  const input = new QuickInput();

  const minified = '{"test":"value"}';
  const formatted = input.formatJSON(minified);

  assert(formatted.includes('\n'), 'Should format JSON with newlines');
  assert(formatted.includes('  '), 'Should include indentation');
});

// ===================================================================
// V4 TESTS - AI Assistant, Tool Builder, Automation
// ===================================================================

// AI Assistant Tests
runner.test('AIAssistant: Detect code generation request', () => {
  const { AIAssistant } = require('./core/aiassistant.js');
  const assistant = new AIAssistant();

  assert(assistant.isCodeGenerationRequest('generate python function'), 'Should detect code generation');
  assert(assistant.isCodeGenerationRequest('create javascript code'), 'Should detect create code');
  assert(!assistant.isCodeGenerationRequest('what is devchef'), 'Should not detect for questions');
});

runner.test('AIAssistant: Detect DevChef questions', () => {
  const { AIAssistant } = require('./core/aiassistant.js');
  const assistant = new AIAssistant();

  assert(assistant.isQuestionAboutDevChef('how do i create pipeline'), 'Should detect how-to questions');
  assert(assistant.isQuestionAboutDevChef('what is devchef'), 'Should detect what-is questions');
});

runner.test('AIAssistant: Generate Python code', () => {
  const { AIAssistant } = require('./core/aiassistant.js');
  const assistant = new AIAssistant();

  const result = assistant.generateCode('generate python function to parse json');

  assert(result, 'Should generate code');
  assertEquals(result.language, 'Python', 'Should be Python');
  assert(result.code.includes('json'), 'Code should include json');
  assert(result.explanation, 'Should include explanation');
});

runner.test('AIAssistant: Generate JavaScript code', () => {
  const { AIAssistant } = require('./core/aiassistant.js');
  const assistant = new AIAssistant();

  const result = assistant.generateCode('generate javascript fetch api code');

  assert(result, 'Should generate code');
  assertEquals(result.language, 'JavaScript', 'Should be JavaScript');
  assert(result.code.includes('fetch'), 'Code should include fetch');
});

// Tool Builder Tests
runner.test('ToolBuilder: Create new custom tool', () => {
  const { ToolBuilder } = require('./core/toolbuilder.js');
  const builder = new ToolBuilder();

  builder.newTool();

  assert(builder.currentTool, 'Should create current tool');
  assert(builder.currentTool.id, 'Should have ID');
  assertEquals(builder.currentTool.inputs.length, 0, 'Should start with no inputs');
});

runner.test('ToolBuilder: Add input fields', () => {
  const { ToolBuilder } = require('./core/toolbuilder.js');
  const builder = new ToolBuilder();

  builder.newTool();
  builder.addInput();
  builder.addInput();

  assertEquals(builder.currentTool.inputs.length, 2, 'Should have 2 inputs');
  assert(builder.currentTool.inputs[0].id, 'Input should have ID');
});

runner.test('ToolBuilder: Save and load custom tool', () => {
  const { ToolBuilder } = require('./core/toolbuilder.js');
  const builder = new ToolBuilder();

  builder.newTool();
  builder.currentTool.name = 'Test Tool';
  builder.currentTool.description = 'Test Description';

  const toolId = builder.currentTool.id;
  builder.customTools.set(toolId, builder.currentTool);

  assert(builder.customTools.has(toolId), 'Should save tool');
  assertEquals(builder.customTools.get(toolId).name, 'Test Tool', 'Should save tool name');
});

// Automation Engine Tests
runner.test('AutomationEngine: Create automation', () => {
  const { AutomationEngine } = require('./core/automation.js');
  const engine = new AutomationEngine();

  engine.newAutomation();

  assert(engine.currentAutomation, 'Should create automation');
  assert(engine.currentAutomation.id, 'Should have ID');
  assertEquals(engine.currentAutomation.actions.length, 0, 'Should start with no actions');
});

runner.test('AutomationEngine: Add actions', () => {
  const { AutomationEngine } = require('./core/automation.js');
  const engine = new AutomationEngine();

  engine.newAutomation();
  engine.addAction();
  engine.addAction();

  assertEquals(engine.currentAutomation.actions.length, 2, 'Should have 2 actions');
});

runner.test('AutomationEngine: Execute automation', async () => {
  const { AutomationEngine } = require('./core/automation.js');
  const engine = new AutomationEngine();

  const automation = {
    id: 'test-auto',
    name: 'Test',
    actions: [
      { type: 'console-log', message: 'Test message' }
    ],
    enabled: true
  };

  engine.automations.set(automation.id, automation);
  await engine.executeAutomation(automation.id);

  assert(engine.taskHistory.length > 0, 'Should record execution in history');
  assertEquals(engine.taskHistory[0].status, 'success', 'Should execute successfully');
});

runner.test('AutomationEngine: Evaluate conditions', () => {
  const { AutomationEngine } = require('./core/automation.js');
  const engine = new AutomationEngine();

  const result1 = engine.evaluateCondition('data.length > 0', { length: 5 });
  assert(result1, 'Should evaluate true condition');

  const result2 = engine.evaluateCondition('data.value === "test"', { value: 'test' });
  assert(result2, 'Should evaluate equality condition');
});

// ===================================================================
// V5 TESTS - Performance Multiplier, Collaboration, Data Bridge
// ===================================================================

// Performance Multiplier Tests
runner.test('PerformanceMultiplier: Record metrics', () => {
  const { PerformanceMultiplier } = require('./core/multiplier.js');
  const multiplier = new PerformanceMultiplier();

  multiplier.recordMetric('test-metric', { value: 100 });
  multiplier.recordMetric('test-metric', { value: 200 });

  assert(multiplier.metrics.has('test-metric'), 'Should have metric type');
  assertEquals(multiplier.metrics.get('test-metric').length, 2, 'Should record multiple metrics');
});

runner.test('PerformanceMultiplier: Detect bottlenecks', () => {
  const { PerformanceMultiplier } = require('./core/multiplier.js');
  const multiplier = new PerformanceMultiplier();

  // Simulate time spent on tools
  multiplier.recordMetric('time-spent', { toolId: 'json-formatter', duration: 50000 });
  multiplier.recordMetric('time-spent', { toolId: 'json-formatter', duration: 30000 });
  multiplier.recordMetric('time-spent', { toolId: 'other-tool', duration: 5000 });

  multiplier.detectBottlenecks();

  assert(multiplier.optimizations.length > 0, 'Should detect bottleneck');
});

runner.test('PerformanceMultiplier: Calculate multiplier', () => {
  const { PerformanceMultiplier } = require('./core/multiplier.js');
  const multiplier = new PerformanceMultiplier();

  multiplier.setBaseline();
  assert(multiplier.baseline > 0, 'Should set baseline');

  multiplier.recordMetric('tool-open', { toolId: 'test' });
  multiplier.calculateMultiplier();

  assert(multiplier.multiplier >= 0, 'Should calculate multiplier');
});

// Collaboration Hub Tests
runner.test('CollaborationHub: Generate share URL', () => {
  const { CollaborationHub } = require('./core/collaboration.js');
  const hub = new CollaborationHub();

  const workflow = { name: 'Test Workflow', steps: [] };
  const shared = hub.shareWorkflow(workflow);

  assert(shared.shareUrl, 'Should generate share URL');
  assert(shared.shareUrl.startsWith('devchef://share/'), 'Should have correct URL format');
});

runner.test('CollaborationHub: Import shared workflow', () => {
  const { CollaborationHub } = require('./core/collaboration.js');
  const hub = new CollaborationHub();

  const workflow = { name: 'Test', data: [1, 2, 3] };
  const shared = hub.shareWorkflow(workflow);
  const imported = hub.importShared(shared.shareUrl);

  assert(imported, 'Should import workflow');
  assertEquals(imported.name, 'Test', 'Should import correct data');
});

runner.test('CollaborationHub: Create team workspace', () => {
  const { CollaborationHub } = require('./core/collaboration.js');
  const hub = new CollaborationHub();

  const workspace = hub.createTeamWorkspace('Dev Team', ['Alice', 'Bob']);

  assert(workspace.id, 'Should have ID');
  assertEquals(workspace.name, 'Dev Team', 'Should have correct name');
  assertEquals(workspace.members.length, 2, 'Should have correct members');
  assert(hub.sharedWorkspaces.has(workspace.id), 'Should store workspace');
});

// Data Bridge Tests
runner.test('DataBridge: Detect data types', () => {
  const { DataBridge } = require('./core/databridge.js');
  const bridge = new DataBridge();

  assertEquals(bridge.detectType('{"test": 1}'), 'json', 'Should detect JSON');
  assertEquals(bridge.detectType('https://example.com'), 'url', 'Should detect URL');
  assertEquals(bridge.detectType('123e4567-e89b-12d3-a456-426614174000'), 'uuid', 'Should detect UUID');
  assertEquals(bridge.detectType('plain text'), 'text', 'Should default to text');
});

runner.test('DataBridge: Create bookmarklet', () => {
  const { DataBridge } = require('./core/databridge.js');
  const bridge = new DataBridge();

  assert(bridge.bookmarklet, 'Should have bookmarklet');
  assert(bridge.bookmarklet.startsWith('javascript:'), 'Should be JavaScript bookmarklet');
});

runner.test('DataBridge: Connect to API', () => {
  const { DataBridge } = require('./core/databridge.js');
  const bridge = new DataBridge();

  bridge.connectToAPI('test-api', 'https://api.example.com', { 'Authorization': 'Bearer token' });

  assert(bridge.connections.has('test-api'), 'Should store API connection');
  assertEquals(bridge.connections.get('test-api').baseUrl, 'https://api.example.com', 'Should store base URL');
});

// ===================================================================
// INTEGRATION TESTS
// ===================================================================

runner.test('Integration: Context Engine + Quick Input', () => {
  const { ContextEngine } = require('./core/contextengine.js');
  const { QuickInput } = require('./core/quickinput.js');

  const engine = new ContextEngine();
  const input = new QuickInput();

  const jsonData = '{"test": "value"}';
  const detection = input.basicDetection(jsonData);
  const suggestions = engine.generateClipboardSuggestions(jsonData, detection);

  assert(suggestions.length > 0, 'Should generate integrated suggestions');
});

runner.test('Integration: AI Assistant + Tool Builder', () => {
  const { AIAssistant } = require('./core/aiassistant.js');
  const { ToolBuilder } = require('./core/toolbuilder.js');

  const assistant = new AIAssistant();
  const builder = new ToolBuilder();

  const code = assistant.generateCode('generate python json parser');
  assert(code, 'AI should generate code');

  builder.newTool();
  builder.currentTool.name = 'JSON Parser';
  builder.currentTool.customTransform = code.code;

  assert(builder.currentTool.customTransform.includes('json'), 'Should integrate AI code into custom tool');
});

runner.test('Integration: Performance Multiplier + Automation', () => {
  const { PerformanceMultiplier } = require('./core/multiplier.js');
  const { AutomationEngine } = require('./core/automation.js');

  const multiplier = new PerformanceMultiplier();
  const automation = new AutomationEngine();

  multiplier.recordMetric('tool-open', { toolId: 'json-formatter' });
  multiplier.recordMetric('tool-open', { toolId: 'json-formatter' });

  automation.newAutomation();
  automation.currentAutomation.name = 'Auto JSON Format';

  assert(multiplier.metrics.size > 0, 'Multiplier should track usage');
  assert(automation.currentAutomation, 'Automation should be created');
});

// Run all tests
runner.run().catch(console.error);
