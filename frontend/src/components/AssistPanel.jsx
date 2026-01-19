import React from 'react'

export default function AssistPanel({ assistCard }) {
  return (
    <section className="panel">
      <h2>Assist Card</h2>
      {!assistCard && <div className="empty">No active suggestions.</div>}
      {assistCard && (
        <div className="assist-card">
          <div className="label">Next Step</div>
          <div className="next-step">{assistCard.next_step}</div>
          <div className="label">Facts</div>
          <ul>
            {assistCard.facts.map((fact, index) => (
              <li key={`${assistCard.card_id}-fact-${index}`}>{fact}</li>
            ))}
          </ul>
          <div className="meta">
            <span>Sentiment: {assistCard.insights?.sentiment || 'unknown'}</span>
            <span>Risk: {assistCard.insights?.risk || 'unknown'}</span>
          </div>
          <div className="sources">Sources: {assistCard.sources.join(', ')}</div>
        </div>
      )}
    </section>
  )
}
