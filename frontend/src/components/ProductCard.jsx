import React from 'react';
import './ProductCard.css';

export default function ProductCard({ product, onClick }) {
  const discountRate = product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  return (
    <div className="product-card" onClick={onClick}>
      <div className="product-img-wrap">
        <img
          src={product.image}
          alt={product.name}
          onError={e => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/200x200/FFF0EB/FF6B35?text=${encodeURIComponent('🛒')}`;
          }}
        />
      </div>
      <div className="product-info">
        <p className="product-name">{product.name}</p>
        {product.brand && <p className="product-desc">{product.brand}</p>}
        <div className="product-price-row">
          <span className="product-price">{product.price.toLocaleString()}원</span>
          {discountRate > 0 && (
            <span className="product-discount">{discountRate}% 할인</span>
          )}
        </div>
      </div>
    </div>
  );
}
