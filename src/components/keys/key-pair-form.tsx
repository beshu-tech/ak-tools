import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { KeyPair } from '../../types/activationKey';
import { Wand2 } from 'lucide-react';
import '../pages/Keys.css';

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
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={keyPair.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My Key Pair"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="publicKey">Public Key (PEM)</Label>
          {mode === 'create' && onGenerateKeys && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerateKeys}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Random Keys in your browser
            </Button>
          )}
        </div>
        <Textarea
          id="publicKey"
          value={keyPair.publicKey || ''}
          onChange={(e) => onChange({ publicKey: e.target.value })}
          placeholder="-----BEGIN PUBLIC KEY-----"
          className="key-textarea"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="privateKey">Private Key (PEM)</Label>
        <Textarea
          id="privateKey"
          value={keyPair.privateKey || ''}
          onChange={(e) => onChange({ privateKey: e.target.value })}
          placeholder="-----BEGIN PRIVATE KEY-----"
          className="key-textarea"
        />
      </div>

      <div className="flex justify-end space-x-2">
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
