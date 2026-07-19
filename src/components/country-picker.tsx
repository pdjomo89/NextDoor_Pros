'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { useCity } from '@/components/city-picker-context';
import { allMarkets, type CountryCode } from '@/lib/markets';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Props = {
  locale: Locale;
  className?: string;
};

/** Switches the active market (country). Scopes the city picker + browse/board. */
export function CountryPicker({ locale, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const { country, setCountry } = useCity();
  const markets = allMarkets();

  // A single market means nothing to switch between — hide the control.
  if (markets.length < 2) return null;

  const active = markets.find((m) => m.country === country) ?? markets[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-9 justify-between gap-2', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Globe className="h-4 w-4 text-forest" />
            <span className="truncate">{active.name[locale]}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {markets.map((m) => (
                <CommandItem
                  key={m.country}
                  value={m.name[locale]}
                  onSelect={() => {
                    setCountry(m.country as CountryCode);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1">{m.name[locale]}</span>
                  {m.country === country && (
                    <Check className="h-4 w-4 text-forest" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
