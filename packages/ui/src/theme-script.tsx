// Runs synchronously in <head>, before page content can paint. Only trusted constants are embedded.
const initialization = `(function(){var p='system';try{var v=localStorage.getItem('plant-ui-theme');if(v==='light'||v==='dark')p=v;}catch(e){}var r=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=r;document.documentElement.dataset.themePreference=p;})();`;

export function ThemeScript() {
  return <script id="plant-theme-init" dangerouslySetInnerHTML={{ __html: initialization }} />;
}
