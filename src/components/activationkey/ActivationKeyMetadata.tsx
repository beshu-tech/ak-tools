import React from 'react';
import { Shield, KeyRound, CalendarClock } from 'lucide-react';
import { ActivationKeyMetadata } from '../../types/activationKey';
import { formatRelativeTime } from '../../utils/activationKey';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';

interface ActivationKeyMetadataDisplayProps {
  metadata: ActivationKeyMetadata;
  expiryDate?: Date;
  onExpiryChange?: (date: Date | undefined) => void;
  issuedDate?: Date;
  onIssuedChange?: (date: Date | undefined) => void;
}

export const ActivationKeyMetadataDisplay: React.FC<ActivationKeyMetadataDisplayProps> = ({
  metadata,
  expiryDate,
  onExpiryChange,
  issuedDate,
  onIssuedChange,
}) => {
  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
      <div className="flex flex-col items-center space-y-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-sm font-medium">Algorithm</div>
          <div className="text-sm text-muted-foreground">
            {metadata.algorithm}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-sm font-medium">Issued</div>
          {onIssuedChange ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground hover:no-underline">
                  {issuedDate ? format(issuedDate, 'd MMM yyyy') : formatRelativeTime(metadata.issuedAt)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={issuedDate}
                  onSelect={onIssuedChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="text-sm text-muted-foreground">
              {formatRelativeTime(metadata.issuedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-2">
        <CalendarClock className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <div className="text-sm font-medium">Expiry</div>
          {onExpiryChange ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-sm text-muted-foreground hover:no-underline">
                  {expiryDate ? format(expiryDate, 'd MMM yyyy') : formatRelativeTime(metadata.expiresAt, true)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={onExpiryChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="text-sm text-muted-foreground">
              {formatRelativeTime(metadata.expiresAt, true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 