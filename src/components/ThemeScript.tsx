/**
 * Applies the stored theme before first paint. Without this the page renders
 * dark and then flips to light, which is worse than either theme.
 *
 * It also writes `<meta name="theme-color">` itself rather than declaring it in
 * the viewport export: the app's theme comes from localStorage, not from the OS
 * preference, so a static value — or one keyed to prefers-color-scheme — would
 * leave a phone's address bar the wrong colour for anyone who has toggled.
 */
export function ThemeScript() {
  const script = `try{var l=localStorage.getItem('bb-theme')==='light';if(l){document.documentElement.dataset.theme='light'}var m=document.createElement('meta');m.name='theme-color';m.content=l?'#f7f8f7':'#0a0c0b';document.head.appendChild(m)}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
