import React, { useState } from 'react';
import './MemberForm.css';

const SPICINESS_LABELS = ['', '매우 순한 것만', '순한 편', '보통', '매운 것도 OK', '매우 매운 것도 OK'];
const COMMON_ALLERGENS = ['밀', '우유', '달걀', '대두', '돼지고기', '쇠고기', '닭고기', '생선', '갑각류', '견과류', '참깨'];
const COMMON_DISLIKED = ['고수', '파', '마늘', '생강', '양파', '버섯', '해산물', '돼지고기', '김치', '고추'];
const TEXTURE_OPTIONS = ['상관없음', '부드러운 것 선호', '쫄깃한 것 선호', '바삭한 것 선호', '씹히는 것 싫음'];
const PRESET_FAVORITES = ['치킨', '삼겹살', '라면', '초밥', '파스타', '김치찌개', '된장찌개', '불고기', '샐러드', '피자', '떡볶이', '순두부'];
const CUISINE_OPTIONS = ['한식', '일식', '중식', '양식', '분식', '동남아'];
const DIET_OPTIONS = ['상관없음', '다이어트 중', '건강식 선호', '간편식 위주', '채식 위주'];

export default function MemberForm({ member, index, onChange, onRemove, relationOptions }) {
  const [open, setOpen] = useState(index === 0);
  const [foodInput, setFoodInput] = useState('');

  const toggleTag = (field, value) => {
    const current = member[field] || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ [field]: next });
  };

  const addCustomFood = (value) => {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return;
    const current = member.favoriteFoods || [];
    if (!current.includes(trimmed)) {
      onChange({ favoriteFoods: [...current, trimmed] });
    }
    setFoodInput('');
  };

  const handleFoodKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCustomFood(foodInput);
    }
  };

  const removeFood = (food) => {
    onChange({ favoriteFoods: (member.favoriteFoods || []).filter(f => f !== food) });
  };

  const customFoods = (member.favoriteFoods || []).filter(f => !PRESET_FAVORITES.includes(f));

  return (
    <div className="member-form">
      <div className="member-form-header" onClick={() => setOpen(o => !o)}>
        <div className="member-avatar">
          {member.name ? member.name[0] : (index + 1)}
        </div>
        <div className="member-header-info">
          <span className="member-title">
            {member.name || `구성원 ${index + 1}`}
            {member.age ? ` (${member.age}세)` : ''}
          </span>
          <span className="member-relation">{member.relation}</span>
        </div>
        <div className="member-header-actions">
          {onRemove && (
            <button
              type="button"
              className="remove-btn"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >✕</button>
          )}
          <span className={`chevron ${open ? 'open' : ''}`}>▾</span>
        </div>
      </div>

      {open && (
        <div className="member-form-body">

          <div className="form-row two-col">
            <div className="form-group">
              <label>이름 *</label>
              <input
                type="text"
                placeholder="예) 영희"
                value={member.name}
                onChange={e => onChange({ name: e.target.value })}
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label>나이 *</label>
              <input
                type="number"
                placeholder="예) 42"
                value={member.age}
                onChange={e => onChange({ age: e.target.value })}
                min={1}
                max={100}
              />
            </div>
          </div>

          <div className="form-group">
            <label>관계</label>
            <div className="tag-row">
              {relationOptions.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`tag ${member.relation === r ? 'selected' : ''}`}
                  onClick={() => onChange({ relation: r })}
                >{r}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>맵기 허용 수준 <span className="spicy-label">{SPICINESS_LABELS[member.spiciness]}</span></label>
            <div className="spiciness-row">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  type="button"
                  className={`spicy-btn ${member.spiciness >= v ? 'active' : ''}`}
                  onClick={() => onChange({ spiciness: v })}
                >🌶</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>
              좋아하는 음식
              <span className="label-hint">태그 선택 또는 직접 입력</span>
            </label>
            <div className="tag-row wrap">
              {PRESET_FAVORITES.map(f => (
                <button
                  key={f}
                  type="button"
                  className={`tag ${(member.favoriteFoods || []).includes(f) ? 'selected-good' : ''}`}
                  onClick={() => toggleTag('favoriteFoods', f)}
                >{f}</button>
              ))}
            </div>
            <div className="custom-input-row">
              <input
                type="text"
                className="custom-tag-input"
                placeholder="직접 입력 후 Enter  예) 순대국밥, 갈비찜"
                value={foodInput}
                onChange={e => setFoodInput(e.target.value)}
                onKeyDown={handleFoodKeyDown}
              />
              <button type="button" className="add-tag-btn" onClick={() => addCustomFood(foodInput)}>추가</button>
            </div>
            {customFoods.length > 0 && (
              <div className="tag-row wrap" style={{ marginTop: 6 }}>
                {customFoods.map(f => (
                  <span key={f} className="tag selected-good custom-tag">
                    {f}
                    <button type="button" className="custom-tag-remove" onClick={() => removeFood(f)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>선호 음식 종류</label>
            <div className="tag-row wrap">
              {CUISINE_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`tag ${(member.cuisines || []).includes(c) ? 'selected' : ''}`}
                  onClick={() => toggleTag('cuisines', c)}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>식사 스타일</label>
            <div className="tag-row wrap">
              {DIET_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`tag ${member.dietStyle === d ? 'selected' : ''}`}
                  onClick={() => onChange({ dietStyle: d })}
                >{d}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>싫어하는 재료</label>
            <div className="tag-row wrap">
              {COMMON_DISLIKED.map(d => (
                <button
                  key={d}
                  type="button"
                  className={`tag ${(member.disliked || []).includes(d) ? 'selected-bad' : ''}`}
                  onClick={() => toggleTag('disliked', d)}
                >{d}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>알러지</label>
            <div className="tag-row wrap">
              {COMMON_ALLERGENS.map(a => (
                <button
                  key={a}
                  type="button"
                  className={`tag ${(member.allergies || []).includes(a) ? 'selected-bad' : ''}`}
                  onClick={() => toggleTag('allergies', a)}
                >{a}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>선호 식감</label>
            <div className="tag-row wrap">
              {TEXTURE_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`tag ${member.texture === t ? 'selected' : ''}`}
                  onClick={() => onChange({ texture: t })}
                >{t}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>
              한줄 메모
              <span className="label-hint">AI가 참고하는 자유 입력</span>
            </label>
            <textarea
              className="memo-input"
              placeholder="예) 편식이 심해요. 달고 짠 음식 좋아하고 채소는 잘 안 먹어요."
              value={member.memo || ''}
              onChange={e => onChange({ memo: e.target.value })}
              rows={2}
              maxLength={200}
            />
            <span className="char-count">{(member.memo || '').length}/200</span>
          </div>

        </div>
      )}
    </div>
  );
}
