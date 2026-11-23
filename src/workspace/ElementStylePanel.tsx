import { Check } from 'lucide-react';

export type ElementColor = 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple' | 'red';
export type ElementStyleMode = 'subtle' | 'outline' | 'tinted';

export const elementColors: Array<{ id: ElementColor; label: string; value: string }> = [
  { id: 'gray', label: 'Gray', value: '#969696' },
  { id: 'blue', label: 'Blue', value: '#5f91ef' },
  { id: 'green', label: 'Green', value: '#4eb889' },
  { id: 'yellow', label: 'Yellow', value: '#edb84c' },
  { id: 'orange', label: 'Orange', value: '#ed7d3e' },
  { id: 'purple', label: 'Purple', value: '#ad74e5' },
  { id: 'red', label: 'Red', value: '#e56878' },
];

export const elementStyleModes: Array<{ id: ElementStyleMode; label: string }> = [
  { id: 'subtle', label: 'Subtle' },
  { id: 'outline', label: 'Outline' },
  { id: 'tinted', label: 'Tinted' },
];

export function elementColorValue(color: ElementColor = 'gray') {
  return elementColors.find((option) => option.id === color)?.value ?? elementColors[0].value;
}

export function ElementStylePanel({
  color = 'gray',
  mode = 'subtle',
  onColorChange,
  onModeChange,
}: {
  color?: ElementColor;
  mode?: ElementStyleMode;
  onColorChange: (color: ElementColor) => void;
  onModeChange: (mode: ElementStyleMode) => void;
}) {
  return (
    <div className="element-style-panel" aria-label="Color and style">
      <div className="color-options" role="group" aria-label="Color">
        {elementColors.map((option) => (
          <button
            type="button"
            className="color-swatch"
            aria-label={option.label}
            aria-pressed={option.id === color}
            key={option.id}
            style={{ backgroundColor: option.value }}
            onClick={() => onColorChange(option.id)}
          >
            {option.id === color ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div className="style-mode-options" role="group" aria-label="Style">
        {elementStyleModes.map((option) => (
          <button
            type="button"
            className={`style-mode${option.id === mode ? ' is-current' : ''}`}
            aria-pressed={option.id === mode}
            key={option.id}
            onClick={() => onModeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
