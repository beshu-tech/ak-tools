export const validatePrivateKey = (key: string): string | null => {
    if (key.includes("-----BEGIN EC PRIVATE KEY-----")) {
      return "SEC1 private key format detected. Please convert to PKCS#8 format using:\nopenssl pkcs8 -topk8 -nocrypt -in sec1-key.pem -out pkcs8-key.pem";
    }
    return null;
  };
  
  export const validatePublicKey = (key: string): string | null => {
    if (!key.includes("-----BEGIN PUBLIC KEY-----")) {
      return "Invalid public key format. Key must start with '-----BEGIN PUBLIC KEY-----'";
    }
    return null;
  }; 