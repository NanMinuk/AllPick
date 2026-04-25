const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { Langfuse } = require('langfuse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

function loadProducts() {
  const filePath = path.join(__dirname, '../data/products.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadEmbeddings() {
  const filePath = path.join(__dirname, '../data/embeddings.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function retrieveTopK(queryText, products, embeddings, k = 20) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: queryText,
  });
  const queryVec = response.data[0].embedding;

  return products
    .filter(p => embeddings[p.id])
    .map(p => ({ product: p, score: cosineSimilarity(queryVec, embeddings[p.id]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(r => r.product);
}

const SPICINESS_TEXT = [
  '', '매우 순한 것만 먹는', '순한 편인', '중간 정도 맵기인', '매운 것도 잘 먹는', '아주 매운 것도 즐기는'
];

function memberToNaturalLanguage(m) {
  const sentences = [];

  const relation = m.relation || '가족';
  const base = `${relation}(${m.age}세)`;

  const likes = [];
  if ((m.favoriteFoods || []).length > 0) likes.push(`${m.favoriteFoods.join(', ')} 등을 좋아함`);
  if ((m.cuisines || []).length > 0) likes.push(`${m.cuisines.join(', ')} 스타일 선호`);
  if (m.dietStyle && m.dietStyle !== '상관없음') likes.push(m.dietStyle);

  sentences.push(
    `${base}는 ${SPICINESS_TEXT[m.spiciness] || '중간 정도 맵기인'} 사람으로` +
    (likes.length > 0 ? `, ${likes.join(', ')}합니다.` : '.')
  );

  if ((m.disliked || []).length > 0) {
    sentences.push(`${m.disliked.join(', ')}은(는) 싫어합니다.`);
  }

  if ((m.allergies || []).length > 0) {
    sentences.push(`${m.allergies.join(', ')} 알러지가 있어 해당 성분이 포함된 식품은 절대 피해야 합니다.`);
  }

  if (m.texture && m.texture !== '상관없음') {
    sentences.push(`식감은 ${m.texture}.`);
  }

  if (m.memo) {
    sentences.push(`참고: ${m.memo}`);
  }

  return sentences.join(' ');
}

function familyToNaturalLanguage(members) {
  return members.map((m, i) => `[구성원 ${i + 1}] ${memberToNaturalLanguage(m)}`).join('\n');
}

const ALLERGEN_KEYWORDS = {
  '밀':     ['밀', '우동', '파스타', '라면', '만두', '빵', '과자', '쿠키', '튀김'],
  '우유':   ['우유', '치즈', '버터', '크림', '요거트', '라떼', '유제품'],
  '달걀':   ['계란', '달걀', '에그'],
  '대두':   ['두부', '된장', '콩', '간장', '청국장', '두유'],
  '돼지고기': ['돼지', '삼겹', '베이컨', '햄', '소시지'],
  '쇠고기': ['쇠고기', '소고기', '불고기', '갈비', '스테이크'],
  '닭고기': ['닭', '치킨'],
  '생선':   ['참치', '연어', '고등어', '갈치', '명란', '어묵', '멸치'],
  '갑각류': ['새우', '게', '랍스터'],
  '견과류': ['땅콩', '아몬드', '호두', '캐슈', '피스타치오', '견과'],
  '참깨':   ['참깨', '참기름'],
};

function findAllergenInProduct(product, memberAllergens) {
  if (product.allergens && product.allergens.length > 0) {
    const match = memberAllergens.find(a => product.allergens.includes(a));
    if (match) return match;
  }
  for (const allergen of memberAllergens) {
    const keywords = ALLERGEN_KEYWORDS[allergen] || [allergen];
    if (keywords.some(kw => product.name.includes(kw))) return allergen;
  }
  return null;
}

function getFamilyAllergens(members) {
  return [...new Set(members.flatMap(m => m.allergies || []))];
}

const RECOMMEND_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: '상품 목록에서 키워드나 카테고리로 상품을 검색합니다. 여러 번 호출해 다양한 조건으로 탐색할 수 있습니다.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '상품명에서 검색할 키워드 (예: 치킨, 샐러드)' },
          category: { type: 'string', enum: ['간편식', '가공식품', '신선식품'], description: '카테고리 필터' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finalize_recommendation',
      description: '탐색 완료 후 가족 모두에게 적합한 최종 추천 상품을 확정합니다.',
      parameters: {
        type: 'object',
        properties: {
          product_ids: {
            type: 'array',
            items: { type: 'string' },
            description: '추천할 상품 ID 목록. 가장 적합한 순서대로 정렬해 최소 8개 이상 포함할 것.',
          },
          reasoning: {
            type: 'string',
            description: '추천 이유 요약 (한국어 2~3문장). 반드시 구체적인 맛·식감·재료 특성으로 설명할 것. "한식/일식/양식" 같은 카테고리명 언급 금지. 대신 "담백한 맛", "부드러운 식감", "닭고기 베이스라 좋아할 듯", "짜지 않아 아이도 먹기 좋은" 처럼 실제 식품 특성으로 쓰고, 가족 프로필과 어떻게 연결되는지 구체적으로 언급.',
          },
        },
        required: ['product_ids', 'reasoning'],
      },
    },
  },
];

function executeTool(name, args, products) {
  if (name === 'search_products') {
    let result = [...products];
    if (args.keyword) {
      result = result.filter(p => p.name.includes(args.keyword) || (p.brand || '').includes(args.keyword));
    }
    if (args.category) {
      result = result.filter(p => p.category === args.category);
    }
    if (result.length === 0) return '검색 결과 없음';
    return result.map(p =>
      `[${p.id}] ${p.name} | 카테고리:${p.category} | 브랜드:${p.brand || '정보없음'} | 판매처:${p.mallName || '정보없음'}`
    ).join('\n');
  }
  return '';
}

async function runRecommendAgent(messages, products, trace, maxSteps = 6) {
  for (let step = 0; step < maxSteps; step++) {
    const generation = trace.generation({
      name: `agent-step-${step + 1}`,
      model: 'gpt-4o',
      input: messages,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: RECOMMEND_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
    });

    const choice = response.choices[0];
    generation.end({
      output: choice.message,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    });

    messages.push(choice.message);

    if (choice.finish_reason === 'stop') break;

    if (choice.finish_reason === 'tool_calls') {
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === 'finalize_recommendation') {
          return args;
        }

        const result = executeTool(toolCall.function.name, args, products);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }
  }
  return null;
}

router.post('/recommend', async (req, res) => {
  try {
    const { members } = req.body;
    if (!members || members.length === 0) {
      return res.status(400).json({ error: '가족 프로필이 필요합니다.' });
    }

    const allProducts = loadProducts();
    const embeddings = loadEmbeddings();
    const familyAllergens = getFamilyAllergens(members);
    const familyProfile = familyToNaturalLanguage(members);

    const safeProducts = allProducts.filter(p => !findAllergenInProduct(p, familyAllergens));

    const trace = langfuse.trace({
      name: 'recommend-two-stage',
      input: { memberCount: members.length, familyProfile },
    });

    const stage1 = trace.span({ name: 'stage1-embedding-retrieval' });
    const candidates = await retrieveTopK(familyProfile, safeProducts, embeddings, 20);
    stage1.end({ output: { candidateCount: candidates.length } });

    const candidateList = candidates.map(p =>
      `[${p.id}] ${p.name} | ${p.category} | ${p.ingredientsSummary || ''}`
    ).join('\n');

    const stage2 = trace.generation({
      name: 'stage2-llm-reranking',
      model: 'gpt-4o',
      input: { familyProfile, candidateCount: candidates.length },
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `당신은 가족 식품 추천 AI입니다. 후보 상품 중 가족에게 가장 적합한 상품을 골라 추천 순서대로 정렬하세요.
알러지 위험 상품은 이미 제거됐습니다.

[판단 원칙]
- 싫어하는 재료가 상품명에 명확히 포함되면 제외
- 가족 중 가장 어린 구성원의 맵기 수준에 맞춰야 함
- 좋아하는 음식/취향에서 맛·식감 선호도를 유추해 추천
- 간편식·가공식품·신선식품 카테고리에서 고르게 구성 (카테고리별 최대 3개)

[reasoning 작성 규칙]
- "한식/일식/양식" 같은 카테고리명 언급 금지
- 구체적인 맛·식감·재료 특성으로 설명
- 가족 중 누구의 어떤 선호와 맞는지 명시

아래 JSON으로만 응답하세요:
{"product_ids": ["p001", ...], "reasoning": "..."}`,
        },
        {
          role: 'user',
          content: `[가족 프로필]\n${familyProfile}\n\n[후보 상품]\n${candidateList}`,
        },
      ],
    });

    stage2.end({
      output: completion.choices[0].message.content,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    const pickedIds = result.product_ids || [];
    const llmPicks = pickedIds
      .map(id => candidates.find(p => p.id === id))
      .filter(Boolean);

    const MIN = 8;
    const MAX_PER_CAT = 3;
    const catCounts = {};
    const primary = [];
    const deferred = [];

    for (const p of llmPicks) {
      catCounts[p.category] = (catCounts[p.category] || 0);
      if (catCounts[p.category] < MAX_PER_CAT) {
        primary.push(p);
        catCounts[p.category]++;
      } else {
        deferred.push(p);
      }
    }

    const recommended = [...primary, ...deferred];

    if (recommended.length < MIN) {
      const usedIds = new Set(recommended.map(p => p.id));
      const extras = safeProducts
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => (catCounts[a.category] || 0) - (catCounts[b.category] || 0))
        .slice(0, MIN - recommended.length);
      extras.forEach(p => {
        recommended.push(p);
        catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      });
    }

    trace.update({ output: { recommendedCount: recommended.length } });
    await langfuse.flushAsync();

    res.json({ recommended, reasoning: result.reasoning || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI 추천에 실패했습니다.' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { productId, members } = req.body;
    if (!productId || !members || members.length === 0) {
      return res.status(400).json({ error: '상품 ID와 가족 프로필이 필요합니다.' });
    }

    const trace = langfuse.trace({
      name: 'analyze',
      input: { productId, memberCount: members.length },
    });

    const products = loadProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return res.status(404).json({ error: '상품을 찾을 수 없습니다.' });

    const productInfo = `상품명: ${product.name}
카테고리: ${product.category}
브랜드: ${product.brand || '정보없음'}
판매처: ${product.mallName || '정보없음'}`;

    const memberPromises = members.map(async (member) => {
      const matchedAllergen = findAllergenInProduct(product, member.allergies || []);
      if (matchedAllergen) {
        return {
          memberId: member.id,
          name: member.name,
          age: member.age,
          suitable: false,
          status: 'bad',
          reason: `${matchedAllergen} 알러지 성분 포함 의심`,
          warning: '구매 전 성분표 확인 필수',
        };
      }

      const memberProfile = memberToNaturalLanguage(member);

      const prompt = `당신은 가족 식품 적합성 판단 AI입니다.
상품의 상세 성분 정보가 없으므로, 상품명에서 명확히 파악되는 정보만 사용하세요.

[절대 규칙]
- 상품명에서 명확히 확인되는 정보만 사용, 불확실한 재료는 절대 가정하지 마세요.
- 알러지/싫어하는 재료가 상품명에 명확히 포함될 때만 bad/caution 판정하세요.
- 불확실하면 reason에 "성분 정보 부족 — 구매 전 확인 필요"를 포함하세요.
- reason과 detail에서 이름 대신 관계(아들, 딸, 남편, 본인 등)로 지칭하세요.
- reason과 detail에서 "한식/일식/양식" 같은 카테고리명 대신 구체적인 맛·재료·식감으로 설명하세요.
- 구성원 프로필 문구를 그대로 복붙하지 마세요. 반드시 상품 특성과 연결해 설명하세요.

[판단 단계 — 응답 전 내부적으로 순서대로 생각할 것]
1. 상품명에서 파악 가능한 특성 추출: 주재료, 맛(순한/매운/달콤/짠), 식감, 조리방식
2. 구성원의 제한사항(알러지, 기피재료, 맵기 한계)과 충돌 여부 확인
3. 구성원의 선호(좋아하는 음식, 식감)와의 매칭도 평가
4. 위 분석을 바탕으로 status 결정 후 reason/detail 작성

[판단 우선순위]
1. 알러지: 상품명에서 명확히 확인되면 → bad
2. 싫어하는 재료: 상품명에서 명확히 확인되면 → caution 또는 bad
3. 맵기: 상품명에서 유추 가능하면 허용 수준과 비교
4. 취향 적합성: 프로필의 선호와 맞으면 → good, 무관하면 → caution

[좋은 응답 예시]
상품명 "비비고 크림 떡볶이", 구성원: 아들(7세, 맵기 1단계, 부드러운 식감 선호)
→ {
  "suitable": true, "status": "good",
  "reason": "크림 소스라 아이 맵기에 적합",
  "warning": null,
  "detail": "크림 베이스 떡볶이는 일반 떡볶이보다 맵기가 현저히 낮습니다. 아들의 맵기 허용 수준(매우 순함)에 부합하며, 쫄깃한 떡 식감이 부드러운 식감 선호와도 잘 맞습니다."
}

[나쁜 응답 예시 — 절대 금지]
→ { "reason": "한식 스타일 선호", "detail": "한식을 좋아해서 적합합니다." }
(프로필 복붙, 상품 특성 분석 없음 — 이런 응답은 절대 하지 마세요)

[상품 정보]
${productInfo}

[구성원 프로필]
${memberProfile}

[응답 필드 설명]
- suitable: 적합 여부 (boolean)
- status: "good" / "caution" / "bad"
- reason: 판정 이유 요약, 30자 이내. 상품명에서 파악한 구체적 특성으로 설명.
- warning: 주의사항이 있으면 15자 이내, 없으면 null
- detail: 판단 근거 2~3문장. 상품의 맛·재료·맵기 특성이 이 구성원의 프로필과 어떻게 맞거나 맞지 않는지 구체적으로 서술. 불확실한 정보는 "성분 정보 미확인" 명시.

아래 JSON 형식으로만 응답하세요:
{
  "suitable": true,
  "status": "good",
  "reason": "...",
  "warning": null,
  "detail": "..."
}`;

      const generation = trace.generation({
        name: `analyze-${member.relation || member.name}`,
        model: 'gpt-4o',
        input: prompt,
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      generation.end({
        output: completion.choices[0].message.content,
        usage: {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        },
      });

      const result = JSON.parse(completion.choices[0].message.content);
      return { memberId: member.id, name: member.name, age: member.age, ...result };
    });

    const analyses = await Promise.all(memberPromises);
    trace.update({ output: { productId, memberCount: members.length } });
    await langfuse.flushAsync();

    res.json({ productId, analyses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI 분석에 실패했습니다.' });
  }
});

module.exports = router;
