import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamily } from '../context/FamilyContext.jsx';
import MemberForm from '../components/MemberForm.jsx';
import './SetupPage.css';

const RELATION_OPTIONS = ['본인', '남편/아내', '아들', '딸', '어머니', '아버지', '기타'];

function createMember(id) {
  return {
    id: String(id),
    name: '',
    relation: '본인',
    age: '',
    spiciness: 3,
    disliked: [],
    allergies: [],
    texture: '',
    favoriteFoods: [],
    cuisines: [],
    dietStyle: '상관없음',
    memo: '',
  };
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { saveMembers, members: existingMembers } = useFamily();

  const [members, setMembers] = useState(
    existingMembers.length > 0 ? existingMembers : [createMember(1)]
  );
  const [saving, setSaving] = useState(false);

  const addMember = () => {
    setMembers(prev => [...prev, createMember(Date.now())]);
  };

  const removeMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateMember = (id, updates) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = members.every(m => m.name.trim() && m.age);
    if (!valid) {
      alert('모든 구성원의 이름과 나이를 입력해주세요.');
      return;
    }
    setSaving(true);
    await saveMembers(members);
    setSaving(false);
    navigate('/');
  };

  return (
    <div className="setup-page">
      <div className="setup-header">
        <div className="setup-logo">🛒</div>
        <h1>우리 가족 장보기 AI</h1>
        <p>가족 구성원의 입맛을 등록하면<br />AI가 딱 맞는 식품을 추천해드려요</p>
      </div>

      <form className="setup-form" onSubmit={handleSubmit}>
        <div className="setup-section-title">
          <span>가족 구성원 입력</span>
          <span className="member-count">{members.length}명</span>
        </div>

        <div className="members-list">
          {members.map((member, idx) => (
            <MemberForm
              key={member.id}
              member={member}
              index={idx}
              onChange={(updates) => updateMember(member.id, updates)}
              onRemove={members.length > 1 ? () => removeMember(member.id) : null}
              relationOptions={RELATION_OPTIONS}
            />
          ))}
        </div>

        <button type="button" className="add-member-btn" onClick={addMember}>
          + 구성원 추가
        </button>

        <div className="setup-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '저장 중...' : '가족 프로필 저장 및 시작하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
