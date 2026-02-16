import React from 'react';

const styles = {
  pauseButton: {
    position: 'absolute' as const,
    top: 120,
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: '"Press Start 2P", cursive',
    fontSize: '10px',
    padding: '6px 10px',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: '2px solid #fff',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: { fontFamily: '"Press Start 2P", cursive', fontSize: 24, color: '#ffd700' },
  button: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: '12px',
    padding: '12px 20px',
    background: '#172a45',
    color: '#fff',
    border: '3px solid #fff',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
  buttonSmall: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: '10px',
    padding: '12px 16px',
    background: '#172a45',
    color: '#fff',
    border: '3px solid #fff',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
};

export interface PauseOverlayProps {
  onResume: () => void;
  onQuitToCharacterSelect: () => void;
}

export function PauseButton({ onPause }: { onPause: () => void }) {
  return (
    <button type="button" onClick={onPause} style={styles.pauseButton}>
      II Pausa
    </button>
  );
}

export function PauseOverlay({ onResume, onQuitToCharacterSelect }: PauseOverlayProps) {
  return (
    <div style={styles.overlay}>
      <span style={styles.title}>PAUSA</span>
      <button type="button" onClick={onResume} style={styles.button}>
        Resumen
      </button>
      <button type="button" onClick={onQuitToCharacterSelect} style={styles.buttonSmall}>
        Volver al menu de personajes
      </button>
    </div>
  );
}
