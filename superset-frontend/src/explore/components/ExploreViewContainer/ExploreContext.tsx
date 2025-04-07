// @ts-nocheck
import React, { createContext, useState, useContext } from 'react';

export const ExploreContext = createContext({
  isAdmin: false,
  setIsAdmin: () => {},
});

export const useExploreContext = () => useContext(ExploreContext);

export const ExploreProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <ExploreContext.Provider value={{ isAdmin, setIsAdmin }}>
      {children}
    </ExploreContext.Provider>
  );
};
