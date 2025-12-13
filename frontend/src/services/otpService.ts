// A lightweight implementation of TOTP (RFC 6238) for demonstration
// In a real production app, use a library like 'otpauth' or 'speakeasy'

export class OTPService {
  
  // Convert string to hex
  private static stringToHex(str: string): string {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += '' + str.charCodeAt(i).toString(16);
    }
    return hex;
  }

  // A simulated HMAC-SHA1 function (Since native crypto.subtle is async and complex for a quick demo, 
  // we will use a pseudo-hash for this simulation that is deterministic based on secret + time)
  // CRITICAL: In production, use window.crypto.subtle.sign with HMAC-SHA1
  private static pseudoHmac(secret: string, epoch: number): string {
    // Combine secret and time window
    const input = `${secret}-${epoch}`;
    
    // Simple hash function for demo purposes to generate a deterministic number
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  // Generate a TOTP token
  static generateTOTP(secret: string, windowSeconds: number = 15): string {
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / windowSeconds);
    
    // In a real app: HMAC-SHA1(secret, timeStep)
    const hash = this.pseudoHmac(secret, timeStep);
    
    // Take last 6 digits
    const token = (parseInt(hash) % 1000000).toString().padStart(6, '0');
    return token;
  }

  // Validate a token
  static validateTOTP(secret: string, token: string, windowSeconds: number = 15): boolean {
    const currentToken = this.generateTOTP(secret, windowSeconds);
    
    // Also check previous window to account for drift
    const epoch = Math.floor(Date.now() / 1000);
    const timeStepPrev = Math.floor(epoch / windowSeconds) - 1;
    const hashPrev = this.pseudoHmac(secret, timeStepPrev);
    const prevToken = (parseInt(hashPrev) % 1000000).toString().padStart(6, '0');

    return token === currentToken || token === prevToken;
  }

  static getRemainingSeconds(windowSeconds: number = 15): number {
    const epoch = Math.floor(Date.now() / 1000);
    return windowSeconds - (epoch % windowSeconds);
  }
}