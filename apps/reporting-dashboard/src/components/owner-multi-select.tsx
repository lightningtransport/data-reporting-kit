"use client"

import { useState } from "react"
import { ChevronsUpDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

type OwnerMultiSelectProps = {
  owners: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function OwnerMultiSelect({
  owners,
  selected,
  onChange,
}: OwnerMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedSet = new Set(selected)
  const label =
    selected.length === owners.length
      ? "Todos los owners"
      : selected.length === 0
        ? "Ningún owner"
        : `${selected.length} de ${owners.length}`

  function toggle(owner: string) {
    if (selectedSet.has(owner)) {
      onChange(selected.filter((value) => value !== owner))
      return
    }
    onChange([...selected, owner])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-56 justify-between font-normal"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{label}</span>
          <Badge variant="secondary">{selected.length}</Badge>
        </span>
        <ChevronsUpDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <PopoverHeader className="sr-only">
          <PopoverTitle>Owner / equipo</PopoverTitle>
        </PopoverHeader>
        <Command>
          <CommandInput placeholder="Buscar owner…" />
          <div className="flex gap-2 border-b px-2 py-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => onChange(owners)}
            >
              Todos
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onChange([])}>
              Ninguno
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>Sin owners.</CommandEmpty>
            <CommandGroup>
              {owners.map((owner) => {
                const isSelected = selectedSet.has(owner)
                return (
                  <CommandItem
                    key={owner}
                    value={owner}
                    data-checked={isSelected ? "true" : undefined}
                    className="[&>svg:last-child]:hidden"
                    onMouseDown={(event) => event.preventDefault()}
                    onSelect={() => toggle(owner)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    {owner}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
