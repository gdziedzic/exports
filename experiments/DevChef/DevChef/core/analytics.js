/**
 * DevChef V2.5 - Productivity Analytics and Insights
 * Track usage patterns and provide productivity insights
 */

import { storage } from './storage.js';

class AnalyticsManager {
  constructor() {
    this.sessions = [];
    this.events = [];
    this.maxEvents = 1000;
    this.currentSession = null;
    this.loadData();
    this.startSession();
  }

  /**
   * Load analytics data
   */
  loadData() {
    const sessions = storage.get('devchef-v2.5-sessions');
    if (sessions && Array.isArray(sessions)) {
      this.sessions = sessions.slice(0, 100); // Keep last 100 sessions
    }

    const events = storage.get('devchef-v2.5-events');
    if (events && Array.isArray(events)) {
      this.events = events.slice(0, this.maxEvents);
    }
  }

  /**
   * Save analytics data
   */
  saveData() {
    storage.set('devchef-v2.5-sessions', this.sessions.slice(0, 100));
    storage.set('devchef-v2.5-events', this.events.slice(0, this.maxEvents));
  }

  /**
   * Start a new session
   */
  startSession() {
    this.currentSession = {
      id: `session-${Date.now()}`,
      startTime: Date.now(),
      endTime: null,
      duration: 0,
      toolsUsed: new Set(),
      actionsPerformed: 0,
      productivity: 0
    };
  }

  /**
   * End current session
   */
  endSession() {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.toolsUsed = Array.from(this.currentSession.toolsUsed);
    this.currentSession.productivity = this.calculateSessionProductivity();

    this.sessions.unshift(this.currentSession);
    if (this.sessions.length > 100) {
      this.sessions = this.sessions.slice(0, 100);
    }

    this.saveData();
    this.currentSession = null;
  }

  /**
   * Calculate session productivity score
   * @returns {number} Productivity score (0-100)
   */
  calculateSessionProductivity() {
    if (!this.currentSession) return 0;

    const duration = Date.now() - this.currentSession.startTime;
    const durationMinutes = duration / (1000 * 60);

    // Factors: actions performed, tools used, time efficiency
    const actionScore = Math.min(50, this.currentSession.actionsPerformed * 2);
    const toolScore = Math.min(30, this.currentSession.toolsUsed.size * 5);
    const timeScore = Math.min(20, durationMinutes * 2);

    return Math.min(100, actionScore + toolScore + timeScore);
  }

  /**
   * Track an event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  trackEvent(type, data = {}) {
    const event = {
      type,
      data,
      timestamp: Date.now(),
      sessionId: this.currentSession?.id
    };

    this.events.unshift(event);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Update current session
    if (this.currentSession) {
      this.currentSession.actionsPerformed++;
      if (data.toolId) {
        this.currentSession.toolsUsed.add(data.toolId);
      }
    }

    // Save periodically (every 10 events)
    if (this.events.length % 10 === 0) {
      this.saveData();
    }
  }

  /**
   * Get productivity insights
   * @param {Object} options - Options
   * @returns {Object} Insights
   */
  getInsights(options = {}) {
    const days = options.days || 7;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const recentSessions = this.sessions.filter(s => s.startTime >= cutoffTime);
    const recentEvents = this.events.filter(e => e.timestamp >= cutoffTime);

    return {
      overview: this.getOverviewInsights(recentSessions),
      tools: this.getToolInsights(recentEvents),
      productivity: this.getProductivityInsights(recentSessions),
      patterns: this.getPatternInsights(recentEvents),
      recommendations: this.getRecommendations(recentSessions, recentEvents)
    };
  }

  /**
   * Get overview insights
   * @param {Array} sessions - Recent sessions
   * @returns {Object} Overview insights
   */
  getOverviewInsights(sessions) {
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalActions = sessions.reduce((sum, s) => sum + s.actionsPerformed, 0);
    const avgProductivity = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.productivity, 0) / sessions.length
      : 0;

