import type { ReactNode } from 'react';

import { Switch } from './ui';

export function SettingSwitchCard({
  title,
  description,
  checked,
  onChange,
  statusText,
  impact,
  disabled,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  statusText: string;
  impact: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="card switch-card">
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={title}
        description={description}
        statusText={statusText}
      />
      <div className="callout callout-neutral">{impact}</div>
      {children}
    </div>
  );
}
