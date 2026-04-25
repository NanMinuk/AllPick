import React, { useState } from 'react';
import './MemberJudgment.css';

const STATUS_CONFIG = {
  good:    { emoji: '✅', label: '잘 맞아요',   bgClass: 'good' },
  caution: { emoji: '⚠️', label: '주의 필요',   bgClass: 'caution' },
  bad:     { emoji: '❌', label: '부적합',       bgClass: 'bad' },
};

export default function MemberJudgment({ analysis }) {
  const { name, age, status, reason, warning, detail } = analysis;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.caution;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`judgment-row ${config.bgClass}`}>
      <div className="judgment-member">
        <div className="judgment-avatar">{name[0]}</div>
        <div className="judgment-member-info">
          <span className="judgment-name">{name}</span>
          <span className="judgment-age">{age}세</span>
        </div>
      </div>

      <div className="judgment-result">
        <div className="judgment-status-row">
          <span className="judgment-emoji">{config.emoji}</span>
          <span className={`judgment-label ${config.bgClass}`}>{config.label}</span>
        </div>
        <p className="judgment-reason">{reason}</p>
        {warning && (
          <p className="judgment-warning">⚠️ {warning}</p>
        )}
        {detail && (
          <button
            className="judgment-detail-btn"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? '상세 접기 ▲' : '상세 보기 ▼'}
          </button>
        )}
        {expanded && detail && (
          <p className="judgment-detail">{detail}</p>
        )}
      </div>
    </div>
  );
}
