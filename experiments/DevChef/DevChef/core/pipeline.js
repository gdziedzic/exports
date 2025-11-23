/**
 * DevChef V2.5 - Tool Chaining and Pipeline System
 * Chain multiple tools together for advanced workflows
 */

import { ToolRegistry } from './registry.js';
import { storage } from './storage.js';
import { notifications } from './notifications.js';

class PipelineManager {
  constructor() {
    this.pipelines = [];
    this.maxPipelines = 50;
    this.loadPipelines();
  }

  /**
   * Load saved pipelines from storage
   */
  loadPipelines() {
    const saved = storage.get('devchef-v2.5-pipelines');
    if (saved && Array.isArray(saved)) {
      this.pipelines = saved;
    }
  }

  /**
   * Save pipelines to storage
   */
  savePipelines() {
    storage.set('devchef-v2.5-pipelines', this.pipelines);
  }

  /**
   * Create a new pipeline
   * @param {string} name - Pipeline name
   * @param {Array} steps - Array of {toolId, config}
   * @returns {Object} Created pipeline
   */
  createPipeline(name, steps = []) {
    const pipeline = {
      id: `pipeline-${Date.now()}-${Math.random()}`,
      name,
      steps,
      createdAt: Date.now(),
      lastUsed: null,
      useCount: 0
    };

    this.pipelines.unshift(pipeline);

    if (this.pipelines.length > this.maxPipelines) {
      this.pipelines = this.pipelines.slice(0, this.maxPipelines);
    }

    this.savePipelines();
    return pipeline;
  }

  /**
   * Add step to pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {string} toolId - Tool ID to add
   * @param {Object} config - Tool configuration
   */
  addStep(pipelineId, toolId, config = {}) {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return false;

    pipeline.steps.push({ toolId, config });
    this.savePipelines();
    return true;
  }

  /**
   * Remove step from pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {number} stepIndex - Step index to remove
   */
  removeStep(pipelineId, stepIndex) {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return false;

    pipeline.steps.splice(stepIndex, 1);
    this.savePipelines();
    return true;
  }

  /**
   * Execute a pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {string} initialInput - Initial input data
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} Execution result
   */
  async executePipeline(pipelineId, initialInput, progressCallback) {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    pipeline.lastUsed = Date.now();
    pipeline.useCount++;
    this.savePipelines();

    let currentData = initialInput;
    const results = [];

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      const tool = ToolRegistry.get(step.toolId);

      if (!tool) {
        throw new Error(`Tool ${step.toolId} not found`);
      }

      if (progressCallback) {
        progressCallback({
          step: i + 1,
          total: pipeline.steps.length,
          toolName: tool.manifest.name,
          status: 'processing'
        });
      }

      // Process through tool (simplified - would need actual tool execution)
      const result = await this.processStep(tool, currentData, step.config);

      results.push({
        toolId: step.toolId,
        toolName: tool.manifest.name,
        input: currentData,
        output: result,
        timestamp: Date.now()
      });

      currentData = result;
    }

    return {
      pipelineId,
      pipelineName: pipeline.name,
      results,
      finalOutput: currentData,
      executionTime: Date.now() - results[0].timestamp
    };
  }

  /**
   * Process a single pipeline step (simplified)
   * @param {Object} tool - Tool object
   * @param {string} input - Input data
   * @param {Object} config - Tool config
   * @returns {Promise<string>} Processed output
   */
  async processStep(tool, input, config) {
    // This is a simplified version - real implementation would
    // need to actually execute the tool's logic
    return new Promise((resolve) => {
      // Simulate processing
      setTimeout(() => {
        resolve(input); // In real implementation, would process through tool
      }, 100);
    });
  }

  /**
   * Get all pipelines
   * @returns {Array} All pipelines
   */
  getAllPipelines() {
    return this.pipelines;
  }

  /**
   * Get pipeline by ID
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object|null} Pipeline or null
   */
  getPipeline(pipelineId) {
    return this.pipelines.find(p => p.id === pipelineId) || null;
  }

  /**
   * Delete pipeline
   * @param {string} pipelineId - Pipeline ID
   */
  deletePipeline(pipelineId) {
    this.pipelines = this.pipelines.filter(p => p.id !== pipelineId);
    this.savePipelines();
  }

  /**
   * Update pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {Object} updates - Updates to apply
   */
  updatePipeline(pipelineId, updates) {
    const pipeline = this.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return false;

    Object.assign(pipeline, updates);
    this.savePipelines();
    return true;
  }

  /**
   * Get recently used pipelines
   * @param {number} count - Number of pipelines
   * @returns {Array} Recent pipelines
   */
  getRecentPipelines(count = 5) {
    return [...this.pipelines]
      .filter(p => p.lastUsed)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, count);
  }

  /**
   * Get most used pipelines
   * @param {number} count - Number of pipelines
   * @returns {Array} Popular pipelines
   */
  getMostUsedPipelines(count = 5) {
    return [...this.pipelines]
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, count);
  }

  /**
   * Export pipeline
   * @param {string} pipelineId - Pipeline ID
   * @returns {Object} Exported pipeline
   */
  exportPipeline(pipelineId) {
    const pipeline = this.getPipeline(pipelineId);
    if (!pipeline) return null;

    return {
      version: '2.5',
      type: 'devchef-pipeline',
      data: pipeline
    };
  }

  /**
   * Import pipeline
   * @param {Object} data - Pipeline data
   * @returns {boolean} Success status
   */
  importPipeline(data) {
    if (!data || data.type !== 'devchef-pipeline') {
      return false;
    }

    const pipeline = {
      ...data.data,
      id: `pipeline-${Date.now()}-${Math.random()}`, // New ID
      createdAt: Date.now(),
      lastUsed: null,
      useCount: 0
    };

    this.pipelines.unshift(pipeline);
    this.savePipelines();
    return true;
  }
}

// Create and export singleton
export const pipelineManager = new PipelineManager();
