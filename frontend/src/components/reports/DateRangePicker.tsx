"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { DateRange } from "react-day-picker";
import { useDateFormatting } from "@/contexts/LocalizationContext";
import { getNowInTimezone, formatInStoreTimezone } from "@/utils/timezone";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  initialDateRange?: DateRange;
  onDateChange: (range: DateRange | undefined) => void;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  className,
  initialDateRange,
  onDateChange,
  disabled = false,
}: DateRangePickerProps) {
  const { timezone, dateFormat } = useDateFormatting();
  
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    if (initialDateRange) return initialDateRange;
    
    // Default to last 7 days in store timezone
    const today = getNowInTimezone(timezone);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    return { from: weekAgo, to: today };
  });
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (initialDateRange) {
      setDate(initialDateRange);
    }
  }, [initialDateRange]);

  const handleDateSelect = (selectedRange: DateRange | undefined) => {
    setDate(selectedRange);
    onDateChange(selectedRange);
    // Optionally close popover on date selection, or keep it open for preset changes
    // setIsOpen(false); 
  };
  
  const handlePresetSelect = (presetRange: DateRange) => {
    setDate(presetRange);
    onDateChange(presetRange);
    setIsOpen(false); // Close popover after selecting a preset
  };

  // Generate presets using store timezone
  const presets = React.useMemo(() => {
    const today = getNowInTimezone(timezone);
    return [
      { label: "Today", range: { from: today, to: today } },
      { label: "Yesterday", range: { from: subDays(today, 1), to: subDays(today, 1) } },
      { label: "Last 7 Days", range: { from: subDays(today, 6), to: today } },
      { label: "Last 14 Days", range: { from: subDays(today, 13), to: today } },
      { label: "This Week", range: { from: startOfWeek(today), to: endOfWeek(today) } },
      { label: "Last Week", range: { from: startOfWeek(subDays(today, 7)), to: endOfWeek(subDays(today, 7)) } },
      { label: "This Month", range: { from: startOfMonth(today), to: endOfMonth(today) } },
      { label: "Last Month", range: { from: startOfMonth(subDays(today, 30)), to: endOfMonth(subDays(today, 30)) } },
    ];
  }, [timezone]);

  return (
    <div className={`grid gap-2 ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={`w-full sm:w-[300px] justify-start text-left font-normal ${
              !date && "text-muted-foreground"
            }`}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col space-y-2 border-r border-gray-200 dark:border-border dark:border-gray-700 p-3">
              <span className="text-sm font-medium text-gray-700 dark:text-foreground dark:text-gray-300">Presets</span>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="w-full justify-start text-sm h-8 px-2"
                  onClick={() => handlePresetSelect(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              disabled={disabled}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
