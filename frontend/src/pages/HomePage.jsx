import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../context/FamilyContext.jsx';
import { productsApi, aiApi } from '../api/index.js';
import ProductCard from '../components/ProductCard.jsx';
import './HomePage.css';

const CATEGORIES = ['전체', '간편식', '가공식품', '신선식품'];

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  let prev = null;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || (p >= current - 2 && p <= current + 2)) {
      if (prev !== null && p - prev > 1) pages.push(null);
      pages.push(p);
      prev = p;
    }
  }
  return pages;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { members } = useFamily();

  const [tab, setTab] = useState('all');
  const [category, setCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const recCacheRef = useRef({});
  const [recCache, setRecCache] = useState({});

  const tabs = [
    { key: 'all', label: '전체 상품', badge: null },
    ...(members.length > 0 ? [
      { key: 'family', label: '가족 전체', badge: 'AI' },
      ...members.map(m => ({ key: m.id, label: m.relation || m.name, badge: 'AI' })),
    ] : []),
  ];

  useEffect(() => {
    const validKeys = tabs.map(t => t.key);
    if (!validKeys.includes(tab)) setTab('all');
  }, [members.length]);

  const loadProducts = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = { page: targetPage, limit: 8 };
      if (category !== '전체') params.category = category;
      if (searchQuery) params.q = searchQuery;
      const data = await productsApi.getAll(params);
      setProducts(data.products || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setProducts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [category, searchQuery]);

  useEffect(() => {
    setPage(1);
    loadProducts(1);
  }, [loadProducts]);

  const loadRecommended = useCallback(async (key, membersToUse, force = false) => {
    const current = recCacheRef.current[key];
    if (current?.loaded && !force) return;

    const update = (patch) => {
      recCacheRef.current = {
        ...recCacheRef.current,
        [key]: { ...(recCacheRef.current[key] || {}), ...patch },
      };
      setRecCache({ ...recCacheRef.current });
    };

    update({ loading: true, loaded: false, message: '취향을 분석 중입니다...' });

    const MAX = 3;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      if (attempt > 1) {
        update({ message: `응답이 느립니다. 재시도 중... (${attempt}/${MAX})` });
      }
      try {
        const data = await aiApi.recommend(membersToUse);
        update({
          recommended: data.recommended || [],
          reasoning: data.reasoning || '',
          loaded: true,
          loading: false,
          message: '',
        });
        return;
      } catch {
        if (attempt === MAX) {
          update({ recommended: [], reasoning: '', loaded: true, loading: false, message: '' });
        } else {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
  }, []);

  const handleTabChange = (key) => {
    setTab(key);
    if (key === 'all' || members.length === 0) return;
    const membersToUse = key === 'family' ? members : members.filter(m => m.id === key);
    if (membersToUse.length > 0) loadRecommended(key, membersToUse);
  };

  const curRec = recCache[tab] || {};
  const isAITab = tab !== 'all';
  const displayProducts = isAITab ? (curRec.recommended || []) : products;
  const isLoading = isAITab ? (curRec.loading || false) : loading;

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-title">
          <div>
            <h1 className="brand-logo">All<span>Pick</span></h1>
            <p className="member-chips">
              {members.map(m => (
                <span key={m.id} className="member-chip">{m.relation || m.name}</span>
              ))}
            </p>
          </div>
        </div>
        <button className="profile-btn" onClick={() => navigate('/setup')}>
          👨‍👩‍👧‍👦 {members.length === 0 ? '가족 등록' : '가족 편집'}
        </button>
      </div>

      {members.length === 0 && (
        <div className="no-members-banner">
          <span>👨‍👩‍👧‍👦 가족 프로필을 등록하면 AI 맞춤 추천을 받을 수 있어요</span>
          <button className="btn-link" onClick={() => navigate('/setup')}>등록하기 →</button>
        </div>
      )}

      <div className="search-bar-wrap">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="상품 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadProducts()}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
            {t.badge && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div className="category-filter">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`cat-btn ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >{c}</button>
          ))}
        </div>
      )}

      {isAITab && !curRec.loading && (curRec.recommended || []).length > 0 && (
        <div className="rec-banner">
          <div>
            <span>✨ AI가 <strong>{(curRec.recommended || []).length}개</strong> 상품을 추천했어요</span>
            {curRec.reasoning && <p className="rec-reasoning">{curRec.reasoning}</p>}
          </div>
        </div>
      )}

      <div className="product-section">
        {isLoading ? (
          <div className="loading-center">
            <div className="spinner" />
            {isAITab && <p>{curRec.message}</p>}
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="empty-state">
            {isAITab ? (
              <>
                <div className="empty-icon">🤔</div>
                <p>딱 맞는 상품을 찾지 못했거나<br />응답이 지연됐어요.</p>
                <button
                  className="btn-primary"
                  style={{ marginBottom: 8 }}
                  onClick={() => {
                    const membersToUse = tab === 'family'
                      ? members
                      : members.filter(m => m.id === tab);
                    loadRecommended(tab, membersToUse, true);
                  }}
                >다시 시도</button>
                <button className="btn-secondary" onClick={() => setTab('all')}>
                  전체 상품 보기
                </button>
              </>
            ) : (
              <>
                <div className="empty-icon">📦</div>
                <p>검색 결과가 없습니다.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="product-grid">
              {displayProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => navigate(`/product/${product.id}`)}
                />
              ))}
            </div>
            {tab === 'all' && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  disabled={page === 1}
                  onClick={() => { setPage(p => p - 1); loadProducts(page - 1); }}
                >‹</button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === null
                    ? <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
                    : <button
                        key={p}
                        className={`page-btn ${p === page ? 'active' : ''}`}
                        onClick={() => { setPage(p); loadProducts(p); }}
                      >{p}</button>
                )}
                <button
                  className="page-btn"
                  disabled={page === totalPages}
                  onClick={() => { setPage(p => p + 1); loadProducts(page + 1); }}
                >›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
