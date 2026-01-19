/**
 * @typedef {Object} TranscriptSegment
 * @property {string} call_id
 * @property {'CUSTOMER' | 'AGENT'} speaker
 * @property {string} text
 * @property {number} end_time
 */

/**
 * @typedef {Object} ContextWindow
 * @property {string} call_id
 * @property {number} window_seconds
 * @property {TranscriptSegment[]} segments
 */

/**
 * @typedef {Object} AssistCard
 * @property {string} card_id
 * @property {string} call_id
 * @property {string[]} facts
 * @property {string} next_step
 * @property {{sentiment: string, risk: string}} insights
 * @property {string[]} sources
 */

module.exports = {}
