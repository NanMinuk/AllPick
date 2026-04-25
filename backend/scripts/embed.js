/**
 * 상품 임베딩 생성 스크립트
 * 실행: node scripts/embed.js
 * 결과: backend/data/embeddings.json
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PRODUCTS_PATH = path.join(__dirname, '../data/products.json');
const OUTPUT_PATH = path.join(__dirname, '../data/embeddings.json');

function productToText(p) {
  const parts = [p.name, p.category];
  if (p.ingredientsSummary) parts.push(p.ingredientsSummary);
  if (p.allergens?.length) parts.push(`알러지: ${p.allergens.join(', ')}`);
  if (p.spicinessLevel) parts.push(`맵기: ${p.spicinessLevel}단계`);
  return parts.join(' | ');
}

async function embedBatch(texts) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf-8'));
  console.log(`[embed] ${products.length}개 상품 임베딩 시작...`);

  const BATCH = 20;
  const embeddings = {};

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const texts = batch.map(productToText);
    const vecs = await embedBatch(texts);
    batch.forEach((p, j) => { embeddings[p.id] = vecs[j]; });
    console.log(`  → ${Math.min(i + BATCH, products.length)}/${products.length} 완료`);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(embeddings), 'utf-8');
  console.log(`[완료] ${Object.keys(embeddings).length}개 저장 → ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
