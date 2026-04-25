const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

function loadProducts() {
  const filePath = path.join(__dirname, '../data/products.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

router.get('/', (req, res) => {
  try {
    const products = loadProducts();
    const { category, q, page = 1, limit = 8 } = req.query;

    let result = products;
    if (category && category !== 'all') {
      result = result.filter(p => p.category === category);
    }
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(lower) ||
        (p.brand || '').toLowerCase().includes(lower) ||
        (p.mallName || '').toLowerCase().includes(lower) ||
        (p.ingredientsSummary || '').toLowerCase().includes(lower)
      );
    }

    const total = result.length;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const totalPages = Math.ceil(total / limitNum);
    const start = (pageNum - 1) * limitNum;
    const paginated = result.slice(start, start + limitNum);

    res.json({ products: paginated, total, page: pageNum, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '상품 목록을 불러오는 데 실패했습니다.' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const products = loadProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '상품 정보를 불러오는 데 실패했습니다.' });
  }
});

module.exports = router;
