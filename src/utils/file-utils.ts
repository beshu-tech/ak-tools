import JSZip from 'jszip';

export const exportKeyPairToZip = async (keyPair: { name: string, publicKey: string, privateKey: string }) => {
  const zip = new JSZip();
  
  // Add files to zip with fixed names
  zip.file('public_key.pem', keyPair.publicKey.trim());
  zip.file('private_key.pem', keyPair.privateKey.trim());
  
  // Generate zip file
  const content = await zip.generateAsync({ type: "blob" });
  
  // Create download link with keypair name
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${keyPair.name}.zip`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const importKeyPairFromZip = async (file: File): Promise<{ name: string, publicKey: string, privateKey: string }> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  
  let publicKey = '';
  let privateKey = '';
  
  // Get name from zip filename (remove .zip extension)
  const name = file.name.replace(/\.zip$/, '');
  
  // Look for fixed filenames
  const publicKeyFile = contents.files['public_key.pem'];
  const privateKeyFile = contents.files['private_key.pem'];
  
  if (!publicKeyFile || !privateKeyFile) {
    throw new Error('Invalid zip file format. Expected public_key.pem and private_key.pem files.');
  }
  
  publicKey = await publicKeyFile.async('string');
  privateKey = await privateKeyFile.async('string');
  
  return { name, publicKey, privateKey };
}; 