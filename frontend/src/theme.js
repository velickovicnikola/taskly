const STORAGE_KEY = 'taskly_theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

// 'light', 'dark' or 'system'
export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'system' ? saved : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage not available, the theme just won't be remembered
  }
  applyTheme(theme);
}

// While "system" is selected, follow the device when it switches between light and dark
media.addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme('system');
});