import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('app-fontsize') || 'medium')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark-mode')
    } else {
      root.classList.remove('dark-mode')
    }
    localStorage.setItem('app-theme', theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-font-size', fontSize)
    localStorage.setItem('app-fontsize', fontSize)
  }, [fontSize])

  const toggleTheme = (newTheme) => setTheme(newTheme)

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)