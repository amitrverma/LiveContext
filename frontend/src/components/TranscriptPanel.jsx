import React from 'react'

export default function TranscriptPanel({ partialText, segments }) {
  return (
    <section className="panel">
      <h2>Incremental Transcript</h2>
      <div className="transcript">
        {segments.map((segment, index) => (
          <div key={`${segment.end_time}-${index}`} className="segment">
            <span className="speaker">{segment.speaker}</span>
            <span className="text">{segment.text}</span>
          </div>
        ))}
        {partialText && (
          <div className="segment partial">
            <span className="speaker">LIVE</span>
            <span className="text">{partialText}</span>
          </div>
        )}
      </div>
    </section>
  )
}
