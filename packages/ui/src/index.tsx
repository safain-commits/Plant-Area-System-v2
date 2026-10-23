export { LogoutButton } from './logout';

export {
  ThemeProvider,
  ThemeToggle,
  ThemePreferenceControl,
  type ThemePreference,
  type ResolvedTheme,
} from './theme';
export { ThemeScript } from './theme-script';
export { dataTextTone } from './color';
export { Workspace as Shell } from './workspace';
export { Icon } from './icon';
export { Button } from './button';
export { Select, Input, Textarea, DateTimeField } from './fields';
export { Overlay, Toast } from './overlay';
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export { Dashboard, AnimatedNumber } from './dashboard';

export { useConfirmation } from './confirm';
export { StockSummary } from './stock-summary';
