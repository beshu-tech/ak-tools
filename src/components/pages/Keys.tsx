import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Download, Upload } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

import { Label } from '../ui/label';
import { PageHeader } from '../ui/page-header';
import { KeyPair } from '../../types/activationKey';
import { KeyPairForm } from '../keys/key-pair-form';
import { validatePublicKey } from '../../utils/key-validation';
import { validatePrivateKey } from '../../utils/key-validation';
import { generateEC512KeyPair } from '../../utils/activationKey';
import { exportKeyPairToZip, importKeyPairFromZip } from '../../utils/file-utils';
import './Keys.css';

const Keys = () => {
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newKeyPair, setNewKeyPair] = useState<Omit<KeyPair, 'id'>>({
    name: '',
    publicKey: '',
    privateKey: '',
    createdAt: '',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKeyPair, setEditingKeyPair] = useState<KeyPair | null>(null);

  useEffect(() => {
    const savedKeys = localStorage.getItem('keyPairs');
    if (savedKeys) {
      setKeyPairs(JSON.parse(savedKeys));
    }
  }, []);

  const handleSave = async () => {
    try {
      const trimmedKeyPair = {
        name: newKeyPair.name.trim(),
        publicKey: newKeyPair.publicKey.trim(),
        privateKey: newKeyPair.privateKey.trim(),
      };

      if (!trimmedKeyPair.name || !trimmedKeyPair.publicKey || !trimmedKeyPair.privateKey) {
        alert('Please fill in all fields');
        return;
      }

      const privateKeyError = validatePrivateKey(trimmedKeyPair.privateKey);
      if (privateKeyError) {
        alert(privateKeyError);
        return;
      }

      const publicKeyError = validatePublicKey(trimmedKeyPair.publicKey);
      if (publicKeyError) {
        alert(publicKeyError);
        return;
      }

      const newPair: KeyPair = {
        ...trimmedKeyPair,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      const updatedPairs = [...keyPairs, newPair];
      setKeyPairs(updatedPairs);
      localStorage.setItem('keyPairs', JSON.stringify(updatedPairs));
      
      setIsAddingNew(false);
      setNewKeyPair({ name: '', publicKey: '', privateKey: '', createdAt: '' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error saving key pair');
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this key pair?')) {
      const updatedPairs = keyPairs.filter(pair => pair.id !== id);
      setKeyPairs(updatedPairs);
      localStorage.setItem('keyPairs', JSON.stringify(updatedPairs));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleEdit = (pair: KeyPair) => {
    if (editingId === pair.id) {
      setEditingId(null);
      setEditingKeyPair(null);
    } else {
      setEditingId(pair.id);
      setEditingKeyPair(pair);
    }
  };

  const handleUpdateKey = () => {
    if (!editingKeyPair?.name || !editingKeyPair?.publicKey || !editingKeyPair?.privateKey) {
      alert('Please fill in all fields');
      return;
    }

    const trimmedKeyPair = {
      ...editingKeyPair,
      name: editingKeyPair.name.trim(),
      publicKey: editingKeyPair.publicKey.trim(),
      privateKey: editingKeyPair.privateKey.trim(),
    };

    const privateKeyError = validatePrivateKey(trimmedKeyPair.privateKey);
    if (privateKeyError) {
      alert(privateKeyError);
      return;
    }

    const publicKeyError = validatePublicKey(trimmedKeyPair.publicKey);
    if (publicKeyError) {
      alert(publicKeyError);
      return;
    }

    const updatedPairs = keyPairs.map(pair => 
      pair.id === trimmedKeyPair.id ? trimmedKeyPair : pair
    );
    setKeyPairs(updatedPairs);
    localStorage.setItem('keyPairs', JSON.stringify(updatedPairs));
    setEditingId(null);
    setEditingKeyPair(null);
  };

  const handleGenerateKeys = async () => {
    try {
      const generatedPair = await generateEC512KeyPair();
      setNewKeyPair({
        name: generatedPair.name,
        publicKey: generatedPair.publicKey,
        privateKey: generatedPair.privateKey,
        createdAt: generatedPair.createdAt
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error generating key pair');
    }
  };

  const handleExport = async (pair: KeyPair) => {
    try {
      await exportKeyPairToZip(pair);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error exporting key pair');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedPair = await importKeyPairFromZip(file);
      setNewKeyPair({
        ...importedPair,
        createdAt: new Date().toISOString(),
      });
      setIsAddingNew(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error importing key pair');
    }
    
    // Reset the input
    event.target.value = '';
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader 
        title="Keys Management"
        description="Manage your key pairs. All keys should be in PKCS#8 PEM format."
      />

      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <input
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
            id="import-key"
          />
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <label htmlFor="import-key">
                  <Button variant="outline" size="icon" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                    </span>
                  </Button>
                </label>
              </TooltipTrigger>
              <TooltipContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">Import Key Pair</h4>
                  <div className="text-sm">
                    <p>Upload a ZIP file containing:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>public_key.pem</li>
                      <li>private_key.pem</li>
                    </ul>
                    <p>The key pair name will be taken from the ZIP filename.</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button 
            onClick={() => setIsAddingNew(true)} 
            disabled={isAddingNew}
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isAddingNew && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-6">
              <KeyPairForm
                mode="create"
                keyPair={newKeyPair}
                onChange={(e) => setNewKeyPair(e as KeyPair)}
                onSave={handleSave}
                onCancel={() => {
                  setIsAddingNew(false);
                  setNewKeyPair({ name: '', publicKey: '', privateKey: '', createdAt: '' });
                }}
                onGenerateKeys={handleGenerateKeys}
              />
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {keyPairs.map((pair) => (
            <Card key={pair.id}>
              <CardHeader 
                className="relative cursor-pointer hover:bg-secondary/10 transition-colors px-6 py-4"
                onClick={() => toggleExpand(pair.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="pointer-events-none p-0 hover:bg-transparent"
                    >
                      {expandedId === pair.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                    <CardTitle className="text-xl font-semibold">{pair.name}</CardTitle>
                  </div>
                  
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExport(pair);
                            }}
                          >
                            <Download className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="w-80" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-2">
                            <h4 className="font-medium">Export Key Pair</h4>
                            <div className="text-sm">
                              <p>Downloads '{pair.name}.zip' containing:</p>
                              <ul className="list-disc list-inside mt-1">
                                <li>public_key.pem</li>
                                <li>private_key.pem</li>
                              </ul>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {editingId === pair.id && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(pair.id);
                        }}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(pair);
                      }}
                    >
                      <Pencil className={`h-5 w-5 ${editingId === pair.id ? "text-primary" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(expandedId === pair.id || editingId === pair.id) && (
                <CardContent className="space-y-4 px-6 py-4">
                  {editingId === pair.id ? (
                    <>
                      <KeyPairForm
                        mode="edit"
                        keyPair={editingKeyPair || {}}
                        onChange={(e) => setEditingKeyPair((prev) => prev ? { ...prev, ...e } : null)}
                        onSave={handleUpdateKey}
                        onCancel={() => {
                          setEditingId(null);
                          setEditingKeyPair(null);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <div className="space-y-2 mb-12">
                        <Label className="key-label">Public Key (PEM)</Label>
                        <div className="key-display blurred">
                          {pair.publicKey}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="key-label mt-6">Private Key (PEM)</Label>
                        <div className="key-display blurred">
                          {pair.privateKey}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Keys; 
