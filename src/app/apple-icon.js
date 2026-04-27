import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  // Pesa con rects (mismas proporciones que public/icon.svg pero a 180x180)
  // Plates: outer 21x77, inner 14x53; bar 89x21
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Plate izq exterior */}
        <div style={{ position: 'absolute', left: 11, top: 51, width: 21, height: 77, background: '#39FF14', borderRadius: 4, display: 'flex' }} />
        {/* Plate izq interior */}
        <div style={{ position: 'absolute', left: 32, top: 62, width: 14, height: 56, background: '#39FF14', borderRadius: 3, display: 'flex' }} />
        {/* Barra */}
        <div style={{ position: 'absolute', left: 46, top: 79, width: 88, height: 21, background: '#39FF14', borderRadius: 2, display: 'flex' }} />
        {/* Plate der interior */}
        <div style={{ position: 'absolute', left: 134, top: 62, width: 14, height: 56, background: '#39FF14', borderRadius: 3, display: 'flex' }} />
        {/* Plate der exterior */}
        <div style={{ position: 'absolute', left: 148, top: 51, width: 21, height: 77, background: '#39FF14', borderRadius: 4, display: 'flex' }} />
      </div>
    ),
    { ...size },
  );
}
