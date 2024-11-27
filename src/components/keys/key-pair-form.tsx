import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { KeyPair } from '../../types/activationKey';
import { Wand2 } from 'lucide-react';
import { KeyTextarea } from './key-textarea';
import './key-pair-form.css';

export interface KeyPairFormProps {
  mode: 'create' | 'edit';
  keyPair: Partial<KeyPair>;
  onChange: (e: Partial<KeyPair>) => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerateKeys?: () => Promise<void>;
}

export const KeyPairForm: React.FC<KeyPairFormProps> = ({
  mode,
  keyPair,
  onChange,
  onSave,
  onCancel,
  onGenerateKeys
}) => {
  return (
    <div className="space-y-6">
      <Input
        id="name"
        value={keyPair.name || ''}
        onChange={(e) => onChange({ ...keyPair, name: e.target.value })}
        placeholder="Name"
      />

      <KeyTextarea
        id="publicKey"
        value={keyPair.publicKey || ''}
        onChange={(value) => onChange({ ...keyPair, publicKey: value })}
        placeholder="Public Key (PEM)"
      />

      <KeyTextarea
        id="privateKey"
        value={keyPair.privateKey || ''}
        onChange={(value) => onChange({ ...keyPair, privateKey: value })}
        placeholder="Private Key (PEM)"
      />

      <div className="flex justify-end items-center space-x-2">
        {mode === 'create' && onGenerateKeys && (
          <Button
            type="button"
            variant="outline"
            onClick={onGenerateKeys}
            className="mr-auto"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Random Keys
          </Button>
        )}
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave}>
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </div>
  );
}; 
