import React from 'react';

const styles = {
  wrapper: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 32,
  },
  button: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: '12px',
    padding: '14px 24px',
    background: 'rgba(23, 42, 69, 0.95)',
    color: '#ffd700',
    border: '3px solid #ffd700',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
};

export interface GameOverOverlayProps {
  onBackToMenu: () => void;
}

export function GameOverOverlay({ onBackToMenu }: GameOverOverlayProps) {
  return (
    <div style={styles.wrapper}>
      <button type="button" onClick={onBackToMenu} style={styles.button}>
        Volver al menú
      </button>
    </div>
  );
}