    return {
      totalSessions: sessions.length,
      totalDuration: totalDuration,
      totalDurationHours: (totalDuration / (1000 * 60 * 60)).toFixed(2),
      totalActions,
      avgActionsPerSession: sessions.length > 0 ? (totalActions / sessions.length).toFixed(1) : 0,
      avgSessionDuration: sessions.length > 0 ? (totalDuration / sessions.length).toFixed(0) : 0,
      avgProductivity: avgProductivity.toFixed(1)
    };
  }

  /**
   * Get tool usage insights
   * @param {Array} events - Recent events
   * @returns {Object} Tool insights
   */
  getToolInsights(events) {
    const toolUsage = {};

    events.forEach(event => {
      if (event.data.toolId) {
        if (!toolUsage[event.data.toolId]) {
          toolUsage[event.data.toolId] = {
            toolId: event.data.toolId,
            toolName: event.data.toolName || event.data.toolId,
            count: 0,
            lastUsed: event.timestamp
          };
        }
        toolUsage[event.data.toolId].count++;
      }
    });

    const tools = Object.values(toolUsage);
    tools.sort((a, b) => b.count - a.count);

    return {
      topTools: tools.slice(0, 10),
      totalTools: tools.length,
      mostUsed: tools[0] || null
    };
  }

  /**
   * Get productivity insights
   * @param {Array} sessions - Recent sessions
   * @returns {Object} Productivity insights
   */
  getProductivityInsights(sessions) {
    if (sessions.length === 0) {
      return {
        trend: 'neutral',
        peakHours: [],
        peakDays: []
      };
    }

    // Calculate productivity trend
    const half = Math.floor(sessions.length / 2);
    const firstHalf = sessions.slice(half);
    const secondHalf = sessions.slice(0, half);

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.productivity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.productivity, 0) / secondHalf.length;

    let trend = 'neutral';
    if (avgSecond > avgFirst * 1.1) trend = 'increasing';
    if (avgSecond < avgFirst * 0.9) trend = 'decreasing';

    // Peak hours
    const hourCounts = {};
    sessions.forEach(s => {
      const hour = new Date(s.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + s.actionsPerformed;
    });

    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Peak days
    const dayCounts = {};
    sessions.forEach(s => {
      const day = new Date(s.startTime).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + s.actionsPerformed;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => dayNames[parseInt(day)]);

    return {
      trend,
      currentScore: avgSecond.toFixed(1),
      previousScore: avgFirst.toFixed(1),
      change: ((avgSecond - avgFirst) / avgFirst * 100).toFixed(1),
      peakHours,
      peakDays
    };
  }

  /**
   * Get pattern insights
   * @param {Array} events - Recent events
   * @returns {Object} Pattern insights
   */
  getPatternInsights(events) {
    // Common sequences
    const sequences = {};
    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i].data.toolId;
      const next = events[i + 1].data.toolId;
      if (current && next) {
        const key = `${current}->${next}`;
        sequences[key] = (sequences[key] || 0) + 1;
      }
    }

    const commonSequences = Object.entries(sequences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([seq, count]) => {
        const [from, to] = seq.split('->');
        return { from, to, count };
      });

    return {
      commonSequences,
      avgEventsPerHour: events.length > 0 ? (events.length / 24).toFixed(1) : 0
    };
  }

  /**
   * Get recommendations
   * @param {Array} sessions - Recent sessions
   * @param {Array} events - Recent events
   * @returns {Array} Recommendations
   */
  getRecommendations(sessions, events) {
    const recommendations = [];

    // Low productivity recommendation
    const avgProductivity = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.productivity, 0) / sessions.length
      : 0;

    if (avgProductivity < 40 && sessions.length > 3) {
      recommendations.push({
        type: 'productivity',
        priority: 'high',
        message: 'Your productivity score is below average. Consider using favorites and keyboard shortcuts for faster workflows.'
      });
    }

    // Tool diversity recommendation
    const uniqueTools = new Set(events.map(e => e.data.toolId).filter(Boolean)).size;
    if (uniqueTools < 3 && events.length > 10) {
      recommendations.push({
        type: 'exploration',
        priority: 'medium',
        message: 'You\'re using only a few tools. Explore the command palette (Ctrl+K) to discover more productivity tools.'
      });
    }

    // Workflow automation recommendation
    const toolUsage = {};
    events.forEach(e => {
      if (e.data.toolId) {
        toolUsage[e.data.toolId] = (toolUsage[e.data.toolId] || 0) + 1;
      }
    });

    const frequentTools = Object.entries(toolUsage).filter(([_, count]) => count > 5);
    if (frequentTools.length >= 2) {
      recommendations.push({
        type: 'automation',
        priority: 'medium',
        message: 'You frequently use multiple tools. Consider creating a pipeline to automate your workflow.'
      });
    }

    return recommendations;
  }

  /**
   * Get statistics
   * @returns {Object} Overall statistics
   */
  getStatistics() {
    const totalSessions = this.sessions.length;
    const totalEvents = this.events.length;
    const totalDuration = this.sessions.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalSessions,
      totalEvents,
      totalDuration,
      totalHours: (totalDuration / (1000 * 60 * 60)).toFixed(2),
      avgSessionDuration: totalSessions > 0 ? (totalDuration / totalSessions / 1000).toFixed(0) : 0,
      dataSize: storage.getStorageStats()
    };
  }

  /**
   * Clear analytics data
   */
  clearData() {
    this.sessions = [];
    this.events = [];
    this.saveData();
    this.startSession();
  }

  /**
   * Export analytics
   * @returns {Object} Exported analytics
   */
  exportAnalytics() {
    return {
      version: '2.5',
      type: 'devchef-analytics',
      exportedAt: new Date().toISOString(),
      sessions: this.sessions,
      events: this.events
    };
  }
}

// Create and export singleton
export const analytics = new AnalyticsManager();

// Track page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    analytics.endSession();
  } else {
    analytics.startSession();
  }
});

// Track before unload
window.addEventListener('beforeunload', () => {
  analytics.endSession();
});
