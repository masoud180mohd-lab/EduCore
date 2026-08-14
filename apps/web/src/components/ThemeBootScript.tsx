/** Runs before paint to avoid light flash when dark theme is stored. */
export function ThemeBootScript() {
  const script = `(function(){try{var t=sessionStorage.getItem('educore-ui-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var l=sessionStorage.getItem('educore-ui-locale');if(l==='sw'||l==='en')document.documentElement.lang=l;}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
