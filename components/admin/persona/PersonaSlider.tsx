"use client";

type PersonaSliderProps = {
  label: string;
  valueLabel: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  onChange: (value: number) => void;
};

export function PersonaSlider({
  label,
  valueLabel,
  minLabel,
  maxLabel,
  value,
  onChange,
}: PersonaSliderProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-stone-900">{label}</span>
        <span className="text-sm font-semibold text-accent">{valueLabel}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.25)]
          [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${value}%, #e7e5e4 ${value}%)`,
        }}
      />

      <div className="mt-1.5 flex justify-between text-xs text-stone-400">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
