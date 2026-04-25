import React, { createContext, useContext, useState, useEffect } from 'react';
import { familyApi } from '../api/index.js';

const FamilyContext = createContext(null);

export function FamilyProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const local = localStorage.getItem('family_profile');
    if (local) {
      try {
        setMembers(JSON.parse(local));
      } catch {
        // empty
      }
    }
    familyApi.get()
      .then(data => {
        if (data.members && data.members.length > 0) {
          setMembers(data.members);
          localStorage.setItem('family_profile', JSON.stringify(data.members));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const saveMembers = async (newMembers) => {
    setMembers(newMembers);
    localStorage.setItem('family_profile', JSON.stringify(newMembers));
    try {
      await familyApi.save(newMembers);
    } catch {
      // empty
    }
  };

  const hasFamily = members.length > 0;

  return (
    <FamilyContext.Provider value={{ members, saveMembers, hasFamily, loaded }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be inside FamilyProvider');
  return ctx;
}
