/**
 * Applies the stored theme before first paint. Without this the page renders
 * dark and then flips to light, which is worse than either theme.
 */
export function ThemeScript() {
  const script = `try{if(localStorage.getItem('bb-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
