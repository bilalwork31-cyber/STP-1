import { useEffect, useId, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getPlaces } from '../api';
import type { Place } from '../types';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 3;

interface Props {
  label: string;
  placeholder: string;
  dotClass: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}

export function PlaceInput({ label, placeholder, dotClass, value, invalid, onChange }: Props) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (query.trim().length < MIN_QUERY) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getPlaces(query.trim(), controller.signal)
        .then((places) => {
          setSuggestions(places);
          setActive(-1);
        })
        .catch(() => setSuggestions([]));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (place: Place) => {
    onChange(place.label);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const expanded = open && suggestions.length > 0;

  return (
    <div className="segment relative min-w-0 flex-1">
      <label htmlFor={id} className={`flex items-center gap-1.5 text-[11.5px] font-semibold ${invalid ? 'text-coral' : 'text-ink'}`}>
        <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden />
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="mt-0.5 w-full truncate bg-transparent text-[15px] text-ink placeholder:text-faint focus:outline-none"
      />
      {expanded && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 top-full z-30 mt-3 w-[min(340px,86vw)] overflow-hidden rounded-2xl bg-white py-1.5 shadow-float ring-1 ring-black/5">
          {suggestions.map((place, i) => (
            <li
              key={`${place.label}-${place.lat}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(i)}
              className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-[14px] text-ink ${i === active ? 'bg-canvas' : ''}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-500">
                <MapPin className="size-4" aria-hidden />
              </span>
              <span className="truncate">{place.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
