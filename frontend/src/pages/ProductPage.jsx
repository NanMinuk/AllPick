import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFamily } from '../context/FamilyContext.jsx';
import { productsApi, aiApi } from '../api/index.js';
import MemberJudgment from '../components/MemberJudgment.jsx';
import './ProductPage.css';


export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { members } = useFamily();

  const [product, setProduct] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    productsApi.getById(id)
      .then(data => setProduct(data))
      .catch(() => navigate('/'))
      .finally(() => setLoadingProduct(false));
  }, [id, navigate]);

  const runAnalysis = React.useCallback(async () => {
    if (!product || members.length === 0) return;
    const MAX = 3;
    setLoadingAI(true);
    setAiError(null);
    for (let attempt = 1; attempt <= MAX; attempt++) {
      setAiMessage(attempt === 1 ? '구성원별 적합도를 분석 중입니다...' : `응답이 느립니다. 재시도 중... (${attempt}/${MAX})`);
      try {
        const data = await aiApi.analyze(id, members);
        setAnalyses(data.analyses || []);
        setLoadingAI(false);
        setAiMessage('');
        return;
      } catch (err) {
        if (attempt === MAX) {
          setAiError('분석에 실패했습니다. 아래 버튼으로 다시 시도해주세요.');
          setLoadingAI(false);
          setAiMessage('');
        } else {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }, [product, id, members]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  if (loadingProduct) {
    return (
      <div className="loading-center" style={{ minHeight: '100dvh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!product) return null;

  const discountRate = product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const overallStatus = analyses.length > 0
    ? (analyses.every(a => a.status === 'good') ? 'all-good'
      : analyses.some(a => a.status === 'bad') ? 'has-bad'
      : 'has-caution')
    : null;

  const statusConfig = {
    'all-good': { label: '가족 모두 OK!', color: 'good', emoji: '✅' },
    'has-caution': { label: '일부 주의 필요', color: 'caution', emoji: '⚠️' },
    'has-bad': { label: '일부 부적합', color: 'bad', emoji: '❌' },
  };

  return (
    <div className="product-page">
      <div className="product-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <span className="product-header-title">상품 상세</span>
        <div style={{ width: 36 }} />
      </div>

      <div className="product-image-wrap">
        {!imgError ? (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="product-image-placeholder">
            {product.category === '신선식품' ? '🥦' : '🛒'}
          </div>
        )}
        {product.badge && <span className="product-detail-badge">{product.badge}</span>}
      </div>

      <div className="product-detail-info">
        <div className="product-category-tag">{product.category}</div>
        <h2 className="product-detail-name">{product.name}</h2>
        <p className="product-detail-desc">{product.description}</p>

        <div className="product-price-section">
          {discountRate > 0 && (
            <span className="product-original-price">
              {product.originalPrice.toLocaleString()}원
            </span>
          )}
          <div className="product-price-row-detail">
            <span className="product-detail-price">{product.price.toLocaleString()}원</span>
            {discountRate > 0 && (
              <span className="product-detail-discount">{discountRate}% 할인</span>
            )}
          </div>
        </div>

        <div className="product-meta">
          {product.brand && (
            <div className="meta-item">
              <span className="meta-label">브랜드</span>
              <span className="meta-value">{product.brand}</span>
            </div>
          )}
          {product.mallName && (
            <div className="meta-item">
              <span className="meta-label">판매처</span>
              <span className="meta-value">{product.mallName}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">카테고리</span>
            <span className="meta-value">{product.category}</span>
          </div>
          {product.ingredientsSummary && (
            <div className="meta-item">
              <span className="meta-label">주요 재료 <span className="ai-badge">AI 예측</span></span>
              <span className="meta-value">{product.ingredientsSummary}</span>
            </div>
          )}
          {product.allergens && product.allergens.length > 0 && (
            <div className="meta-item">
              <span className="meta-label">알러지 <span className="ai-badge">AI 예측</span></span>
              <div className="allergen-tags">
                {product.allergens.map(a => (
                  <span key={a} className="allergen-tag">{a}</span>
                ))}
              </div>
            </div>
          )}
          {product.spicinessLevel && (
            <div className="meta-item">
              <span className="meta-label">맵기 <span className="ai-badge">AI 예측</span></span>
              <span className="spice-dots">
                {[1,2,3,4,5].map(v => (
                  <span key={v} className={`spice-dot ${product.spicinessLevel >= v ? 'filled' : ''}`} />
                ))}
              </span>
            </div>
          )}
        </div>
        <div className="data-disclaimer">
          ⚠️ 주요 재료·알러지·맵기는 AI가 상품명으로 예측한 값입니다. 구매 전 실제 성분표를 확인하세요.
        </div>

        <a
          className="source-link-btn"
          href={product.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          🔗 상품 보기
        </a>
      </div>

      <div className="family-analysis-section">
        <div className="analysis-header">
          <span className="analysis-title">🤖 우리 가족 AI 적합도 분석</span>
          {overallStatus && (
            <span className={`overall-status ${statusConfig[overallStatus].color}`}>
              {statusConfig[overallStatus].emoji} {statusConfig[overallStatus].label}
            </span>
          )}
        </div>

        {members.length === 0 ? (
          <div className="ai-error">
            <p style={{ color: 'var(--text-sub)' }}>👨‍👩‍👧‍👦 가족 프로필을 등록하면<br />구성원별 적합도를 분석해드려요.</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/setup')}>
              가족 프로필 등록하기
            </button>
          </div>
        ) : loadingAI ? (
          <div className="loading-center" style={{ padding: '40px' }}>
            <div className="spinner" />
            <p>{aiMessage}</p>
          </div>
        ) : aiError ? (
          <div className="ai-error">
            <p>⚠️ {aiError}</p>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={runAnalysis}>
              다시 시도
            </button>
          </div>
        ) : (
          <div className="member-judgments">
            {analyses.map(analysis => (
              <MemberJudgment key={analysis.memberId} analysis={analysis} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
