import React from 'react'
import { useTheme } from '../context/ThemeContext'

export default function AccessibilityControls() {
  const { theme, toggleTheme, fontSize, setFontSize } = useTheme()

  return (
    <div className="flex items-center gap-4 p-2 rounded-lg bg-gray-100 dark-mode:bg-gray-800 border border-gray-200 dark-mode:border-gray-700">
      {/* Botones Modo Claro / Oscuro */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => toggleTheme('light')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            theme === 'light'
              ? 'bg-white text-gray-900 shadow font-bold'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          ☀️ Claro
        </button>
        <button
          type="button"
          onClick={() => toggleTheme('dark')}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            theme === 'dark'
              ? 'bg-gray-900 text-white shadow font-bold'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          🌙 Oscuro
        </button>
      </div>

      <div className="h-4 w-px bg-gray-300" />

      {/* Botones Tamaños de Texto */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Texto:</span>
        <button
          type="button"
          onClick={() => setFontSize('small')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            fontSize === 'small' ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 text-gray-700'
          }`}
        >
          A-
        </button>
        <button
          type="button"
          onClick={() => setFontSize('medium')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            fontSize === 'medium' ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 text-gray-700'
          }`}
        >
          A
        </button>
        <button
          type="button"
          onClick={() => setFontSize('large')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            fontSize === 'large' ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 text-gray-700'
          }`}
        >
          A+
        </button>
      </div>
    </div>
  )
}