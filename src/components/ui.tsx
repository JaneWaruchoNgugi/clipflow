import type { ButtonHTMLAttributes, ComponentPropsWithRef, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  icon,
  block,
  size = 'md',
  className = '',
  children,
  ...rest
}: ComponentPropsWithRef<'button'> & {
  variant?: Variant;
  icon?: IconName;
  block?: boolean;
  size?: 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />}
      {children}
    </button>
  );
}

/** Square icon-only button; `label` is required so screen readers can name it. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; variant?: Variant }) {
  return (
    <button type="button" className={`iconbtn iconbtn--${variant} ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>(props: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => {
        const on = props.value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`seg__opt${on ? ' is-on' : ''}`}
            disabled={props.disabled || o.disabled}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field__head">
        {htmlFor ? (
          <label className="field__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="field__label">{label}</span>
        )}
        {hint && <span className="field__hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
