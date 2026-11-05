import React from "react";
import type { LucideIcon } from "lucide-react";
import { Shield, KeyRound, CalendarClock } from "lucide-react";
import { ActivationKeyMetadata } from "../../types/activationKey";
import { formatRelativeTime } from "../../utils/activationKey";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";

interface ActivationKeyMetadataDisplayProps {
  metadata: ActivationKeyMetadata;
  expiryDate?: Date;
  onExpiryChange?: (date: Date | undefined) => void;
  issuedDate?: Date;
  onIssuedChange?: (date: Date | undefined) => void;
}

interface DateFieldProps {
  label: string;
  icon: LucideIcon;
  /** Date shown in the read-only text and as the fallback label of the trigger. */
  fallbackText: string;
  /** Chosen date. When set it replaces `fallbackText` on the trigger. */
  value?: Date;
  /** When given, the date is editable through a calendar popover. */
  onChange?: (date: Date | undefined) => void;
  align?: "start" | "center";
}

const DateField: React.FC<DateFieldProps> = ({
  label,
  icon: Icon,
  fallbackText,
  value,
  onChange,
  align = "center",
}) => (
  <div className="flex flex-col items-center space-y-2">
    <Icon className="h-5 w-5 text-muted-foreground" />
    <div className="text-center">
      <div className="text-sm font-medium">{label}</div>
      {onChange ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="link"
              className="h-auto p-0 text-sm text-muted-foreground hover:no-underline"
            >
              {value ? format(value, "d MMM yyyy") : fallbackText}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align={align}
            aria-label={`Choose the ${label.toLowerCase()} date`}
          >
            <Calendar
              mode="single"
              selected={value}
              defaultMonth={value}
              onSelect={onChange}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      ) : (
        <div className="text-sm text-muted-foreground">
          {value ? format(value, "d MMM yyyy") : fallbackText}
        </div>
      )}
    </div>
  </div>
);

export const ActivationKeyMetadataDisplay: React.FC<ActivationKeyMetadataDisplayProps> = ({
  metadata,
  expiryDate,
  onExpiryChange,
  issuedDate,
  onIssuedChange,
}) => (
  <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
    <div className="flex flex-col items-center space-y-2">
      <Shield className="h-5 w-5 text-muted-foreground" />
      <div className="text-center">
        <div className="text-sm font-medium">Algorithm</div>
        <div className="text-sm text-muted-foreground">{metadata.algorithm}</div>
      </div>
    </div>
    <DateField
      label="Issued"
      icon={KeyRound}
      fallbackText={formatRelativeTime(metadata.issuedAt)}
      value={issuedDate}
      onChange={onIssuedChange}
    />
    <DateField
      label="Expiry"
      icon={CalendarClock}
      fallbackText={formatRelativeTime(metadata.expiresAt, true)}
      value={expiryDate}
      onChange={onExpiryChange}
      align="start"
    />
  </div>
);
