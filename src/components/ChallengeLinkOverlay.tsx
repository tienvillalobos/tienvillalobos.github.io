import React from 'react';

const styles = {
  wrapper: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: '',
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
    gap: 24,
    maxWidth: 520,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  title: { fontFamily: '"Press Start 2P", cursive', fontSize: 14, color: '#ffd700' },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#fff',
    wordBreak: 'break-all' as const,
    maxWidth: '100%',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
  copyButton: {
    fontFamily: '"Press Start 2P", cursive',
    fontSize: 12,
    padding: 12,
    background: '#172a45',
    color: '#fff',
    border: '3px solid #ffd700',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
  status: { fontFamily: '"Press Start 2P", cursive', fontSize: 12, color: '#fff', textAlign: 'center' as const },
};

export interface ChallengeLinkOverlayProps {
  challengeLink: string;
  onCopy: () => void;
  statusText: string;
  assetsBase: string;
}

export function ChallengeLinkOverlay({ challengeLink, onCopy, statusText, assetsBase }: ChallengeLinkOverlayProps) {
  return (
    <div style={{ ...styles.wrapper, backgroundImage: `url(${assetsBase}/backgrounds/menu.png)` }}>
      <div style={styles.box}>
        {challengeLink ? (
          <>
            <span style={styles.title}>LINK DEL DESAFÍO</span>
            <code style={styles.code}>{challengeLink}</code>
            <button type="button" onClick={onCopy} style={styles.copyButton}>
              Copiar link
            </button>
          </>
        ) : null}
        <span style={styles.status}>{statusText}</span>
      </div>
    </div>
  );
}
