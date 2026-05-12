'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, MapPin } from 'lucide-react';
import { citiesGroupedByProvince, getProvinceByCode } from '@/data/canadian-cities';
import { useCity } from '@/components/city-picker-context';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Props = {
  locale: Locale;
  variant?: 'compact' | 'large';
  className?: string;
};

export function CityPicker({ locale, variant = 'compact', className }: Props) {
  const t = useTranslations('Nav');
  const [open, setOpen] = React.useState(false);
  const { city, setCity } = useCity();
  const grouped = React.useMemo(() => citiesGroupedByProvince(), []);

  const label = city
    ? `${city.name}, ${city.province}`
    : t('selectCity');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-between gap-2',
            variant === 'large' ? 'h-12 w-full max-w-md text-base' : 'h-9',
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 text-forest" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchCity')} />
          <CommandList>
            <CommandEmpty>{t('noCity')}</CommandEmpty>
            {grouped.map(({ province, cities }) => (
              <CommandGroup
                key={province.code}
                heading={province.name[locale]}
              >
                {cities.map((c) => {
                  const provinceName = getProvinceByCode(c.province)?.name[locale] ?? c.province;
                  return (
                    <CommandItem
                      key={c.slug}
                      value={`${c.name} ${provinceName} ${c.province}`}
                      onSelect={() => {
                        setCity(c.slug);
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.province}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
