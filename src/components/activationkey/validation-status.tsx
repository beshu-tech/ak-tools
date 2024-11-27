import React from 'react';
import { Check, X } from 'lucide-react';
import { ValidationResult } from '../../types/activationKey';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface ValidationStatusProps {
  validation: ValidationResult | null;
}

export const ValidationStatus: React.FC<ValidationStatusProps> = ({ validation }) => {
  if (!validation) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="validation-status-icon">
            {validation.isValid ? (
              <Check className="h-6 w-6 text-green-500" />
            ) : (
              <X className="h-6 w-6 text-destructive" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {validation.isValid 
              ? "Signature is valid" 
              : validation.error || "Cannot validate signature"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 