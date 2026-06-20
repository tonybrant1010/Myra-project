export function sha256(message: string): string {
  const MASK = 0xffffffff;
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(n: number, x: number): number {
    return ((x >>> n) | (x << (32 - n))) & MASK;
  }

  function S0(x: number): number { return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x); }
  function S1(x: number): number { return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x); }
  function s0(x: number): number { return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3); }
  function s1(x: number): number { return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10); }

  const msgBytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 128) {
      msgBytes.push(c);
    } else if (c < 2048) {
      msgBytes.push((c >> 6) | 192, (c & 63) | 128);
    } else {
      msgBytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    }
  }

  const l = msgBytes.length * 8;
  msgBytes.push(0x80);
  while ((msgBytes.length + 8) % 64 !== 0) {
    msgBytes.push(0);
  }
  
  const lBytes = new Array(8);
  let tempL = l;
  for (let i = 7; i >= 0; i--) {
    lBytes[i] = tempL & 0xff;
    tempL = tempL >>> 8;
  }
  msgBytes.push(...lBytes);

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  const W = new Array(64);
  for (let chunk = 0; chunk < msgBytes.length; chunk += 64) {
    for (let t = 0; t < 16; t++) {
      const idx = chunk + t * 4;
      W[t] = ((msgBytes[idx] << 24) | (msgBytes[idx + 1] << 16) | (msgBytes[idx + 2] << 8) | msgBytes[idx + 3]) & MASK;
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (s1(W[t - 2]) + W[t - 7] + s0(W[t - 15]) + W[t - 16]) & MASK;
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + S1(e) + ((e & f) ^ (~e & g)) + K[t] + W[t]) & MASK;
      const T2 = (S0(a) + ((a & b) ^ (a & c) ^ (b & c))) & MASK;
      h = g;
      g = f;
      f = e;
      e = (d + T1) & MASK;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) & MASK;
    }

    H0 = (H0 + a) & MASK;
    H1 = (H1 + b) & MASK;
    H2 = (H2 + c) & MASK;
    H3 = (H3 + d) & MASK;
    H4 = (H4 + e) & MASK;
    H5 = (H5 + f) & MASK;
    H6 = (H6 + g) & MASK;
    H7 = (H7 + h) & MASK;
  }

  const hex = (n: number) => {
    let s = (n >>> 0).toString(16);
    while (s.length < 8) s = "0" + s;
    return s;
  };

  return hex(H0) + hex(H1) + hex(H2) + hex(H3) + hex(H4) + hex(H5) + hex(H6) + hex(H7);
}
