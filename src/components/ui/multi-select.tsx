import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface MultiSelectProps {
  options: { value: string; label: string }[]
  selected?: string[]
  onChange: (selected: string[]) => void
  onInputChange?: (value: string) => void
  placeholder?: string
}

export function MultiSelect({
  options,
  selected = [],
  onChange,
  onInputChange,
  placeholder = "項目を選択...",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleInputChange = (value: string) => {
    setInputValue(value)
    onInputChange?.(value)
  }

  const handleSelect = (currentValue: string) => {
    if (currentValue.startsWith("new-")) {
      const newValue = currentValue.slice(4)
      onChange([...selected, newValue])
      setInputValue("")
    } else {
      onChange(
        selected.includes(currentValue)
          ? selected.filter((item) => item !== currentValue)
          : [...selected, currentValue],
      )
    }
    setOpen(false)
  }

  const filteredOptions = React.useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(inputValue.toLowerCase())),
    [options, inputValue],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">
            {selected && selected.length > 0 ? `${selected.length}個選択済み` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="項目を検索..." value={inputValue} onValueChange={handleInputChange} />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm">
              {inputValue ? (
                <>
                  <p>項目が見つかりません。</p>
                  {!options.some((option) => option.label.toLowerCase() === inputValue.toLowerCase()) && (
                    <button
                      onClick={() => handleSelect(`new-${inputValue}`)}
                      className="px-2 py-1 text-sm text-primary hover:underline"
                    >
                      + "{inputValue}" を新規作成
                    </button>
                  )}
                </>
              ) : (
                "項目が見つかりません。"
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem key={option.value} onSelect={() => handleSelect(option.value)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

