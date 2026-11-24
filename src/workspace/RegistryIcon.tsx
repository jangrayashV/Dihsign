import { CircleHelp } from 'lucide-react';
import type { ComponentDefinition } from './componentRegistry';

export function RegistryIcon({
  definition,
  size,
  strokeWidth = 1.6,
}: {
  definition: ComponentDefinition;
  size: number;
  strokeWidth?: number;
}) {
  if (definition.iconAsset) {
    return (
      <img
        className={`registry-technology-logo${definition.iconTreatment === 'light-surface' ? ' needs-light-surface' : ''}`}
        src={definition.iconAsset}
        width={size}
        height={size}
        alt=""
        draggable={false}
        aria-hidden="true"
      />
    );
  }

  const Icon = definition.icon ?? CircleHelp;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
