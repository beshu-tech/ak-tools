import React from 'react';
import { Textarea } from '../ui/textarea';
import './key-pair-form.css';

interface KeyTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const KeyTextarea: React.FC<KeyTextareaProps> = ({
  id,
  value,
  onChange,
  placeholder
}) => {
  return (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="key-textarea"
    />
  );
}; 