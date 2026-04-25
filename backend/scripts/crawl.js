/**
 * 크롤러: 네이버 쇼핑 API로 식품 수집 → GPT로 필드 예측(enrichment)
 * 실행: node scripts/crawl.js
 * 필요 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, OPENAI_API_KEY
 *
 * 저장 필드:
 *   - 네이버 API 실제 제공값: name, price, image, brand, mallName, sourceUrl
 *   - GPT 예측값(aiEnriched:true): spicinessLevel, allergens, ingredientsSummary
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const OUTPUT_PATH = path.join(__dirname, '../data/products.json');
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SEARCH_TERMS = [
  // 간편식 (8개)
  { keyword: '치킨 간편식',      category: '간편식' },
  { keyword: '불고기 밀키트',    category: '간편식' },
  { keyword: '해물 밀키트',      category: '간편식' },
  { keyword: '냉동 안주',        category: '간편식' },
  { keyword: '떡볶이 간편식',    category: '간편식' },
  { keyword: '파스타 간편식',    category: '간편식' },
  { keyword: '국물 요리 밀키트', category: '간편식' },
  { keyword: '볶음밥 간편식',    category: '간편식' },
  { keyword: '냉동 만두',        category: '간편식' },
  { keyword: '초밥 밀키트',      category: '간편식' },
  // 가공식품 (6개)
  { keyword: '냉동 디저트 간식', category: '가공식품' },
  { keyword: '과자 스낵',        category: '가공식품' },
  { keyword: '라면 세트',        category: '가공식품' },
  { keyword: '통조림 참치',      category: '가공식품' },
  { keyword: '레토르트 카레',    category: '가공식품' },
  { keyword: '시리얼 그래놀라',  category: '가공식품' },
  { keyword: '음료 주스',        category: '가공식품' },
  // 신선식품 (3개)
  { keyword: '샐러드 키트',      category: '신선식품' },
  { keyword: '채소 모둠',        category: '신선식품' },
  { keyword: '달걀 계란',        category: '신선식품' },
];

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ─────────────────────────────────────────────
// Step 1: 네이버 쇼핑 크롤링
// ─────────────────────────────────────────────
async function crawlNaver() {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.error('[크롤러] 오류: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET이 .env에 없습니다.');
    process.exit(1);
  }

  console.log('\n[Step 1] 네이버 쇼핑 API 크롤링 시작...');
  const headers = {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  };

  const products = [];
  let idCounter = 1;
  const seen = new Set();

  for (const { keyword, category } of SEARCH_TERMS) {
    try {
      console.log(`  [검색] "${keyword}"...`);
      const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=5&sort=sim`;
      const response = await axios.get(url, { headers, timeout: 8000 });
      const items = response.data?.items || [];

      for (const item of items) {
        const name = stripHtml(item.title || '');
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const price = parseInt(item.lprice) || 0;
        const originalPrice = parseInt(item.hprice) || 0;

        products.push({
          id: `p${String(idCounter).padStart(3, '0')}`,
          name,
          price,
          originalPrice: originalPrice > price ? originalPrice : price,
          image: item.image || '',
          category,
          brand: item.brand || '',
          mallName: item.mallName || '',
          sourceUrl: item.link || '',
          crawledAt: new Date().toISOString(),
        });
        idCounter++;
      }

      await sleep(300);
    } catch (err) {
      console.warn(`  [경고] "${keyword}" 실패: ${err.message}`);
    }
  }

  console.log(`  → ${products.length}개 상품 수집 완료`);
  return products;
}

// ─────────────────────────────────────────────
// Step 2: GPT로 상품 필드 예측 (enrichment)
// ─────────────────────────────────────────────
async function enrichProduct(product) {
  const prompt = `다음 한국 식품 상품의 정보를 상품명과 카테고리만 보고 예측하세요.

상품명: ${product.name}
카테고리: ${product.category}
브랜드: ${product.brand || '정보없음'}

아래 JSON 형식으로만 응답하세요:
{
  "spicinessLevel": 1~5 정수 (1=매우순함, 2=순함, 3=중간, 4=매운편, 5=매우매움),
  "allergens": ["포함 가능성 높은 알러지 성분 목록"],
  "ingredientsSummary": "주요 재료 한줄 요약 20자 이내"
}

알러지 항목은 다음 중에서만 선택: 밀, 우유, 달걀, 대두, 돼지고기, 쇠고기, 닭고기, 생선, 갑각류, 견과류, 참깨
확실하지 않은 성분은 포함하지 마세요.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(completion.choices[0].message.content);
    return {
      spicinessLevel: Math.min(5, Math.max(1, parseInt(result.spicinessLevel) || 2)),
      allergens: Array.isArray(result.allergens) ? result.allergens : [],
      ingredientsSummary: result.ingredientsSummary || '',
      aiEnriched: true,
    };
  } catch {
    return { spicinessLevel: 2, allergens: [], ingredientsSummary: '', aiEnriched: false };
  }
}

async function enrichAll(products) {
  console.log(`\n[Step 2] GPT로 ${products.length}개 상품 필드 예측 시작...`);
  const BATCH = 5;
  const enriched = [];

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(enrichProduct));
    batch.forEach((p, j) => enriched.push({ ...p, ...results[j] }));
    console.log(`  → ${Math.min(i + BATCH, products.length)}/${products.length} 완료`);
    if (i + BATCH < products.length) await sleep(500);
  }

  console.log('  → 예측 완료');
  return enriched;
}

// ─────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const raw = await crawlNaver();
  if (raw.length < 5) {
    console.log('[크롤러] 수집된 상품이 너무 적습니다. 기존 데이터를 유지합니다.');
    return;
  }

  const enriched = await enrichAll(raw);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(enriched, null, 2), 'utf-8');
  console.log(`\n[완료] ${enriched.length}개 상품 저장 → ${OUTPUT_PATH}`);
  console.log(`       AI 예측 성공: ${enriched.filter(p => p.aiEnriched).length}개`);
}

main().catch(err => {
  console.error('[오류]', err.message);
  process.exit(1);
});
