import React from 'react';

const styles = {
  wrapper: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  box: {
    background: 'rgba(10, 25, 47, 0.95)',
    border: '4px solid #ffd700',
    borderRadius: 12,
    padding: 32,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 20,
    maxWidth: 420,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  input: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: 14,
    padding: 14,
    width: 300,
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
  },
  buttonEnabled: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: 12,
    padding: 14,
    background: '#172a45',
    color: '#fff',
    border: '3px solid #ffd700',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
  buttonDisabled: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: 12,
    padding: 14,
    background: '#333',
    color: '#fff',
    border: '3px solid #ffd700',
    cursor: 'not-allowed',
    textTransform: 'uppercase' as const,
  },
};

export interface OnlineNameOverlayProps {
  onSubmit: () => void;
  playerName: string;
  onNameChange: (value: string) => void;
  isHost: boolean;
  assetsBase: string;
}

export function OnlineNameOverlay({ onSubmit, playerName, onNameChange, isHost, assetsBase }: OnlineNameOverlayProps) {
  const enabled = !!playerName.trim();
  return (
    <div style={{ ...styles.wrapper, backgroundImage: `url(${assetsBase}/backgrounds/menu.png)` }}>
      <div style={styles.box}>
        <input
          type="text"
          value={playerName}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="Tu nombre"
          maxLength={20}
          style={styles.input}
          autoFocus
        />
        <button type="button" onClick={onSubmit} disabled={!enabled} style={enabled ? styles.buttonEnabled : styles.buttonDisabled}>
          {isHost ? 'Crear desafío' : 'Unirse al desafío'}
        </button>
      </div>
    </div>
  );
}
